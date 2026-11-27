/**
 * @fileoverview Pure domain helpers for Task Manager (Vanilla JavaScript).
 *
 * Handles ID generation, duplicate task detection (name + date + time),
 * urgency & completion sorting, 5-mode filtering, metrics, and date formatting.
 */

/**
 * Generates a collision-resistant unique identifier.
 */
export function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Returns today's local calendar date formatted as `YYYY-MM-DD`.
 */
export function getLocalTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns tomorrow's local calendar date formatted as `YYYY-MM-DD`.
 */
function getLocalTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether submitting a task with `(title, dueDate, dueTime)` duplicates
 * an existing active task with the exact same normalized name and date/time.
 */
export function findDuplicateTask(tasks, title, dueDate, dueTime, excludeTaskId = null) {
  const normalizedTitle = String(title || "").trim().toLowerCase();
  const normalizedDate = String(dueDate || "").trim();
  const normalizedTime = String(dueTime || "").trim();

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
    ) || null
  );
}

/**
 * Computes Total, Pending, Completed counts and overall Progress Percentage.
 */
export function calculateTaskMetrics(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pending = total - completed;
  const progressPercentage = total === 0 ? 0 : Math.round((completed / total) * 100);

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
export function isTaskOverdue(task) {
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
 * Returns an urgency tier for a pending task:
 * - 0: Overdue
 * - 1: Due today
 * - 2: Due tomorrow
 * - 3: Not urgent (due later or unscheduled)
 */
export function getTaskUrgencyTier(task) {
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
 * Sorts tasks so pending urgent/newest tasks stay on top and completed tasks move down.
 */
export function sortTasksForDisplay(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1;
    }

    if (a.status === "completed") {
      const updatedDiff = b.updatedAt.localeCompare(a.updatedAt);
      return updatedDiff !== 0 ? updatedDiff : b.createdAt.localeCompare(a.createdAt);
    }

    const tierA = getTaskUrgencyTier(a);
    const tierB = getTaskUrgencyTier(b);
    if (tierA !== tierB) {
      return tierA - tierB;
    }

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

    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Filters tasks across the 5 supported modes and applies priority/recency sorting.
 */
export function filterTasks(tasks, filter) {
  const today = getLocalTodayDateString();
  let matched;

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

    case "dueDate":
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

    case "classification":
      if (!filter.selectedClassification || filter.selectedClassification === "__ALL__") {
        matched = tasks;
      } else {
        matched = tasks.filter(
          (task) =>
            task.classification.toLowerCase() ===
            filter.selectedClassification.toLowerCase()
        );
      }
      break;

    default:
      matched = tasks;
  }

  return sortTasksForDisplay(matched);
}

/**
 * Formats a `YYYY-MM-DD` and optional `HH:mm` into a human-readable schedule label.
 */
export function formatDueSchedule(dueDate, dueTime) {
  if (!dueDate && !dueTime) {
    return "No due date";
  }

  let datePart = "";
  if (dueDate) {
    const parts = dueDate.split("-").map(Number);
    if (parts[0] && parts[1] && parts[2]) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
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
 * Formats an ISO timestamp into a short local date & time string.
 */
export function formatTimestamp(isoString) {
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
