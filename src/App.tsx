import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Search,
  History,
  FileText,
  Bookmark,
  Database,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  Hash,
  BookMarked,
  Printer,
  Compass,
  FileCode,
  Layers,
  ChevronRight,
  Download
} from "lucide-react";
import { ClassificationResult, HistoryItem } from "./types";
import DdcBreakdown from "./components/DdcBreakdown";
import Marc21Viewer from "./components/Marc21Viewer";
import CatalogCard from "./components/CatalogCard";

// Presets representing diverse subject types (Literature, Science/Tech, Medical)
const BOOK_PRESETS = [
  {
    title: "Pride and Prejudice",
    isbn: "9780141439518",
    label: "Literature (Austen)",
    type: "title" as const
  },
  {
    title: "Clean Code",
    isbn: "9780132350884",
    label: "Computer Science (Martin)",
    type: "isbn" as const
  },
  {
    title: "Harrison's Principles of Internal Medicine",
    isbn: "9781259641886",
    label: "Medical (Harrison)",
    type: "isbn" as const
  }
];

export default function App() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"isbn" | "title">("isbn");
  const [image, setImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sources, setSources] = useState({
    loc: true,
    worldcat: true,
    openlibrary: true
  });
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"ddc" | "marc" | "card">("ddc");

  // Load search history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("catalog_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }
  }, []);

  // Sync history to localStorage
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem("catalog_history", JSON.stringify(newHistory));
  };

  // Loading phase descriptions for smoother user feedback
  useEffect(() => {
    if (!loading) return;
    const intervals = [
      setTimeout(() => setLoadingStep(1), 800),
      setTimeout(() => setLoadingStep(2), 2200),
      setTimeout(() => setLoadingStep(3), 4000)
    ];
    return () => intervals.forEach(clearTimeout);
  }, [loading]);

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files (JPEG, PNG, WEBP) are supported for visual title page scanning.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage({
        base64: reader.result as string,
        mimeType: file.type
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClassify = async (overrideQuery?: string, overrideType?: "isbn" | "title") => {
    const activeQuery = overrideQuery !== undefined ? overrideQuery : query;
    const activeType = overrideType !== undefined ? overrideType : searchType;

    if (!activeQuery.trim() && !image) {
      setError("Please enter a book Title, ISBN or upload an image of the Title Page to classify.");
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/catalog/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: activeQuery, 
          type: activeType,
          image: image
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate classification record.");
      }

      setResult(data);
      setActiveTab("ddc"); // reset view to DDC Classification on fresh query

      // Add to history (use the visually scanned title as history key if input query was blank)
      const labelText = activeQuery.trim() || data.metadata.title || "Visual Scan";
      const historyItem: HistoryItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        timestamp: Date.now(),
        query: labelText,
        type: activeQuery.trim() ? activeType : "title",
        result: data
      };
      
      const updatedHistory = [historyItem, ...history.filter(h => h.query !== labelText)].slice(0, 20);
      saveHistory(updatedHistory);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (preset: typeof BOOK_PRESETS[0]) => {
    const value = preset.type === "isbn" ? preset.isbn : preset.title;
    setQuery(value);
    setSearchType(preset.type);
    handleClassify(value, preset.type);
  };

  const handleHistoryClick = (item: HistoryItem) => {
    setQuery(item.query);
    setSearchType(item.type);
    setResult(item.result);
    setError(null);
    setActiveTab("ddc");
  };

  const clearHistory = () => {
    saveHistory([]);
  };

  // Triggers downloading of the MARC record as a flat cataloging text file (.mrc/.txt format)
  const downloadMarcFile = () => {
    if (!result) return;
    const marcText = result.marc21
      .map(
        (f) =>
          `${f.tag.padEnd(4)} ${f.ind1 === " " || f.ind1 === "#" ? "_" : f.ind1}${
            f.ind2 === " " || f.ind2 === "#" ? "_" : f.ind2
          } ${f.value}`
      )
      .join("\n");
    const blob = new Blob([marcText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.metadata.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_marc21.mrc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans antialiased">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-serif text-lg font-bold">
            LC
          </div>
          <div>
            <h1 className="text-md font-semibold tracking-tight text-zinc-900">
              LibriClass <span className="text-zinc-400 font-light font-mono">v4.2</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase font-mono">
              Dewey Decimal & MARC21 Engine
            </p>
          </div>
        </div>
        
        {/* Integrations Header Indicators */}
        <div className="hidden md:flex items-center gap-6 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-1.5 bg-zinc-100 px-2.5 py-1 rounded">
            <Database className="w-3.5 h-3.5 text-zinc-400" />
            <span>LOC, WorldCat & OpenLibrary APIs Active</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold">AI Classifier Ready</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden max-w-7xl w-full mx-auto">
        
        {/* Left Sidebar: Control Center */}
        <aside className="w-full lg:w-[350px] bg-white border-b lg:border-b-0 lg:border-r border-zinc-200 p-6 flex flex-col gap-6 flex-shrink-0">
          
          {/* Section 1: Query Input */}
          <div>
            <div className="flex justify-between items-center mb-2.5">
              <label className="block text-[11px] uppercase tracking-widest text-zinc-400 font-bold font-mono">
                Bibliographic Entry
              </label>
              
              {/* Type toggle */}
              <div className="flex bg-zinc-100 p-0.5 rounded border border-zinc-200 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setSearchType("isbn")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    searchType === "isbn" ? "bg-white text-zinc-900 font-bold shadow-xs" : "text-zinc-500"
                  }`}
                >
                  ISBN
                </button>
                <button
                  type="button"
                  onClick={() => setSearchType("title")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    searchType === "title" ? "bg-white text-zinc-900 font-bold shadow-xs" : "text-zinc-500"
                  }`}
                >
                  TITLE
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleClassify()}
                  placeholder={
                    searchType === "isbn"
                      ? "Enter 10 or 13-digit ISBN (e.g., 9780132350884)"
                      : "Enter book title or author keywords..."
                  }
                  className="w-full p-3 bg-zinc-50 hover:bg-zinc-100/50 focus:bg-white border border-zinc-200 focus:border-zinc-800 rounded-lg text-sm focus:outline-none transition-all pr-10 font-sans"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  {searchType === "isbn" ? <Hash className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                </div>
              </div>

              {/* Image upload zone supporting drag-and-drop & manual click selection */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border border-dashed rounded-lg p-3 text-center transition-all duration-200 ${
                  isDragging
                    ? "border-zinc-800 bg-zinc-50"
                    : image
                    ? "border-zinc-300 bg-zinc-50/50"
                    : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/30"
                }`}
              >
                {image ? (
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={image.base64}
                        alt="Title page upload preview"
                        className="w-9 h-12 object-cover rounded border border-zinc-200 bg-zinc-100 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-zinc-800 truncate">Title Page Attached</p>
                        <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider font-bold">
                          Visual mode active
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-900 font-mono font-bold cursor-pointer transition px-1.5 py-0.5 rounded hover:bg-zinc-100"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer py-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                      className="hidden"
                    />
                    <div className="text-zinc-400 hover:text-zinc-600 transition flex flex-col items-center gap-0.5">
                      <span className="text-xs font-medium text-zinc-600">
                        Drag Title Page or <span className="underline font-bold text-zinc-800">Browse</span>
                      </span>
                      <span className="text-[9px] text-zinc-400 font-mono">
                        Supports JPEG, PNG, WEBP
                      </span>
                    </div>
                  </label>
                )}
              </div>

              <button
                onClick={() => handleClassify()}
                disabled={loading}
                className="w-full py-3 bg-zinc-900 text-white hover:bg-black rounded-lg font-medium text-xs tracking-wider uppercase transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Record...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>Analyze & Classify</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick-Start Presets */}
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-zinc-400 mb-2 font-bold font-mono">
              Demo Presets
            </label>
            <div className="flex flex-col gap-1.5">
              {BOOK_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePresetClick(preset)}
                  className="w-full text-left p-2.5 text-xs rounded border border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate pr-2">
                    <div className="font-semibold text-zinc-800 group-hover:text-zinc-950 truncate">
                      {preset.title}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {preset.label}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Source Selectors */}
          <div className="border-t border-zinc-150 pt-5">
            <label className="block text-[11px] uppercase tracking-widest text-zinc-400 mb-3 font-bold font-mono">
              Federated Search Sources
            </label>
            <div className="space-y-2.5 text-xs text-zinc-600">
              <label className="flex items-center gap-3 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={sources.loc}
                  onChange={(e) => setSources({ ...sources, loc: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-800"
                />
                <span className="font-medium text-zinc-700">Library of Congress (LOC)</span>
              </label>
              <label className="flex items-center gap-3 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={sources.worldcat}
                  onChange={(e) => setSources({ ...sources, worldcat: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-800"
                />
                <span className="font-medium text-zinc-700">OCLC WorldCat Directories</span>
              </label>
              <label className="flex items-center gap-3 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={sources.openlibrary}
                  onChange={(e) => setSources({ ...sources, openlibrary: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-800"
                />
                <span className="font-medium text-zinc-700">OpenLibrary Bibliographic API</span>
              </label>
            </div>
          </div>

          {/* Search History */}
          <div className="border-t border-zinc-150 pt-5 flex-1 flex flex-col min-h-[150px]">
            <div className="flex justify-between items-center mb-2.5">
              <label className="block text-[11px] uppercase tracking-widest text-zinc-400 font-bold font-mono">
                Recent Sessions
              </label>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-[10px] font-mono text-zinc-400 hover:text-zinc-600 transition underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-200 rounded-lg p-4 text-center">
                <History className="w-5 h-5 text-zinc-300 mb-1" />
                <span className="text-[10px] text-zinc-400 font-medium">No previous entries</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[220px] pr-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleHistoryClick(item)}
                    className={`w-full text-left p-2 rounded text-xs transition flex items-center justify-between cursor-pointer ${
                      result && result.metadata.title === item.result.metadata.title
                        ? "bg-zinc-100 border border-zinc-300 text-zinc-950 font-medium"
                        : "border border-transparent hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate">{item.result.metadata.title}</div>
                      <div className="text-[9px] text-zinc-400 font-mono flex items-center space-x-1 mt-0.5">
                        <span className="uppercase">{item.type}</span>
                        <span>•</span>
                        <span>DDC {item.result.ddc.number}</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-zinc-400">
                      {item.result.ddc.certainty}%
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right Dashboard Area */}
        <main className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-xs sm:text-sm flex items-start space-x-2.5 shadow-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 text-rose-600 flex-shrink-0" />
              <div>
                <span className="font-bold block mb-0.5">Classification Failure</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* SKELETON / LOADING LOADER */}
          {loading && (
            <div className="flex-1 bg-white border border-zinc-200/60 rounded-xl p-8 flex flex-col items-center justify-center min-h-[450px]">
              <div className="w-16 h-16 relative flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-zinc-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                <Database className="w-5 h-5 text-zinc-400" />
              </div>

              <div className="mt-6 text-center max-w-sm">
                <h3 className="text-sm font-semibold text-zinc-800 font-mono uppercase tracking-wider">
                  Analyzing Bibliographic Index
                </h3>
                
                {/* Simulated Steps */}
                <div className="mt-4 space-y-2 text-xs text-zinc-500">
                  <div className="flex items-center justify-center space-x-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${loadingStep >= 0 ? 'bg-zinc-800 animate-pulse' : 'bg-zinc-200'}`}></span>
                    <span className={loadingStep === 0 ? "text-zinc-800 font-medium" : ""}>Checking LOC & OpenLibrary Catalogues...</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${loadingStep >= 1 ? 'bg-zinc-800 animate-pulse' : 'bg-zinc-200'}`}></span>
                    <span className={loadingStep === 1 ? "text-zinc-800 font-medium" : ""}>Synthesizing DDC Classes (23rd Ed.)...</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${loadingStep >= 2 ? 'bg-zinc-800 animate-pulse' : 'bg-zinc-200'}`}></span>
                    <span className={loadingStep === 2 ? "text-zinc-800 font-medium" : ""}>Mapping Subject Vocabularies (LCSH, Sears, MeSH)...</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${loadingStep >= 3 ? 'bg-zinc-800 animate-pulse' : 'bg-zinc-200'}`}></span>
                    <span className={loadingStep === 3 ? "text-zinc-800 font-medium" : ""}>Generating MARC21 Tags & Catalog Card...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMPTY WELCOME SCREEN */}
          {!loading && !result && (
            <div className="flex-1 bg-white border border-zinc-200/60 rounded-xl p-8 flex flex-col items-center justify-center min-h-[450px] text-center">
              <div className="bg-zinc-50 border border-zinc-100 p-5 rounded-full shadow-inner text-zinc-400 mb-5">
                <BookMarked className="w-10 h-10 stroke-1" />
              </div>
              <h2 className="text-xl font-bold text-zinc-800 tracking-tight">
                No Record Loaded
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 max-w-md mt-2 leading-relaxed">
                Enter an ISBN-10/13 or book title keywords in the control panel to generate full Dewey classifications, subject heading associations, and MARC21 card files automatically.
              </p>

              {/* Informative Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 w-full max-w-2xl text-left">
                <div className="border border-zinc-100 p-4 rounded-lg bg-zinc-50/50">
                  <div className="flex items-center space-x-2 text-zinc-700 font-medium text-xs font-mono uppercase mb-1.5">
                    <Compass className="w-4 h-4 text-amber-500" />
                    <span>Dewey Decimal (DDC)</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Automatic class mapping down to logical subdivisions with strict percentage reliability statistics.
                  </p>
                </div>

                <div className="border border-zinc-100 p-4 rounded-lg bg-zinc-50/50">
                  <div className="flex items-center space-x-2 text-zinc-700 font-medium text-xs font-mono uppercase mb-1.5">
                    <FileCode className="w-4 h-4 text-blue-500" />
                    <span>MARC21 & AACR2</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Standard tagged library directory fields conforming strictly to AACR2 formatting conventions.
                  </p>
                </div>

                <div className="border border-zinc-100 p-4 rounded-lg bg-zinc-50/50">
                  <div className="flex items-center space-x-2 text-zinc-700 font-medium text-xs font-mono uppercase mb-1.5">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span>Subject Vocabulary</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Simultaneous classification cross-references using SLSH, Library of Congress (LCSH), and MeSH headings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE RECORD LOADED */}
          {!loading && result && (
            <div className="space-y-6">
              
              {/* Dynamic Metadata / Book Info Block */}
              <div className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-xs flex flex-col md:flex-row gap-5 items-start">
                {result.metadata.coverUrl ? (
                  <img
                    src={result.metadata.coverUrl}
                    alt="Book Cover"
                    className="w-20 h-28 object-cover rounded shadow-sm border border-zinc-200 bg-zinc-50 flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-28 bg-zinc-100 border border-zinc-200 rounded flex flex-col items-center justify-center text-zinc-400 flex-shrink-0">
                    <BookOpen className="w-8 h-8 stroke-1" />
                    <span className="text-[8px] font-mono mt-1 uppercase">No Cover</span>
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                      {result.foundInDatabase ? "Bibliographic Match" : "Synthesized AI Estimate"}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Source: {result.source}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold tracking-tight text-zinc-900 truncate">
                    {result.metadata.title}
                  </h2>
                  <p className="text-sm font-medium text-zinc-600 mt-0.5">
                    by {result.metadata.author || "Unknown Author"}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-4 text-[11px] text-zinc-500 border-t border-zinc-100 pt-3.5">
                    <div>
                      <span className="font-semibold text-zinc-400 uppercase tracking-wider block text-[9px] font-mono">Publisher</span>
                      <span className="truncate block font-medium text-zinc-700">{result.metadata.publisher || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-400 uppercase tracking-wider block text-[9px] font-mono">Location & Date</span>
                      <span className="truncate block font-medium text-zinc-700">
                        {result.metadata.publishPlace ? `${result.metadata.publishPlace}, ` : ""}
                        {result.metadata.publishYear || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-400 uppercase tracking-wider block text-[9px] font-mono">Physical Extent</span>
                      <span className="truncate block font-medium text-zinc-700">
                        {result.metadata.pages ? `${result.metadata.pages} p.` : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-400 uppercase tracking-wider block text-[9px] font-mono">ISBN</span>
                      <span className="truncate block font-medium text-zinc-700 font-mono">{result.metadata.isbn || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary Navigation (DDC | MARC21 | Catalog Card) */}
              <div className="flex border-b border-zinc-200">
                <button
                  onClick={() => setActiveTab("ddc")}
                  className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                    activeTab === "ddc"
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>DDC & Subjects</span>
                </button>
                <button
                  onClick={() => setActiveTab("marc")}
                  className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                    activeTab === "marc"
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                  <span>MARC21 Directory</span>
                </button>
                <button
                  onClick={() => setActiveTab("card")}
                  className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
                    activeTab === "card"
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>AACR2 Catalog Card</span>
                </button>
              </div>

              {/* Active Tab Viewport */}
              <div className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-xs">
                
                {activeTab === "ddc" && (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* DDC Classification Detail */}
                    <div className="xl:col-span-7">
                      <DdcBreakdown ddc={result.ddc} />
                    </div>

                    {/* Subject Vocabularies Panel */}
                    <div className="xl:col-span-5 space-y-4">
                      <div className="flex items-center space-x-2 text-zinc-800">
                        <Layers className="h-4 w-4 text-zinc-500" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 font-sans">
                          Cross-Referenced Subject Headings
                        </h3>
                      </div>

                      <div className="space-y-3.5">
                        {/* Library of Congress (LCSH) */}
                        <div className="p-3.5 border border-zinc-200 bg-zinc-50/30 rounded-lg">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] text-blue-700 font-bold font-mono tracking-wider">
                              LCSH (Library of Congress)
                            </span>
                            <span className="text-[9px] text-zinc-400 font-medium">Standard</span>
                          </div>
                          {result.subjectHeadings.lcsh && result.subjectHeadings.lcsh.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-700 font-medium">
                              {result.subjectHeadings.lcsh.map((head, i) => (
                                <li key={i}>{head}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">No LCSH records linked.</span>
                          )}
                        </div>

                        {/* Sears List of Subject Headings (SLSH) */}
                        <div className="p-3.5 border border-zinc-200 bg-zinc-50/30 rounded-lg">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] text-purple-700 font-bold font-mono tracking-wider">
                              SLSH (Sears List)
                            </span>
                            <span className="text-[9px] text-zinc-400 font-medium">Public/School</span>
                          </div>
                          {result.subjectHeadings.sears && result.subjectHeadings.sears.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-700 font-medium">
                              {result.subjectHeadings.sears.map((head, i) => (
                                <li key={i}>{head}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">No Sears records linked.</span>
                          )}
                        </div>

                        {/* Medical Subject Headings (MeSH) */}
                        <div className={`p-3.5 border rounded-lg transition-opacity ${
                          result.subjectHeadings.mesh && result.subjectHeadings.mesh.length > 0
                            ? "border-emerald-200 bg-emerald-50/10"
                            : "border-zinc-150 bg-zinc-50/10 opacity-60"
                        }`}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className={`text-[10px] font-bold font-mono tracking-wider ${
                              result.subjectHeadings.mesh && result.subjectHeadings.mesh.length > 0
                                ? "text-emerald-700"
                                : "text-zinc-400"
                            }`}>
                              MeSH (Medical Subject Headings)
                            </span>
                            <span className="text-[9px] text-zinc-400 font-medium">Biomedical</span>
                          </div>
                          {result.subjectHeadings.mesh && result.subjectHeadings.mesh.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-700 font-medium">
                              {result.subjectHeadings.mesh.map((head, i) => (
                                <li key={i} className="text-emerald-950">{head}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">
                              No medical classification context.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "marc" && (
                  <div className="space-y-4">
                    <Marc21Viewer fields={result.marc21} />
                    
                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100">
                      <button
                        onClick={downloadMarcFile}
                        className="flex items-center space-x-1.5 text-xs font-semibold bg-zinc-900 text-white hover:bg-black transition px-4 py-2.5 rounded shadow-xs cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Export MARC (.mrc)</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "card" && (
                  <CatalogCard
                    card={result.aacr2Card}
                    callNumber={`${result.ddc.number} ${result.metadata.author ? result.metadata.author.slice(0, 3).toUpperCase() : ""}`}
                  />
                )}

              </div>
            </div>
          )}

        </main>
      </div>

      {/* Elegant minimalist footer */}
      <footer className="px-6 py-4 bg-white border-t border-zinc-200 text-[10px] text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex gap-4 italic font-sans">
          <span>Standards: AACR2, Dewey 23rd Edition, MARC21, Sears 22nd</span>
          <span className="hidden sm:inline">•</span>
          <span>Database Mirror: LOC Z39.50 & OCLC Indexes</span>
        </div>
        <div>
          <span>Crafted for Bibliographic Classification & Cataloging Professionals</span>
        </div>
      </footer>
    </div>
  );
}
