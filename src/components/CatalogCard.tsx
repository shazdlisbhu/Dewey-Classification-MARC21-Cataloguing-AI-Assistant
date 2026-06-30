import React, { useRef } from "react";
import { CatalogCardData } from "../types";
import { Copy, Check, Printer } from "lucide-react";

interface CatalogCardProps {
  card: CatalogCardData;
  callNumber?: string;
}

export default function CatalogCard({ card, callNumber }: CatalogCardProps) {
  const [copied, setCopied] = React.useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    const text = `${callNumber ? callNumber + "\n" : ""}${card.mainEntry}\n   ${card.body}\n\n   ${card.tracings.join("  ")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printContent = cardRef.current?.innerHTML;
    if (!printContent) return;
    
    const win = window.open("", "_blank");
    if (!win) return;
    
    win.document.write(`
      <html>
        <head>
          <title>Print Catalog Card</title>
          <style>
            body {
              font-family: 'Georgia', 'Times New Roman', serif;
              padding: 40px;
              display: flex;
              justify-content: center;
              background-color: #fff;
            }
            .card {
              width: 5in;
              height: 3in;
              border: 1px solid #999;
              padding: 24px;
              position: relative;
              box-sizing: border-box;
              font-size: 11pt;
              line-height: 1.4;
            }
            .call-number {
              position: absolute;
              left: 24px;
              top: 24px;
              font-weight: bold;
              width: 80px;
            }
            .content {
              margin-left: 90px;
            }
            .main-entry {
              font-weight: bold;
              margin-bottom: 4px;
            }
            .body-text {
              text-indent: -18px;
              padding-left: 18px;
              margin-bottom: 12px;
            }
            .tracings {
              font-size: 9.5pt;
              margin-top: 16px;
            }
            .punch-hole {
              position: absolute;
              bottom: 12px;
              left: 50%;
              transform: translateX(-50%);
              width: 14px;
              height: 14px;
              border: 1px solid #999;
              border-radius: 50%;
            }
          </style>
        </head>
        <body>
          <div class="card">
            ${callNumber ? `<div class="call-number">${callNumber.replace(/\s+/g, "<br/>")}</div>` : ""}
            <div class="content">
              <div class="main-entry">${card.mainEntry}</div>
              <div class="body-text">${card.body}</div>
              <div class="tracings">${card.tracings.join(" &nbsp; ")}</div>
            </div>
            <div class="punch-hole"></div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div id="catalog-card-container" className="flex flex-col space-y-4">
      <div className="flex justify-between items-center bg-zinc-50 border-b border-zinc-200/60 p-3 px-4">
        <div className="flex items-center space-x-2">
          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
          <span className="text-xs font-semibold text-zinc-700 tracking-wider uppercase font-mono">
            AACR2 Catalog Card (5" x 3" Standard)
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition bg-white border border-zinc-200 px-2.5 py-1 rounded shadow-xs cursor-pointer"
            title="Copy card text"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Text</span>
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition bg-white border border-zinc-200 px-2.5 py-1 rounded shadow-xs cursor-pointer"
            title="Print library card"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Card</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-zinc-100/50 flex justify-center overflow-x-auto">
        {/* Physical Index Card Simulation */}
        <div
          ref={cardRef}
          className="relative bg-[#fcf9f2] text-zinc-800 border border-zinc-300 rounded-xs shadow-md p-6 font-serif select-text transition-all duration-300 flex-shrink-0"
          style={{
            width: "550px",
            minHeight: "330px",
            backgroundImage: "linear-gradient(#e5e5e5 1px, transparent 1px)",
            backgroundSize: "100% 24px",
            backgroundPosition: "0 46px"
          }}
        >
          {/* Red line matching standard cards */}
          <div className="absolute left-24 top-0 bottom-0 w-[1px] bg-red-200 pointer-events-none"></div>

          {/* Call Number / DDC in the top left gutter */}
          {callNumber && (
            <div className="absolute left-4 top-10 text-sm font-semibold leading-tight font-sans tracking-wide text-zinc-700 max-w-[70px] break-words">
              {callNumber.split(" ").map((part, idx) => (
                <div key={idx}>{part}</div>
              ))}
            </div>
          )}

          {/* Core Content Area */}
          <div className="pl-20 pr-4 pt-4 text-xs sm:text-[13px] leading-relaxed select-all">
            {/* Main Entry (usually Author) */}
            <div className="font-bold mb-2 tracking-normal text-zinc-900" style={{ minHeight: "20px" }}>
              {card.mainEntry}
            </div>

            {/* Title / Description paragraph */}
            <div className="pl-6 -indent-6 text-zinc-800 mb-4 whitespace-pre-wrap">
              {card.body}
            </div>

            {/* Tracings / Subject headings index at the bottom */}
            <div className="text-[11px] leading-relaxed text-zinc-600 mt-6 pt-4 border-t border-dotted border-zinc-300">
              {card.tracings.join("  ")}
            </div>
          </div>

          {/* Simulated punch hole at bottom center */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-zinc-100/50 border border-zinc-300/80 flex items-center justify-center pointer-events-none shadow-inner">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-200"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
