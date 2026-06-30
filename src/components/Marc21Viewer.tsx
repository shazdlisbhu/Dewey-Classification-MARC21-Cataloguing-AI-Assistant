import React, { useState } from "react";
import { MarcField } from "../types";
import { Copy, Check, Table, FileText, ChevronDown, ChevronUp } from "lucide-react";

interface Marc21ViewerProps {
  fields: MarcField[];
}

export default function Marc21Viewer({ fields }: Marc21ViewerProps) {
  const [viewMode, setViewMode] = useState<"grid" | "flat">("grid");
  const [copied, setCopied] = useState(false);
  const [showFullSchema, setShowFullSchema] = useState(false);

  // Construct standard flat text format
  const getFlatMarcText = () => {
    return fields
      .map(
        (f) =>
          `${f.tag.padEnd(4)} ${f.ind1 === " " || f.ind1 === "#" ? "_" : f.ind1}${
            f.ind2 === " " || f.ind2 === "#" ? "_" : f.ind2
          } ${f.value}`
      )
      .join("\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFlatMarcText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to format subfields with slight styling/coloring
  const renderFormattedSubfields = (value: string) => {
    const parts = value.split(/(\$[a-z0-9])/g);
    return (
      <span className="font-mono text-[13px] text-zinc-700 break-all select-all">
        {parts.map((part, idx) => {
          if (part.startsWith("$")) {
            return (
              <span key={idx} className="text-amber-600 font-semibold font-mono">
                {part}
              </span>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </span>
    );
  };

  return (
    <div id="marc21-viewer" className="flex flex-col space-y-4">
      {/* Header controls */}
      <div className="flex justify-between items-center bg-zinc-50 border-b border-zinc-200/60 p-3 px-4">
        <div className="flex items-center space-x-2">
          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
          <span className="text-xs font-semibold text-zinc-700 tracking-wider uppercase font-mono">
            MARC21 Bibliographic Format
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {/* Mode Toggles */}
          <div className="flex bg-zinc-200/60 p-0.5 rounded border border-zinc-200">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center space-x-1 text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-zinc-800 font-medium shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <Table className="h-3 w-3" />
              <span>Grid View</span>
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={`flex items-center space-x-1 text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                viewMode === "flat"
                  ? "bg-white text-zinc-800 font-medium shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <FileText className="h-3 w-3" />
              <span>Flat Text</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition bg-white border border-zinc-200 px-2.5 py-1 rounded shadow-xs cursor-pointer"
            title="Copy MARC text to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy MARC</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="bg-white rounded-b-md overflow-hidden">
        {viewMode === "grid" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200/80 text-left text-xs sm:text-sm">
              <thead className="bg-zinc-50/60 font-mono text-zinc-500 uppercase tracking-wider text-[11px] border-b border-zinc-150">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold w-16">
                    Tag
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold w-12 text-center">
                    I1
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold w-12 text-center">
                    I2
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Subfield Data & Values
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold hidden sm:table-cell w-1/3">
                    Field Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {fields.slice(0, showFullSchema ? undefined : 14).map((field, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/40 transition">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-blue-700">
                      {field.tag}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-center text-zinc-400 bg-zinc-50/30">
                      {field.ind1 === " " || field.ind1 === "#" ? (
                        <span className="text-zinc-300">_</span>
                      ) : (
                        field.ind1
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-center text-zinc-400 bg-zinc-50/30">
                      {field.ind2 === " " || field.ind2 === "#" ? (
                        <span className="text-zinc-300">_</span>
                      ) : (
                        field.ind2
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {renderFormattedSubfields(field.value)}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 font-sans text-xs hidden sm:table-cell">
                      {field.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {fields.length > 14 && (
              <div className="border-t border-zinc-100 flex justify-center p-2 bg-zinc-50/40">
                <button
                  onClick={() => setShowFullSchema(!showFullSchema)}
                  className="flex items-center space-x-1 text-xs text-zinc-500 hover:text-zinc-800 transition py-1 cursor-pointer"
                >
                  {showFullSchema ? (
                    <>
                      <span>Show Less Fields</span>
                      <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      <span>Show Full MARC Record ({fields.length} Fields)</span>
                      <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-zinc-950 rounded-b-md">
            <pre className="font-mono text-xs text-zinc-200 leading-relaxed overflow-x-auto select-all whitespace-pre-wrap max-h-[450px]">
              {getFlatMarcText()}
            </pre>
          </div>
        )}
      </div>

      {/* MARC Quick Reference Footer */}
      <div className="bg-zinc-50/50 rounded-md p-3 text-[11px] text-zinc-500 grid grid-cols-2 gap-4 border border-zinc-200/50">
        <div>
          <span className="font-bold text-zinc-700 block mb-0.5">MARC Delimiter Tip</span>
          The character <span className="font-semibold text-amber-600 font-mono">$</span> is used to signify a subfield code (e.g., <span className="font-mono text-zinc-600">$a</span> for primary title, <span className="font-mono text-zinc-600">$c</span> for statement of responsibility).
        </div>
        <div>
          <span className="font-bold text-zinc-700 block mb-0.5">Common Cataloging Tags</span>
          <span className="font-mono">100</span> Main Author Entry; <span className="font-mono">245</span> Title / Statement of Responsibility; <span className="font-mono">260/264</span> Publication; <span className="font-mono">300</span> Physical Extent.
        </div>
      </div>
    </div>
  );
}
