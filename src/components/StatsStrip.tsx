/**
 * @fileoverview 4-column task summary metrics strip and progress bar.
 *
 * Displays Total Tasks, Pending Tasks, Completed Tasks, and overall Progress
 * Percentage using bold section labels and tabular numerals.
 */

import React from "react";
import type { TaskMetrics } from "../types/task";

interface StatsStripProps {
  metrics: TaskMetrics;
}

export const StatsStrip: React.FC<StatsStripProps> = ({ metrics }) => {
  return (
    <section
      aria-label="Task progress summary"
      className="rounded-xl border border-blue-200/80 bg-white shadow-[0_1px_3px_rgba(30,58,138,0.04),0_4px_12px_-6px_rgba(37,99,235,0.08)] overflow-hidden"
    >
      <div className="grid grid-cols-2 divide-y divide-blue-100 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        <div className="px-4 py-3 sm:px-5 sm:py-3.5">
          <p className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
            Total Tasks
          </p>
          <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.total}
          </p>
        </div>

        <div className="px-4 py-3 sm:px-5 sm:py-3.5">
          <p className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
            Pending Tasks
          </p>
          <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-amber-700 tabular-nums">
            {metrics.pending}
          </p>
        </div>

        <div className="px-4 py-3 sm:px-5 sm:py-3.5">
          <p className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
            Completed Tasks
          </p>
          <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-emerald-700 tabular-nums">
            {metrics.completed}
          </p>
        </div>

        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-blue-50/40">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs sm:text-sm font-bold text-blue-950 whitespace-nowrap">
              Progress
            </p>
            <span className="font-mono text-xs text-blue-800/75 tabular-nums whitespace-nowrap">
              {metrics.completed}/{metrics.total}
            </span>
          </div>
          <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-blue-700 tabular-nums">
            {metrics.progressPercentage}%
          </p>
        </div>
      </div>

      {/* Overall progress track */}
      <div
        role="progressbar"
        aria-valuenow={metrics.progressPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Overall task completion ${metrics.progressPercentage}%`}
        className="h-1.5 w-full bg-blue-100/80 border-t border-blue-100"
      >
        <div
          className="h-full bg-blue-600 transition-all duration-200 ease-out"
          style={{ width: `${metrics.progressPercentage}%` }}
        />
      </div>
    </section>
  );
};
