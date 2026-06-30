import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

const PORT = 3000;

// Helper to query OpenLibrary for real-time bibliographic data
async function queryOpenLibrary(query: string, type: "isbn" | "title") {
  try {
    if (type === "isbn") {
      const formattedIsbn = query.replace(/[-\s]/g, "");
      const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${formattedIsbn}&format=json&jscmd=data`;
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      const key = `ISBN:${formattedIsbn}`;
      if (data && data[key]) {
        const book = data[key];
        return {
          source: "OpenLibrary Bibliographic Database",
          found: true,
          title: book.title || "",
          author: book.authors ? book.authors.map((a: any) => a.name).join(", ") : "",
          isbn: formattedIsbn,
          publisher: book.publishers ? book.publishers.map((p: any) => p.name).join(", ") : "",
          publishYear: book.publish_date || "",
          publishPlace: book.publish_places ? book.publish_places.map((pl: any) => pl.name).join(", ") : "",
          pages: book.number_of_pages ? String(book.number_of_pages) : "",
          coverUrl: book.cover ? book.cover.medium : null,
          subjects: book.subjects ? book.subjects.map((s: any) => s.name) : []
        };
      }
    } else {
      // Title search
      const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=3`;
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data && data.docs && data.docs.length > 0) {
        const book = data.docs[0];
        return {
          source: "OpenLibrary Search Index",
          found: true,
          title: book.title || "",
          author: book.author_name ? book.author_name.join(", ") : "",
          isbn: book.isbn ? book.isbn[0] : "",
          publisher: book.publisher ? book.publisher[0] : "",
          publishYear: book.publish_date ? book.publish_date[0] : book.first_publish_year ? String(book.first_publish_year) : "",
          publishPlace: book.publish_place ? book.publish_place[0] : "",
          pages: book.number_of_pages_median ? String(book.number_of_pages_median) : "",
          subjects: book.subject ? book.subject.slice(0, 10) : []
        };
      }
    }
  } catch (error) {
    console.error("OpenLibrary lookup failed:", error);
  }
  return null;
}

// Robust helper to query Gemini with exponential backoff & model fallback in case of high demand (503)
async function generateContentWithRetryAndFallback(aiClient: GoogleGenAI, params: { model: string; contents: string; config: any }, maxRetries = 3) {
  let delay = 1000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await aiClient.models.generateContent(params);
    } catch (err: any) {
      console.warn(`Attempt ${attempt} to call Gemini failed:`, err.message || err);
      
      const errStr = String(err).toLowerCase();
      const is503 = err?.status === 503 || err?.code === 503 || errStr.includes("503") || errStr.includes("high demand") || errStr.includes("unavailable");
      
      if (is503 && attempt < maxRetries) {
        console.log(`Gemini API 503/high demand encountered. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
        continue;
      }
      
      // If we've exhausted retries or hit a non-retryable 503, try falling back to 'gemini-3.1-flash-lite'
      if (is503 && params.model !== "gemini-3.1-flash-lite") {
        console.log("Model 'gemini-3.5-flash' unavailable. Attempting fallback to 'gemini-3.1-flash-lite'...");
        try {
          const fallbackParams = {
            ...params,
            model: "gemini-3.1-flash-lite"
          };
          return await aiClient.models.generateContent(fallbackParams);
        } catch (fallbackErr: any) {
          console.error("Fallback model 'gemini-3.1-flash-lite' also failed:", fallbackErr.message || fallbackErr);
          throw fallbackErr;
        }
      }
      
      throw err;
    }
  }
  throw new Error("Unable to complete request due to high API demand.");
}

// REST API endpoint to classify and catalog a book
app.post("/api/catalog/classify", async (req, res) => {
  try {
    const { query, type, image } = req.body;
    
    if (!query && !image) {
      return res.status(400).json({ error: "Either Search Query or Title Page Image is required." });
    }

    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is not configured. Please add it to the Secrets panel.",
        isConfigError: true
      });
    }

    // 1. Try querying OpenLibrary database first to look up official bibliographic records if a query is provided
    const olRecord = query ? await queryOpenLibrary(query, type) : null;

    // 2. Build the Gemini instruction and input prompt
    const systemInstruction = `You are an expert senior library cataloger and specialist in classification systems.
Your task is to analyze a book's cataloging request and generate:
1. Dewey Decimal Classification (DDC) number (with 23rd edition standard structure) with a certainty percentage (0-100%).
2. Full breakdown of the DDC hierarchy (from Main Class to specific subdivision).
3. Subject Headings from:
   - Library of Congress Subject Headings (LCSH)
   - Sears List of Subject Headings (SLSH)
   - Medical Subject Headings (MeSH) - if applicable, otherwise empty or related terms.
4. A complete MARC21 record formatted strictly for standard library cataloging systems under AACR2 (Anglo-American Cataloguing Rules, 2nd Edition) guidelines.
5. An AACR2 standard cataloging card layout.

Ensure that the MARC21 tags follow exact library standards:
- Tag 020 for ISBN ($a)
- Tag 082 for Dewey Decimal Classification ($2 23 for edition 23, $a for classification number)
- Tag 100 for Author (Main entry - Personal name, e.g., 'Martin, Robert C.')
- Tag 245 for Title and Statement of Responsibility (using standard AACR2 punctuations: 'title / statement of responsibility' or 'title : subtitle / statement of responsibility ; secondary statement')
- Tag 250 for Edition ($a)
- Tag 260 or 264 for Publication, Distribution, etc. ($a place : $b publisher, $c date)
- Tag 300 for Physical Description ($a pages p. : $b ill. ; $c cm.)
- Tags 650 with indicator2=0 for LCSH, indicator2=8 for Sears, indicator2=2 for MeSH.

If a Title Page Image is attached, visually extract key details (Title, Subtitle, Author, Publisher, Edition) directly from the text printed on the page and use them as your primary source of metadata.
If the book was found in the database, use that record as a solid anchor, but correct any formatting errors, supply missing classification numbers, and complete the MARC21 and subject listings.
If the book was NOT found in the database, use your comprehensive knowledge to identify or synthesize the book metadata, predict the DDC classification, explain the assignment, and build the records. Compute a lower 'certainty' percentage if the book description or title is ambiguous or if you are synthesizing a classification for a hypothetical title.`;

    let promptText = "";
    if (olRecord) {
      promptText = `BOOK FOUND IN BIBLIOGRAPHIC DATABASE:
Source: ${olRecord.source}
Title: ${olRecord.title}
Author: ${olRecord.author}
ISBN: ${olRecord.isbn}
Publisher: ${olRecord.publisher}
Publish Year: ${olRecord.publishYear}
Publish Place: ${olRecord.publishPlace}
Pages/Extent: ${olRecord.pages}
Subjects: ${olRecord.subjects.join(", ")}`;
    } else {
      promptText = `BOOK METADATA INPUT:
Search Query Type: ${type || 'visual'}
Search Input: ${query || 'Visual Scan (No query text provided)'}`;
    }

    const contents: any[] = [];

    if (image && image.base64 && image.mimeType) {
      let base64Data = image.base64;
      // Strip any data-URL prefix if sent by the client
      if (base64Data.includes(";base64,")) {
        base64Data = base64Data.split(";base64,").pop() || "";
      }

      promptText += `\n\nTITLE PAGE IMAGE ATTACHED:
An image/scan of the book's title page is provided below. Please visually read the image to discover or confirm the Title, Subtitle, Author, Publisher, and Edition. Integrate these visual facts into the metadata and Dewey classification.`;

      contents.push(promptText);
      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: image.mimeType
        }
      });
    } else {
      contents.push(promptText);
    }

    const response = await generateContentWithRetryAndFallback(ai, {
      model: "gemini-3.5-flash",
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING, description: "The database sources checked or Gemini fallback" },
            foundInDatabase: { type: Type.BOOLEAN, description: "Whether a real record was found in external library indices" },
            metadata: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                isbn: { type: Type.STRING },
                publisher: { type: Type.STRING },
                publishYear: { type: Type.STRING },
                publishPlace: { type: Type.STRING },
                pages: { type: Type.STRING },
                edition: { type: Type.STRING },
                series: { type: Type.STRING },
                language: { type: Type.STRING }
              },
              required: ["title", "author"]
            },
            ddc: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.STRING, description: "Standard Dewey Decimal Number (e.g. 510.72 or 616.075)" },
                certainty: { type: Type.INTEGER, description: "Percentage of certainty (0-100) that this is the correct classification" },
                classTitle: { type: Type.STRING, description: "Textual description of the final classification" },
                breakdown: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      level: { type: Type.STRING, description: "e.g. Class, Division, Section, Subdivision" },
                      code: { type: Type.STRING, description: "Numerical class or division e.g. 600, 610, 616" },
                      name: { type: Type.STRING, description: "Title of this level e.g. Technology, Medicine, Pathology" }
                    },
                    required: ["level", "code", "name"]
                  }
                },
                explanation: { type: Type.STRING, description: "Detailed bibliographic justification for synthesizing or selecting this DDC number" }
              },
              required: ["number", "certainty", "classTitle", "breakdown", "explanation"]
            },
            subjectHeadings: {
              type: Type.OBJECT,
              properties: {
                lcsh: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Library of Congress Subject Headings" },
                sears: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Sears List of Subject Headings" },
                mesh: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Medical Subject Headings (leave empty or use general medical headings if unrelated)" }
              },
              required: ["lcsh", "sears", "mesh"]
            },
            marc21: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  tag: { type: Type.STRING, description: "Three-digit numeric tag, e.g. '245'" },
                  ind1: { type: Type.STRING, description: "Indicator 1 value, e.g. '1', '0' or '#'" },
                  ind2: { type: Type.STRING, description: "Indicator 2 value, e.g. '0', '4' or '#'" },
                  value: { type: Type.STRING, description: "Subfields string, e.g. '$a Clean code : $b a handbook / $c Robert Martin.'" },
                  description: { type: Type.STRING, description: "Human friendly tag description, e.g. 'Title Statement'" }
                },
                required: ["tag", "ind1", "ind2", "value", "description"]
              }
            },
            aacr2Card: {
              type: Type.OBJECT,
              properties: {
                mainEntry: { type: Type.STRING, description: "Main entry (usually author in catalog card standard format, e.g., 'Martin, Robert C.')" },
                body: { type: Type.STRING, description: "Complete card paragraph. Includes title, statement of responsibility, edition, publisher information, page count, and dimensions." },
                tracings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Numbered tracings at bottom of card, e.g. ['1. Computer programming.', '2. Software engineering.', 'I. Title.']" }
              },
              required: ["mainEntry", "body", "tracings"]
            }
          },
          required: ["source", "foundInDatabase", "metadata", "ddc", "subjectHeadings", "marc21", "aacr2Card"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response text received from Gemini API.");
    }

    const parsedResult = JSON.parse(resultText);
    
    // Inject real OpenLibrary cover if available
    if (olRecord && olRecord.coverUrl) {
      parsedResult.metadata.coverUrl = olRecord.coverUrl;
    }

    res.json(parsedResult);
  } catch (error: any) {
    console.error("Classification API Error:", error);
    res.status(500).json({
      error: error.message || "An error occurred while generating bibliographic data.",
    });
  }
});

// Configure Vite and static assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
