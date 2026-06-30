import React from "react";
import { DdcClassification } from "../types";
import { ShieldCheck, HelpCircle, Layers, ArrowRight, Compass } from "lucide-react";

interface DdcBreakdownProps {
  ddc: DdcClassification;
}

export default function DdcBreakdown({ ddc }: DdcBreakdownProps) {
  // Determine color theme based on certainty
  const getCertaintyColor = (pct: number) => {
    if (pct >= 85) return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500" };
    if (pct >= 60) return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500" };
    return { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", bar: "bg-rose-500" };
  };

  const colors = getCertaintyColor(ddc.certainty);

  return (
    <div id="ddc-breakdown" className="flex flex-col space-y-6">
      {/* Classification Showcase Banner */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-lg p-5 sm:p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg text-amber-400">
            <Compass className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 font-semibold">
              Assigned Dewey Classification
            </div>
            <div className="text-3xl font-extrabold tracking-tight font-sans text-white mt-1">
              {ddc.number}
            </div>
            <div className="text-xs text-zinc-300 mt-1 font-medium italic">
              {ddc.classTitle}
            </div>
          </div>
        </div>

        {/* Confidence rating */}
        <div className={`flex flex-col items-end p-3 rounded-lg border ${colors.bg} ${colors.border} w-full md:w-auto`}>
          <div className="flex items-center space-x-1.5 self-start md:self-auto">
            {ddc.certainty >= 85 ? (
              <ShieldCheck className={`h-4 w-4 ${colors.text}`} />
            ) : (
              <HelpCircle className={`h-4 w-4 ${colors.text}`} />
            )}
            <span className={`text-[11px] font-bold uppercase tracking-wider ${colors.text}`}>
              {ddc.certainty >= 85 ? "Verified Match" : ddc.certainty >= 60 ? "High Likelihood" : "Algorithmic Suggestion"}
            </span>
          </div>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className={`text-2xl font-black font-mono leading-none ${colors.text}`}>
              {ddc.certainty}%
            </span>
            <span className="text-[10px] text-zinc-500 font-medium font-sans">certainty</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full md:w-36 h-1.5 bg-zinc-200 rounded-full mt-2 overflow-hidden">
            <div className={`h-full ${colors.bar}`} style={{ width: `${ddc.certainty}%` }}></div>
          </div>
        </div>
      </div>

      {/* Hierarchical Class Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-zinc-800">
          <Layers className="h-4 w-4 text-zinc-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 font-sans">
            DDC Class Hierarchy
          </h3>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200/60 divide-y divide-zinc-150 shadow-xs">
          {ddc.breakdown.map((item, index) => (
            <div
              key={index}
              className="p-3.5 flex items-start sm:items-center justify-between hover:bg-zinc-50/40 transition gap-4"
            >
              <div className="flex items-start sm:items-center space-x-3.5">
                <div className="bg-zinc-100 px-2.5 py-1 rounded font-mono text-xs font-bold text-zinc-700 w-16 text-center shadow-xs flex-shrink-0">
                  {item.code}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                    {item.level}
                  </div>
                  <div className="text-sm font-medium text-zinc-800 mt-0.5">
                    {item.name}
                  </div>
                </div>
              </div>
              {index < ddc.breakdown.length - 1 && (
                <div className="hidden sm:block text-zinc-300 pr-2">
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cataloger's Technical Justification */}
      <div className="bg-zinc-50 border border-zinc-200/60 rounded-lg p-4 sm:p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-2 font-mono">
          Bibliographic Justification & Notes
        </h4>
        <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
          {ddc.explanation}
        </p>
      </div>
    </div>
  );
}
