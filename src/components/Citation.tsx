"use client";

import { useState, useRef, useEffect } from "react";

export type CitationItem = {
  id: string;
  /** Context block number from the model ([#1], [#2], ...); used for display. */
  number?: number;
  sourcePath: string;
  startLine: number;
  endLine: number;
  content?: string;
  viewUrl?: string | null;
  heading?: string;
};

export function Citation({ citation, index }: { citation: CitationItem; index: number }) {
  const [showPreview, setShowPreview] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const label = citation.heading
    ? `${citation.heading} (${citation.sourcePath}:${citation.startLine}-${citation.endLine})`
    : `${citation.sourcePath}:${citation.startLine}-${citation.endLine}`;

  useEffect(() => {
    if (!showPreview) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowPreview(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPreview]);

  const linkClass =
    "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-primary-600 underline decoration-primary-600/50 decoration-1 underline-offset-2 hover:bg-primary-600/10 hover:decoration-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30";

  return (
    <span ref={wrapperRef} className="relative inline-block">
      {citation.viewUrl ? (
        <a
          href={citation.viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={() => setShowPreview(false)}
          className={linkClass}
          title={label}
        >
          [{citation.number ?? index + 1}]
        </a>
      ) : (
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={() => setShowPreview(false)}
          className={linkClass}
          title={label}
        >
          [{citation.number ?? index + 1}]
        </button>
      )}
      {showPreview && (
        <div
          className="absolute bottom-full left-0 z-50 mb-1 w-80 max-w-[90vw] rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={() => setShowPreview(false)}
        >
          <div className="mb-1.5 truncate text-xs font-medium text-gray-500" title={citation.sourcePath}>
            {citation.heading ? (
              <>
                <span className="text-primary-600">{citation.heading}</span>
                <span className="ml-1 text-gray-400">— {citation.sourcePath}</span>
              </>
            ) : (
              citation.sourcePath
            )}
          </div>
          <div className="text-xs text-gray-700 line-clamp-6 whitespace-pre-wrap">
            {citation.content || `Lines ${citation.startLine}–${citation.endLine}`}
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">
            L{citation.startLine}–L{citation.endLine}
          </div>
        </div>
      )}
    </span>
  );
}
