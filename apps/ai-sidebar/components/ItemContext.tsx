"use client";

import type { ItemDetails } from "@/lib/types";

interface ItemContextProps {
  item: ItemDetails;
  language: string;
}

export function ItemContext({ item, language }: ItemContextProps) {
  const typeColors: Record<string, string> = {
    product: "bg-cyan-50 text-cyan-700 border-cyan-200",
    document: "bg-blue-50 text-blue-700 border-blue-200",
    folder: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <section className="rounded-xl bg-white border border-gray-100 shadow-[0_1px_0_rgba(0,0,0,0.02)] overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <svg className="w-3.5 h-3.5 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="text-[11px] font-medium text-gray-500">Item</span>
        <span className="ml-auto text-[11px] text-gray-400">
          {item.shape.name}
          <span className="text-gray-300 ml-1">({item.shape.identifier})</span>
        </span>
      </header>
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-gray-900 truncate tracking-tight">
              {item.name}
            </h2>
            <p className="text-xs text-gray-500 truncate mt-1">{item.path}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`c-tag ${typeColors[item.type] || ""}`}
            >
              {item.type}
            </span>
            <span className="c-tag">
              {language}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
