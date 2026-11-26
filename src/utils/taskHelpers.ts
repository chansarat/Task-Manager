/**
 * @fileoverview Pure domain logic helpers for TaskLedger.
 *
 * Handles duplicate task detection (task name + due date & time), 5-mode
 * filtering, aggregate task metrics calculation, and date/time formatting.
 */

import type {
  Task,
  TaskFilterState,
  TaskMetrics,
} from "../types/task";

/**
 * Generates a collision-resistant identifier for tasks and notifications.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Returns today's local calendar date formatted as `YYYY-MM-DD`.
 */
export function getLocalTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether submitting a task with `(title, dueDate, dueTime)` duplicates
 * an existing active task with the exact same normalized name and date/time.
 *
 * @param tasks - Existing active tasks.
 * @param title - Candidate task title.
 * @param dueDate - Candidate due date (`YYYY-MM-DD` or `""`).
 * @param dueTime - Candidate due time (`HH:mm` or `""`).
 * @param excludeTaskId - Optional task ID to ignore when updating an existing task.
 * @returns Matching duplicate Task if found, otherwise `null`.
 */
export function findDuplicateTask(
  tasks: Task[],
  title: string,
  dueDate: string,
  dueTime: string,
  excludeTaskId?: string
): Task | null {
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedDate = dueDate.trim();
  const normalizedTime = dueTime.trim();

  if (!normalizedTitle) {
    return null;
  }

  return (
    tasks.find(
      (task) =>
        task.id !== excludeTaskId &&
        task.title.trim().toLowerCase() === normalizedTitle &&
        task.dueDate.trim() === normalizedDate &&
        task.dueTime.trim() === normalizedTime
    ) ?? null
  );
}

/**
 * Computes Total, Pending, Completed counts and overall Progress Percentage.
 */
export function calculateTaskMetrics(tasks: Task[]): TaskMetrics {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pending = total - completed;
  const progressPercentage =
    total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    pending,
    completed,
    progressPercentage,
  };
}

/**
 * Determines whether a pending task's scheduled due date/time is in the past.
 */
export function isTaskOverdue(task: Task): boolean {
  if (task.status === "completed" || !task.dueDate) {
    return false;
  }
  const today = getLocalTodayDateString();
  if (task.dueDate < today) {
    return true;
  }
  if (task.dueDate === today && task.dueTime) {
    const now = new Date();
    const currentHm = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    return task.dueTime < currentHm;
  }
  return false;
}

/**
 * Returns tomorrow's local calendar date formatted as `YYYY-MM-DD`.
 */
function getLocalTomorrowDateString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns an urgency tier for a pending task:
 * - `0`: Overdue
 * - `1`: Due today
 * - `2`: Due tomorrow
 * - `3`: Not urgent (due later or unscheduled)
 */
export function getTaskUrgencyTier(task: Task): 0 | 1 | 2 | 3 {
  if (task.status === "completed" || !task.dueDate) {
    return 3;
  }
  if (isTaskOverdue(task)) {
    return 0;
  }
  const today = getLocalTodayDateString();
  if (task.dueDate === today) {
    return 1;
  }
  const tomorrow = getLocalTomorrowDateString();
  if (task.dueDate === tomorrow) {
    return 2;
  }
  return 3;
}

/**
 * Sorts tasks so:
 * 1. Pending tasks always appear before completed tasks (completed tasks move down).
 * 2. Urgent pending tasks (overdue, due today, due tomorrow) appear at the top,
 *    ordered by earliest deadline.
 * 3. Other pending tasks are ordered newest-first (`createdAt` descending).
 * 4. Completed tasks are ordered by most recently updated/completed first.
 */
export function sortTasksForDisplay(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1;
    }

    if (a.status === "completed") {
      const updatedDiff = b.updatedAt.localeCompare(a.updatedAt);
      return updatedDiff !== 0
        ? updatedDiff
        : b.createdAt.localeCompare(a.createdAt);
    }

    const tierA = getTaskUrgencyTier(a);
    const tierB = getTaskUrgencyTier(b);
    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Within urgent tiers (0, 1, 2), sort earliest due date/time first
    if (tierA < 3) {
      const dateCompare = a.dueDate.localeCompare(b.dueDate);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      const timeA = a.dueTime || "23:59";
      const timeB = b.dueTime || "23:59";
      const timeCompare = timeA.localeCompare(timeB);
      if (timeCompare !== 0) {
        return timeCompare;
      }
    }

    // Newest created task at the top
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Filters the active task list according to the selected filter mode and
 * secondary criteria (due date preset / specific date / classification),
 * then sorts with urgent and newest pending tasks on top and completed tasks
 * moved to the bottom.
 */
export function filterTasks(tasks: Task[], filter: TaskFilterState): Task[] {
  const today = getLocalTodayDateString();

  let matched: Task[];
  switch (filter.mode) {
    case "all":
      matched = tasks;
      break;

    case "pending":
      matched = tasks.filter((task) => task.status === "pending");
      break;

    case "completed":
      matched = tasks.filter((task) => task.status === "completed");
      break;

    case "dueDate": {
      switch (filter.dueDatePreset) {
        case "all_scheduled":
          matched = tasks.filter((task) => task.dueDate !== "");
          break;
        case "today":
          matched = tasks.filter((task) => task.dueDate === today);
          break;
        case "upcoming":
          matched = tasks.filter((task) => task.dueDate > today);
          break;
        case "overdue":
          matched = tasks.filter((task) => isTaskOverdue(task));
          break;
        case "no_date":
          matched = tasks.filter((task) => task.dueDate === "");
          break;
        case "specific_date":
          matched = !filter.specificDate
            ? tasks
            : tasks.filter((task) => task.dueDate === filter.specificDate);
          break;
        default:
          matched = tasks;
      }
      break;
    }

    case "classification": {
      if (
        !filter.selectedClassification ||
        filter.selectedClassification === "__ALL__"
      ) {
        matched = tasks;
      } else {
        matched = tasks.filter(
          (task) =>
            task.classification.toLowerCase() ===
            filter.selectedClassification.toLowerCase()
        );
      }
      break;
    }

    default:
      matched = tasks;
  }

  return sortTasksForDisplay(matched);
}

/**
 * Formats a `YYYY-MM-DD` and optional `HH:mm` into a clean human-readable string.
 */
export function formatDueSchedule(dueDate: string, dueTime: string): string {
  if (!dueDate && !dueTime) {
    return "No due date";
  }

  let datePart = "";
  if (dueDate) {
    const [year, month, day] = dueDate.split("-").map(Number);
    if (year && month && day) {
      const d = new Date(year, month - 1, day);
      datePart = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } else {
      datePart = dueDate;
    }
  }

  if (dueTime) {
    const [hoursStr, minsStr] = dueTime.split(":");
    const hours = Number(hoursStr);
    const mins = Number(minsStr);
    if (!Number.isNaN(hours) && !Number.isNaN(mins)) {
      const t = new Date();
      t.setHours(hours, mins, 0, 0);
      const formattedTime = t.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      return datePart ? `${datePart} at ${formattedTime}` : formattedTime;
    }
    return datePart ? `${datePart} at ${dueTime}` : dueTime;
  }

  return datePart;
}

/**
 * Formats an ISO timestamp string into a concise local date & time label.
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
