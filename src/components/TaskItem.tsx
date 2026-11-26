/**
 * @fileoverview Single task row component supporting completion toggling,
 * unboxed metadata with category color indicator, per-task progress
 * percentage, inline editing, and soft deletion into the Recycle Bin.
 */

import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { ClassificationColor, Task } from "../types/task";
import {
  formatDueSchedule,
  getTaskUrgencyTier,
  isTaskOverdue,
} from "../utils/taskHelpers";
import { getClassificationColorMeta } from "./ClassificationModal";

export interface UpdateTaskPayload {
  id: string;
  title: string;
  description: string;
  classification: string;
  dueDate: string;
  dueTime: string;
}

interface TaskItemProps {
  task: Task;
  classifications: string[];
  classificationColors: Record<string, ClassificationColor>;
  onToggleComplete: (taskId: string) => void;
  onUpdateTask: (payload: UpdateTaskPayload) => { ok: boolean; error?: string };
  onDeleteTask: (taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  classifications,
  classificationColors,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description);
  const [editClassification, setEditClassification] = useState(
    task.classification
  );
  const [editDueDate, setEditDueDate] = useState(task.dueDate);
  const [editDueTime, setEditDueTime] = useState(task.dueTime);
  const [editError, setEditError] = useState<string | null>(null);

  const isCompleted = task.status === "completed";
  const overdue = isTaskOverdue(task);
  const urgencyTier = getTaskUrgencyTier(task);
  const isUrgent = !isCompleted && urgencyTier <= 2;
  const colorMeta = getClassificationColorMeta(
    task.classification,
    classificationColors
  );

  const startEditing = () => {
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditClassification(task.classification);
    setEditDueDate(task.dueDate);
    setEditDueTime(task.dueTime);
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleSaveEdit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!editTitle.trim()) {
      setEditError("Task name cannot be empty. Original task preserved.");
      return;
    }

    const result = onUpdateTask({
      id: task.id,
      title: editTitle.trim(),
      description: editDescription.trim(),
      classification: editClassification,
      dueDate: editDueDate,
      dueTime: editDueTime,
    });

    if (!result.ok) {
      setEditError(result.error || "Update failed. Original task preserved.");
      return;
    }

    setIsEditing(false);
    setEditError(null);
  };

  if (isEditing) {
    return (
      <li className="bg-blue-50/60 p-4 sm:p-5">
        <form onSubmit={handleSaveEdit} noValidate className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-blue-950">
              Editing Task
            </span>
            <button
              type="button"
              onClick={cancelEditing}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel &amp; keep original
            </button>
          </div>

          {editError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label
                htmlFor={`edit-title-${task.id}`}
                className="block text-xs font-medium text-slate-700"
              >
                Task Name
              </label>
              <input
                id={`edit-title-${task.id}`}
                type="text"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  if (editError) setEditError(null);
                }}
                maxLength={140}
                className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor={`edit-classification-${task.id}`}
                className="block text-xs font-medium text-slate-700"
              >
                Classification
              </label>
              <select
                id={`edit-classification-${task.id}`}
                value={editClassification}
                onChange={(e) => setEditClassification(e.target.value)}
                className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                {classifications.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor={`edit-date-${task.id}`}
                className="block text-xs font-medium text-slate-700"
              >
                Due Date
              </label>
              <input
                id={`edit-date-${task.id}`}
                type="date"
                value={editDueDate}
                onChange={(e) => {
                  setEditDueDate(e.target.value);
                  if (editError) setEditError(null);
                }}
                className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-2.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor={`edit-time-${task.id}`}
                className="block text-xs font-medium text-slate-700"
              >
                Due Time
              </label>
              <input
                id={`edit-time-${task.id}`}
                type="time"
                value={editDueTime}
                onChange={(e) => {
                  setEditDueTime(e.target.value);
                  if (editError) setEditError(null);
                }}
                className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-2.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={`edit-desc-${task.id}`}
              className="block text-xs font-medium text-slate-700"
            >
              Description
            </label>
            <input
              id={`edit-desc-${task.id}`}
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional task description"
              maxLength={400}
              className="mt-1 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cancelEditing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Save Changes
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`group flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5 transition-colors ${
        isCompleted
          ? "bg-sky-50/45 hover:bg-sky-50/70"
          : "bg-white hover:bg-blue-50/35"
      }`}
    >
      {/* Left: Checkbox + Task Details */}
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div className="pt-0.5 shrink-0">
          <input
            id={`task-checkbox-${task.id}`}
            type="checkbox"
            checked={isCompleted}
            onChange={() => onToggleComplete(task.id)}
            aria-label={
              isCompleted
                ? `Uncheck "${task.title}" to return to pending status`
                : `Mark "${task.title}" as completed`
            }
            className="h-5 w-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer accent-blue-600"
          />
        </div>

        <div className="min-w-0 flex-1">
          <label
            htmlFor={`task-checkbox-${task.id}`}
            className={`block text-sm sm:text-base font-medium cursor-pointer break-words ${
              isCompleted ? "line-through text-slate-400" : "text-slate-900"
            }`}
          >
            {task.title}
          </label>

          {task.description ? (
            <p
              className={`mt-1 text-sm leading-relaxed break-words ${
                isCompleted ? "text-slate-400" : "text-slate-600"
              }`}
            >
              {task.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400 italic">
              No description provided
            </p>
          )}

          {/* Clean Unboxed Metadata Row with Assigned Classification Color */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${colorMeta.textClass}`}>
              <span
                className={`h-2.5 w-2.5 rounded-xs shrink-0 ${colorMeta.swatchClass}`}
                aria-hidden="true"
              />
              <span>{task.classification}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={
                overdue
                  ? "font-semibold text-red-700"
                  : isUrgent
                  ? "font-semibold text-amber-700"
                  : "text-slate-500"
              }
            >
              {formatDueSchedule(task.dueDate, task.dueTime)}
              {overdue
                ? " (Urgent · Overdue)"
                : urgencyTier === 1
                ? " (Urgent · Due today)"
                : urgencyTier === 2
                ? " (Urgent · Due tomorrow)"
                : ""}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={
                isCompleted
                  ? "font-medium text-emerald-700"
                  : "font-medium text-amber-700"
              }
            >
              {isCompleted ? "Completed" : "Pending"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-700">
              Progress: {task.progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Right: Edit & Delete Controls */}
      <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pl-8 sm:pl-0">
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Edit task "${task.title}"`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50/70 hover:text-blue-900 transition-colors whitespace-nowrap shrink-0"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>

        <button
          type="button"
          onClick={() => onDeleteTask(task.id)}
          aria-label={`Delete task "${task.title}"`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>
    </li>
  );
};
