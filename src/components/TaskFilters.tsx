/**
 * @fileoverview 5-mode task filter toolbar and Clear Completed action.
 *
 * Implements FR3 (All Tasks, Pending Tasks, Completed Tasks, Due Date,
 * Classification) and the Clear Completed Tasks action with confirmation trigger.
 */

import React from "react";
import { Trash2 } from "lucide-react";
import type {
  DueDateFilterPreset,
  TaskFilterMode,
  TaskFilterState,
} from "../types/task";

interface TaskFiltersProps {
  filter: TaskFilterState;
  classifications: string[];
  completedCount: number;
  visibleCount: number;
  totalCount: number;
  onFilterChange: (next: TaskFilterState) => void;
  onRequestClearCompleted: () => void;
}

const FILTER_TABS: ReadonlyArray<{ mode: TaskFilterMode; label: string }> = [
  { mode: "all", label: "All Tasks" },
  { mode: "pending", label: "Pending Tasks" },
  { mode: "completed", label: "Completed Tasks" },
  { mode: "dueDate", label: "Due Date" },
  { mode: "classification", label: "Classification" },
];

const DUE_DATE_PRESETS: ReadonlyArray<{
  value: DueDateFilterPreset;
  label: string;
}> = [
  { value: "all_scheduled", label: "All Scheduled" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "no_date", label: "No Due Date" },
  { value: "specific_date", label: "Specific Date" },
];

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  filter,
  classifications,
  completedCount,
  visibleCount,
  totalCount,
  onFilterChange,
  onRequestClearCompleted,
}) => {
  const handleModeChange = (mode: TaskFilterMode) => {
    onFilterChange({
      ...filter,
      mode,
    });
  };

  return (
    <section
      aria-label="Filter tasks"
      className="rounded-2xl border border-blue-200/80 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(30,58,138,0.04),0_6px_18px_-6px_rgba(37,99,235,0.08)] space-y-3.5"
    >
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        {/* 5 Filter Categories */}
        <div
          role="tablist"
          aria-label="Task filter categories"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-blue-50/90 p-1 border border-blue-100"
        >
          {FILTER_TABS.map((tab) => {
            const isActive = filter.mode === tab.mode;
            return (
              <button
                key={tab.mode}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleModeChange(tab.mode)}
                className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-white text-blue-950 shadow-xs"
                    : "text-slate-600 hover:text-blue-950"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right side: visible count + Clear Completed */}
        <div className="flex items-center justify-between xl:justify-end gap-3">
          <span className="text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap shrink-0">
            Showing {visibleCount} of {totalCount}
          </span>

          <button
            type="button"
            disabled={completedCount === 0}
            onClick={onRequestClearCompleted}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear Completed ({completedCount})
          </button>
        </div>
      </div>

      {/* Conditional Secondary Controls for Due Date or Classification */}
      {filter.mode === "dueDate" && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-blue-100">
          <span className="text-xs font-medium text-slate-500 mr-1">
            Due date filter:
          </span>
          {DUE_DATE_PRESETS.map((preset) => {
            const active = filter.dueDatePreset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  onFilterChange({
                    ...filter,
                    dueDatePreset: preset.value,
                  })
                }
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-blue-50/40"
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          {filter.dueDatePreset === "specific_date" && (
            <label className="inline-flex items-center gap-2 ml-1">
              <span className="sr-only">Pick a specific due date</span>
              <input
                type="date"
                value={filter.specificDate}
                onChange={(e) =>
                  onFilterChange({
                    ...filter,
                    specificDate: e.target.value,
                  })
                }
                className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </label>
          )}
        </div>
      )}

      {filter.mode === "classification" && (
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-blue-100">
          <label
            htmlFor="filter-classification-select"
            className="text-xs font-medium text-slate-500"
          >
            Classification filter:
          </label>
          <select
            id="filter-classification-select"
            value={filter.selectedClassification}
            onChange={(e) =>
              onFilterChange({
                ...filter,
                selectedClassification: e.target.value,
              })
            }
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="__ALL__">All Classifications</option>
            {classifications.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
};
