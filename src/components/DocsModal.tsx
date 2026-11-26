/**
 * @fileoverview In-app Module Documentation & Data Privacy reference modal.
 */

import React, { useEffect, useState } from "react";
import { BookOpen, ShieldCheck, X } from "lucide-react";

interface DocsModalProps {
  isOpen: boolean;
  initialTab: "modules" | "privacy";
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({
  isOpen,
  initialTab,
  onClose,
}) => {
  const [tab, setTab] = useState<"modules" | "privacy">(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="docs-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            {tab === "modules" ? (
              <BookOpen className="h-5 w-5 text-blue-700" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            )}
            <h2
              id="docs-modal-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              {tab === "modules"
                ? "Internal Modules & API Reference"
                : "Data Privacy & Local-First Security"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close documentation modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-6 py-2.5">
          <button
            type="button"
            onClick={() => setTab("modules")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "modules"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Modules &amp; APIs
          </button>
          <button
            type="button"
            onClick={() => setTab("privacy")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "privacy"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Privacy &amp; Security
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700 space-y-4">
          {tab === "modules" ? (
            <>
              <p>
                Task Manager is structured into independent, single-responsibility modules so each task management feature can be maintained or extended cleanly:
              </p>

              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                <div className="p-3.5">
                  <p className="font-mono text-xs font-semibold text-slate-900">
                    src/types/task.ts
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Canonical TypeScript contracts for <code className="font-mono">Task</code>, <code className="font-mono">RecycledTask</code>, <code className="font-mono">TaskFilterState</code>, <code className="font-mono">TaskMetrics</code>, and <code className="font-mono">PersistedTaskLedgerState</code>.
                  </p>
                </div>

                <div className="p-3.5">
                  <p className="font-mono text-xs font-semibold text-slate-900">
                    src/utils/storage.ts
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Browser persistence layer (<code className="font-mono">loadWorkspaceState</code>, <code className="font-mono">saveWorkspaceState</code>) validating and saving tasks, classifications, and Recycle Bin items to <code className="font-mono">localStorage</code>.
                  </p>
                </div>

                <div className="p-3.5">
                  <p className="font-mono text-xs font-semibold text-slate-900">
                    src/utils/taskHelpers.ts
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Pure domain utilities: <code className="font-mono">findDuplicateTask</code> (checks title + due date + due time), <code className="font-mono">filterTasks</code> (all 5 filter modes), <code className="font-mono">calculateTaskMetrics</code>, and <code className="font-mono">formatDueSchedule</code>.
                  </p>
                </div>

                <div className="p-3.5">
                  <p className="font-mono text-xs font-semibold text-slate-900">
                    POST /api/ai-helper (server.ts)
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Server-side Express endpoint invoking <code className="font-mono">@google/genai</code> (<code className="font-mono">gemini-4-hydrogen</code>) for user-submitted productivity inquiries while keeping the API key exclusively on the server.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <p className="font-semibold text-sm">
                  Local-First Task Storage
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  All tasks, descriptions, classifications, due dates, and Recycle Bin items are stored exclusively inside your browser&apos;s <code className="font-mono">localStorage</code> under key <code className="font-mono">taskledger_workspace_v1</code>.
                </p>
              </div>

              <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
                <li>
                  <strong className="text-slate-900">Zero task transmission:</strong> Your task list is never uploaded to external databases, analytics services, or public endpoints.
                </li>
                <li>
                  <strong className="text-slate-900">Isolated AI Helper:</strong> When you voluntarily ask a question in the AI Helper Chatbox, only the message you type in the chatbox is sent to <code className="font-mono">/api/ai-helper</code>—never your saved tasks.
                </li>
                <li>
                  <strong className="text-slate-900">Safe deletion lifecycle:</strong> Deleted tasks move to the Recycle Bin first, and permanent deletions always require explicit confirmation.
                </li>
              </ul>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
