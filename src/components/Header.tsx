/**
 * @fileoverview Top navigation bar adhering to the 3-zone header contract.
 *
 * Zone 1: Brand wordmark
 * Zone 2: Single-line workspace & documentation links
 * Zone 3: Primary AI Helper trigger button
 */

import React from "react";
import type { ActiveWorkspaceView } from "../types/task";

interface HeaderProps {
  activeView: ActiveWorkspaceView;
  recycleBinCount: number;
  onSelectView: (view: ActiveWorkspaceView) => void;
  onOpenDocs: (initialTab: "modules" | "privacy") => void;
  onOpenAiHelper: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  recycleBinCount,
  onSelectView,
  onOpenDocs,
  onOpenAiHelper,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-blue-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element wordmark */}
        <button
          type="button"
          onClick={() => onSelectView("tasks")}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
        >
          Task Manager
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-4 sm:gap-7 text-sm font-medium text-slate-600 overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => onSelectView("tasks")}
            aria-current={activeView === "tasks" ? "page" : undefined}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
              activeView === "tasks"
                ? "border-blue-600 text-blue-950 font-semibold"
                : "border-transparent hover:text-slate-900 hover:border-blue-300"
            }`}
          >
            Tasks
          </button>

          <button
            type="button"
            onClick={() => onSelectView("recycleBin")}
            aria-current={activeView === "recycleBin" ? "page" : undefined}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 tabular-nums ${
              activeView === "recycleBin"
                ? "border-blue-600 text-blue-950 font-semibold"
                : "border-transparent hover:text-slate-900 hover:border-blue-300"
            }`}
          >
            Recycle Bin ({recycleBinCount})
          </button>

          <button
            type="button"
            onClick={() => onOpenDocs("modules")}
            className="hidden sm:inline-block whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 hover:border-blue-300 transition-colors"
          >
            Module Docs
          </button>

          <button
            type="button"
            onClick={() => onOpenDocs("privacy")}
            className="hidden sm:inline-block whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 hover:border-blue-300 transition-colors"
          >
            Privacy
          </button>
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenAiHelper}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            AI Helper
          </button>
        </div>
      </div>
    </header>
  );
};
