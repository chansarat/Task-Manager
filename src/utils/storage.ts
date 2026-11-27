/**
 * @fileoverview Workspace persistence: local browser cache plus optional Supabase sync.
 *
 * localStorage remains the synchronous cache/fallback. When Supabase is configured,
 * the full workspace is synced to a row owned by the current anonymous auth user.
 */

import type {
  ClassificationColor,
  PersistedTaskLedgerState,
  RecycledTask,
  Task,
} from "../types/task";
import { supabase } from "../services/supabaseClient";

/** Local storage key under which Task Manager persists workspace state. */
export const STORAGE_KEY = "taskledger_workspace_v1";
const CLOUD_RELOAD_KEY = "taskledger_supabase_restore_v1";

export const DEFAULT_CLASSIFICATIONS: readonly string[] = [
  "Work",
  "Personal",
  "Study",
];

export const DEFAULT_CLASSIFICATION_COLORS: Record<string, ClassificationColor> = {
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

export function createInitialState(): PersistedTaskLedgerState {
  return {
    version: 1,
    tasks: [],
    recycleBin: [],
    classifications: [...DEFAULT_CLASSIFICATIONS],
    classificationColors: { ...DEFAULT_CLASSIFICATION_COLORS },
  };
}

function isValidTask(candidate: unknown): candidate is Task {
  if (!candidate || typeof candidate !== "object") return false;
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

function isValidRecycledTask(candidate: unknown): candidate is RecycledTask {
  if (!isValidTask(candidate)) return false;
  return typeof (candidate as unknown as Record<string, unknown>).deletedAt === "string";
}

function normalizeWorkspaceState(
  parsed: Partial<PersistedTaskLedgerState>
): PersistedTaskLedgerState {
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.filter(isValidTask) : [];
  const recycleBin = Array.isArray(parsed.recycleBin)
    ? parsed.recycleBin.filter(isValidRecycledTask)
    : [];
  const hasErrandsTask =
    tasks.some((task) => task.classification.toLowerCase() === "errands") ||
    recycleBin.some((task) => task.classification.toLowerCase() === "errands");
  const rawClassifications = Array.isArray(parsed.classifications)
    ? parsed.classifications.filter(
        (item): item is string =>
          typeof item === "string" &&
          item.trim().length > 0 &&
          (item.trim().toLowerCase() !== "errands" || hasErrandsTask)
      )
    : [];
  const classifications = Array.from(
    new Set([...DEFAULT_CLASSIFICATIONS, ...rawClassifications])
  );
  const classificationColors: Record<string, ClassificationColor> = {
    ...DEFAULT_CLASSIFICATION_COLORS,
  };

  if (parsed.classificationColors && typeof parsed.classificationColors === "object") {
    for (const [key, color] of Object.entries(parsed.classificationColors)) {
      if (typeof color === "string" && VALID_COLORS.has(color)) {
        classificationColors[key] = color as ClassificationColor;
      }
    }
  }

  return { version: 1, tasks, recycleBin, classifications, classificationColors };
}

let cloudInitialization: Promise<void> | null = null;
let localRevision = 0;
let latestLocalState: PersistedTaskLedgerState | null = null;
let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
let cloudUserId: string | null = null;

function queueCloudSave(state: PersistedTaskLedgerState): void {
  latestLocalState = state;
  localRevision += 1;
  if (!supabase || !cloudUserId) return;

  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    void persistCloudState(state);
  }, 300);
}

async function persistCloudState(state: PersistedTaskLedgerState): Promise<void> {
  if (!supabase || !cloudUserId) return;
  const { error } = await supabase.from("task_workspaces").upsert(
    {
      user_id: cloudUserId,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("Could not sync the workspace to Supabase:", error.message);
  }
}

function statesMatch(
  first: PersistedTaskLedgerState,
  second: PersistedTaskLedgerState
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

async function initializeCloudPersistence(
  localState: PersistedTaskLedgerState
): Promise<void> {
  if (!supabase) return;
  if (cloudInitialization) return cloudInitialization;

  latestLocalState ??= localState;
  const revisionAtStart = localRevision;
  cloudInitialization = (async () => {
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;

    let user = authData.session?.user;
    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      user = data.user;
    }
    if (!user) throw new Error("Supabase did not return an authenticated user.");
    cloudUserId = user.id;

    const { data: row, error: readError } = await supabase
      .from("task_workspaces")
      .select("state")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;

    // If the user made changes while auth/network setup was running, preserve
    // those changes and upload them rather than replacing them with stale data.
    if (localRevision !== revisionAtStart) {
      if (latestLocalState) await persistCloudState(latestLocalState);
      return;
    }

    if (!row) {
      await persistCloudState(latestLocalState ?? localState);
      return;
    }

    const remote = row.state as Partial<PersistedTaskLedgerState> | null;
    if (!remote || remote.version !== 1) {
      throw new Error("The Supabase workspace has an unsupported data format.");
    }
    const remoteState = normalizeWorkspaceState(remote);
    const currentLocal = latestLocalState ?? localState;

    if (!statesMatch(currentLocal, remoteState)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
      latestLocalState = remoteState;
      // App state is initialized synchronously from localStorage. Reload once
      // after restoring cloud data so React starts with the restored workspace.
      if (window.sessionStorage.getItem(CLOUD_RELOAD_KEY) !== "1") {
        window.sessionStorage.setItem(CLOUD_RELOAD_KEY, "1");
        window.location.reload();
      } else {
        window.sessionStorage.removeItem(CLOUD_RELOAD_KEY);
      }
    }
  })()
    .catch((error: unknown) => {
      console.error(
        "Supabase workspace sync is unavailable; continuing with local storage:",
        error instanceof Error ? error.message : error
      );
    })
    .finally(() => {
      cloudInitialization = null;
    });

  return cloudInitialization;
}

export function loadWorkspaceState(): {
  state: PersistedTaskLedgerState;
  error: string | null;
} {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const state = raw
      ? normalizeWorkspaceState(JSON.parse(raw) as Partial<PersistedTaskLedgerState>)
      : createInitialState();
    latestLocalState = state;
    void initializeCloudPersistence(state);
    return { state, error: null };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : "Unknown storage read error";
    const state = createInitialState();
    latestLocalState = state;
    void initializeCloudPersistence(state);
    return {
      state,
      error: `Could not restore saved tasks (${reason}). Starting with a clean workspace.`,
    };
  }
}

/** Saves synchronously to localStorage, then queues a debounced cloud upsert. */
export function saveWorkspaceState(state: PersistedTaskLedgerState): {
  ok: boolean;
  error?: string;
} {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    queueCloudSave(state);
    return { ok: true };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : "Browser storage quota exceeded";
    return { ok: false, error: `Failed to save tasks locally: ${reason}` };
  }
}
