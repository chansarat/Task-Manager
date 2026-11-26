/**
 * @fileoverview Recycle Bin view implementing FR9.
 *
 * Allows users to inspect soft-deleted tasks, restore tasks back to the active
 * To-Do list, permanently delete an individual task, or select multiple tasks
 * for simultaneous permanent deletion—always requesting confirmation before
 * permanent removal.
 */

import React, { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import type { ClassificationColor, RecycledTask } from "../types/task";
import { formatDueSchedule, formatTimestamp } from "../utils/taskHelpers";
import { getClassificationColorMeta } from "./ClassificationModal";

interface RecycleBinViewProps {
  items: RecycledTask[];
  classificationColors: Record<string, ClassificationColor>;
  onRestoreTask: (taskId: string) => void;
  onRequestPermanentDeleteSingle: (task: RecycledTask) => void;
  onRequestPermanentDeleteMultiple: (taskIds: string[]) => void;
  onBackToTasks: () => void;
}

export const RecycleBinView: React.FC<RecycleBinViewProps> = ({
  items,
  classificationColors,
  onRestoreTask,
  onRequestPermanentDeleteSingle,
  onRequestPermanentDeleteMultiple,
  onBackToTasks,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const validSelectedIds = useMemo(() => {
    const existing = new Set(items.map((item) => item.id));
    return selectedIds.filter((id) => existing.has(id));
  }, [items, selectedIds]);

  const allSelected =
    items.length > 0 && validSelectedIds.length === items.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  };

  const toggleSelectItem = (taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <section
      aria-labelledby="recycle-bin-heading"
      className="space-y-4"
    >
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-blue-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(30,58,138,0.04),0_6px_18px_-6px_rgba(37,99,235,0.08)]">
        <div>
          <div className="flex items-center gap-3">
            <h2
              id="recycle-bin-heading"
              className="font-display text-lg font-semibold text-slate-900"
            >
              Recycle Bin
            </h2>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Deleted tasks are held here before permanent removal. Restore items anytime or select tasks to permanently delete.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToTasks}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50/60 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Tasks
          </button>

          <button
            type="button"
            disabled={validSelectedIds.length === 0}
            onClick={() => onRequestPermanentDeleteMultiple(validSelectedIds)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete Selected ({validSelectedIds.length})
          </button>
        </div>
      </div>

      {/* Empty Recycle Bin */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-blue-200/80 bg-white px-6 py-14 text-center shadow-[0_1px_3px_rgba(30,58,138,0.04),0_6px_18px_-6px_rgba(37,99,235,0.08)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold text-slate-900">
            Recycle Bin is empty
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 leading-relaxed">
            When you delete tasks from your To-Do List, they move here safely until you restore or permanently remove them.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-blue-200/80 bg-white shadow-[0_1px_3px_rgba(30,58,138,0.04),0_6px_18px_-6px_rgba(37,99,235,0.08)] overflow-hidden">
          {/* Select All header row */}
          <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/60 px-4 py-3 sm:px-5">
            <label className="inline-flex items-center gap-3 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
              />
              <span>
                {allSelected ? "Deselect all" : "Select all"} ({items.length})
              </span>
            </label>

            {validSelectedIds.length > 0 && (
              <span className="text-xs text-slate-600 tabular-nums">
                {validSelectedIds.length} selected for deletion
              </span>
            )}
          </div>

          <ul className="divide-y divide-blue-100">
            {items.map((item) => {
              const checked = validSelectedIds.includes(item.id);
              const colorMeta = getClassificationColorMeta(
                item.classification,
                classificationColors
              );
              return (
                <li
                  key={item.id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5 transition-colors ${
                    checked ? "bg-red-50/40" : "hover:bg-blue-50/35"
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="pt-0.5 shrink-0">
                      <input
                        id={`bin-select-${item.id}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectItem(item.id)}
                        aria-label={`Select "${item.title}" in Recycle Bin`}
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`bin-select-${item.id}`}
                        className="block text-sm sm:text-base font-medium text-slate-900 cursor-pointer break-words"
                      >
                        {item.title}
                      </label>

                      {item.description && (
                        <p className="mt-1 text-sm text-slate-600 break-words">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${colorMeta.textClass}`}>
                          <span
                            className={`h-2.5 w-2.5 rounded-xs shrink-0 ${colorMeta.swatchClass}`}
                            aria-hidden="true"
                          />
                          <span>{item.classification}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDueSchedule(item.dueDate, item.dueTime)}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Previous status:{" "}
                          {item.status === "completed" ? "Completed" : "Pending"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Deleted {formatTimestamp(item.deletedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pl-7 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => onRestoreTask(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50/70 hover:text-blue-900 transition-colors whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Restore
                    </button>

                    <button
                      type="button"
                      onClick={() => onRequestPermanentDeleteSingle(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete Forever
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
