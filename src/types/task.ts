/**
 * @fileoverview Core domain types and interfaces for TaskLedger.
 *
 * Defines the canonical shapes for active tasks, deleted tasks in the
 * Recycle Bin, filter states across all 5 supported categories, workspace
 * metrics, save confirmation banners, and AI Helper chat messages.
 */

/**
 * Represents a single To-Do item managed locally in the browser.
 */
export interface Task {
  /** Unique immutable task identifier (UUID or timestamp-based ID). */
  id: string;
  /** Required non-empty task title. */
  title: string;
  /** Optional detailed task description. */
  description: string;
  /** Classification / category label assigned to the task. */
  classification: string;
  /** Optional ISO date string (`YYYY-MM-DD`). Empty string if unscheduled. */
  dueDate: string;
  /** Optional 24-hour time string (`HH:mm`). Empty string if unspecified. */
  dueTime: string;
  /** Completion status (`pending` by default when created). */
  status: "pending" | "completed";
  /** Per-task completion progress percentage (`0` when pending, `100` when completed). */
  progress: number;
  /** ISO timestamp when the task was created. */
  createdAt: string;
  /** ISO timestamp when the task was last updated. */
  updatedAt: string;
}

/**
 * Represents a soft-deleted task stored in the Recycle Bin.
 */
export interface RecycledTask extends Task {
  /** ISO timestamp when the task was moved to the Recycle Bin. */
  deletedAt: string;
}

/**
 * The five top-level filter categories required by FR3.
 */
export type TaskFilterMode =
  | "all"
  | "pending"
  | "completed"
  | "dueDate"
  | "classification";

/**
 * Secondary date presets available when `TaskFilterMode` is `"dueDate"`.
 */
export type DueDateFilterPreset =
  | "all_scheduled"
  | "today"
  | "upcoming"
  | "overdue"
  | "no_date"
  | "specific_date";

/**
 * Active filter configuration applied to the visible To-Do list.
 */
export interface TaskFilterState {
  mode: TaskFilterMode;
  dueDatePreset: DueDateFilterPreset;
  specificDate: string;
  selectedClassification: string;
}

/**
 * Aggregate progress and count statistics displayed on the main dashboard.
 */
export interface TaskMetrics {
  total: number;
  pending: number;
  completed: number;
  progressPercentage: number;
}

/**
 * Top-level workspace view switcher.
 */
export type ActiveWorkspaceView = "tasks" | "recycleBin";

/**
 * Visible save/feedback notification state shown after task mutations.
 */
export interface SaveNotification {
  id: string;
  message: string;
  tone: "success" | "info" | "error";
  timestamp: string;
}

/**
 * Single message entry inside the AI Helper Chatbox.
 */
export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isError?: boolean;
}

/**
 * Supported color tokens assignable to task classifications.
 */
export type ClassificationColor =
  | "blue"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "slate";

/**
 * Serializable application state persisted to `localStorage`.
 */
export interface PersistedTaskLedgerState {
  version: 1;
  tasks: Task[];
  recycleBin: RecycledTask[];
  classifications: string[];
  classificationColors?: Record<string, ClassificationColor>;
}
