/**
 * @fileoverview Add New Task modal form triggered from the main workspace.
 *
 * Opens when the user clicks "Add New Task" without navigating away from the
 * main screen. Supports task title, optional description, classification
 * selection (with assigned category color preview), due date & time, and
 * duplicate/empty validation.
 */

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import type { ClassificationColor } from "../types/task";
import { getClassificationColorMeta } from "./ClassificationModal";

export interface AddTaskPayload {
  title: string;
  description: string;
  classification: string;
  dueDate: string;
  dueTime: string;
}

interface AddTaskFormProps {
  isOpen: boolean;
  classifications: string[];
  classificationColors: Record<string, ClassificationColor>;
  onClose: () => void;
  onAddTask: (payload: AddTaskPayload) => { ok: boolean; error?: string };
}

export const AddTaskForm: React.FC<AddTaskFormProps> = ({
  isOpen,
  classifications,
  classificationColors,
  onClose,
  onAddTask,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classification, setClassification] = useState(
    classifications[0] || "Work"
  );
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!classifications.includes(classification) && classifications.length > 0) {
      setClassification(classifications[0]);
    }
  }, [classifications, classification]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormError(null);
    const focusTimer = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const selectedColorMeta = getClassificationColorMeta(
    classification,
    classificationColors
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      setFormError("Task name cannot be empty. Please enter a task title.");
      return;
    }

    const result = onAddTask({
      title: title.trim(),
      description: description.trim(),
      classification: classification.trim() || "Work",
      dueDate,
      dueTime,
    });

    if (!result.ok) {
      setFormError(result.error || "Unable to add task.");
      return;
    }

    setTitle("");
    setDescription("");
    setDueDate("");
    setDueTime("");
    setFormError(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-task-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
    >
      <section className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-blue-200/80 bg-white p-5 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-blue-100">
          <div>
            <h2
              id="add-task-heading"
              className="font-display text-lg font-semibold text-slate-900"
            >
              Add New Task
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Starts as pending and saves automatically.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add New Task dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {formError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm text-red-800"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {/* Task Title */}
          <div>
            <label
              htmlFor="task-title-input"
              className="block text-xs font-medium text-slate-700"
            >
              Task Name <span className="text-red-600">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="task-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="e.g., Prepare sprint review slides"
              maxLength={140}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
            />
          </div>

          {/* Optional Description */}
          <div>
            <label
              htmlFor="task-description-input"
              className="block text-xs font-medium text-slate-700"
            >
              Description{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="task-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add helpful context, steps, or notes..."
              maxLength={400}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
            />
          </div>

          {/* Classification */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="task-classification-select"
                className="block text-xs font-medium text-slate-700"
              >
                Classification
              </label>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className={`h-2.5 w-2.5 rounded-xs ${selectedColorMeta.swatchClass}`}
                  aria-hidden="true"
                />
                <span>{classification}</span>
              </span>
            </div>
            <select
              id="task-classification-select"
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
            >
              {classifications.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date & Due Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-due-date-input"
                className="block text-xs font-medium text-slate-700"
              >
                Due Date
              </label>
              <input
                id="task-due-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 font-mono focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="task-due-time-input"
                className="block text-xs font-medium text-slate-700"
              >
                Due Time
              </label>
              <input
                id="task-due-time-input"
                type="time"
                value={dueTime}
                onChange={(e) => {
                  setDueTime(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 font-mono focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-blue-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Task
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
