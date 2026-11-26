/**
 * @fileoverview Local browser persistence module (`localStorage`) for Task Manager.
 *
 * Ensures all tasks, classifications, category colors, and Recycle Bin items
 * are automatically saved locally and never transmitted to external services.
 */

import type {
  ClassificationColor,
  PersistedTaskLedgerState,
  RecycledTask,
  Task,
} from "../types/task";

/**
 * Local storage key under which Task Manager persists workspace state.
 */
export const STORAGE_KEY = "taskledger_workspace_v1";

/**
 * Default classifications available on first launch (Errands removed).
 */
export const DEFAULT_CLASSIFICATIONS: readonly string[] = [
  "Work",
  "Personal",
  "Study",
];

/**
 * Default color assignments for built-in classifications.
 */
export const DEFAULT_CLASSIFICATION_COLORS: Record<string, ClassificationColor> =
  {
    Work: "blue",
    Personal: "emerald",
    Study: "violet",
  };

const VALID_COLORS: ReadonlySet<string> = new Set([
  "blue",
  "indigo",
  "emerald",
  "amber",
  "rose",
  "violet",
  "teal",
  "slate",
]);

/**
 * Creates a clean initial state with default classifications, colors, and empty lists.
 */
export function createInitialState(): PersistedTaskLedgerState {
  return {
    version: 1,
    tasks: [],
    recycleBin: [],
    classifications: [...DEFAULT_CLASSIFICATIONS],
    classificationColors: { ...DEFAULT_CLASSIFICATION_COLORS },
  };
}

/**
 * Validates and normalizes a raw task record read from storage.
 */
function isValidTask(candidate: unknown): candidate is Task {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const obj = candidate as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    obj.title.trim().length > 0 &&
    typeof obj.description === "string" &&
    typeof obj.classification === "string" &&
    typeof obj.dueDate === "string" &&
    typeof obj.dueTime === "string" &&
    (obj.status === "pending" || obj.status === "completed") &&
    typeof obj.progress === "number" &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}

/**
 * Validates a raw recycled task record read from storage.
 */
function isValidRecycledTask(candidate: unknown): candidate is RecycledTask {
  if (!isValidTask(candidate)) {
    return false;
  }
  const obj = candidate as unknown as Record<string, unknown>;
  return typeof obj.deletedAt === "string";
}

/**
 * Loads the persisted workspace state from `localStorage`.
 * Returns a safe default state if storage is empty, unavailable, or malformed.
 */
export function loadWorkspaceState(): {
  state: PersistedTaskLedgerState;
  error: string | null;
} {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { state: createInitialState(), error: null };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedTaskLedgerState>;
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.filter(isValidTask)
      : [];
    const recycleBin = Array.isArray(parsed.recycleBin)
      ? parsed.recycleBin.filter(isValidRecycledTask)
      : [];

    const hasErrandsTask =
      tasks.some((t) => t.classification.toLowerCase() === "errands") ||
      recycleBin.some((t) => t.classification.toLowerCase() === "errands");

    const rawClassifications = Array.isArray(parsed.classifications)
      ? parsed.classifications.filter(
          (item): item is string =>
            typeof item === "string" &&
            item.trim().length > 0 &&
            (item.trim().toLowerCase() !== "errands" || hasErrandsTask)
        )
      : [];

    const mergedClassifications = Array.from(
      new Set([...DEFAULT_CLASSIFICATIONS, ...rawClassifications])
    );

    const mergedColors: Record<string, ClassificationColor> = {
      ...DEFAULT_CLASSIFICATION_COLORS,
    };

    if (
      parsed.classificationColors &&
      typeof parsed.classificationColors === "object"
    ) {
      for (const [key, val] of Object.entries(parsed.classificationColors)) {
        if (typeof val === "string" && VALID_COLORS.has(val)) {
          mergedColors[key] = val as ClassificationColor;
        }
      }
    }

    return {
      state: {
        version: 1,
        tasks,
        recycleBin,
        classifications: mergedClassifications,
        classificationColors: mergedColors,
      },
      error: null,
    };
  } catch (err: unknown) {
    const reason =
      err instanceof Error ? err.message : "Unknown storage read error";
    return {
      state: createInitialState(),
      error: `Could not restore saved tasks (${reason}). Starting with a clean workspace.`,
    };
  }
}

/**
 * Persists the full workspace state synchronously to `localStorage`.
 */
export function saveWorkspaceState(state: PersistedTaskLedgerState): {
  ok: boolean;
  error?: string;
} {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err: unknown) {
    const reason =
      err instanceof Error ? err.message : "Browser storage quota exceeded";
    return {
      ok: false,
      error: `Failed to save tasks locally: ${reason}`,
    };
  }
}
