/**
 * @fileoverview Workspace persistence: local browser cache plus optional Supabase sync.
 *
 * `localStorage` serves as the immediate synchronous store and offline fallback.
 * When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured, the
 * workspace is also synced asynchronously to `task_workspaces` via anonymous auth.
 */

import { createClient } from "@supabase/supabase-js";
import {
  CLOUD_RELOAD_KEY,
  DEFAULT_CLASSIFICATION_COLORS,
  DEFAULT_CLASSIFICATIONS,
  STORAGE_KEY,
  VALID_COLORS,
} from "./constants.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

let cloudInitialization = null;
let localRevision = 0;
let latestLocalState = null;
let cloudSaveTimer = null;
let cloudUserId = null;

/**
 * Returns a clean default workspace state.
 */
export function createInitialState() {
  return {
    version: 1,
    tasks: [],
    recycleBin: [],
    classifications: [...DEFAULT_CLASSIFICATIONS],
    classificationColors: { ...DEFAULT_CLASSIFICATION_COLORS },
  };
}

function isValidTask(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    candidate.title.trim().length > 0 &&
    typeof candidate.description === "string" &&
    typeof candidate.classification === "string" &&
    typeof candidate.dueDate === "string" &&
    typeof candidate.dueTime === "string" &&
    (candidate.status === "pending" || candidate.status === "completed") &&
    typeof candidate.progress === "number" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isValidRecycledTask(candidate) {
  return isValidTask(candidate) && typeof candidate.deletedAt === "string";
}

/**
 * Validates and normalizes parsed workspace JSON against the current schema.
 */
export function normalizeWorkspaceState(parsed) {
  const source = parsed && typeof parsed === "object" ? parsed : {};
  const tasks = Array.isArray(source.tasks) ? source.tasks.filter(isValidTask) : [];
  const recycleBin = Array.isArray(source.recycleBin)
    ? source.recycleBin.filter(isValidRecycledTask)
    : [];

  const hasErrandsTask =
    tasks.some((task) => task.classification.toLowerCase() === "errands") ||
    recycleBin.some((task) => task.classification.toLowerCase() === "errands");

  const rawClassifications = Array.isArray(source.classifications)
    ? source.classifications.filter(
        (item) =>
          typeof item === "string" &&
          item.trim().length > 0 &&
          (item.trim().toLowerCase() !== "errands" || hasErrandsTask)
      )
    : [];

  const classifications = Array.from(
    new Set([...DEFAULT_CLASSIFICATIONS, ...rawClassifications])
  );

  const classificationColors = { ...DEFAULT_CLASSIFICATION_COLORS };
  if (source.classificationColors && typeof source.classificationColors === "object") {
    for (const [key, color] of Object.entries(source.classificationColors)) {
      if (typeof color === "string" && VALID_COLORS.has(color)) {
        classificationColors[key] = color;
      }
    }
  }

  return {
    version: 1,
    tasks,
    recycleBin,
    classifications,
    classificationColors,
  };
}

function statesMatch(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

async function persistCloudState(state) {
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

function queueCloudSave(state) {
  latestLocalState = state;
  localRevision += 1;
  if (!supabase || !cloudUserId) return;

  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
  }
  cloudSaveTimer = window.setTimeout(() => {
    void persistCloudState(state);
  }, 300);
}

async function initializeCloudPersistence(localState, onCloudRestore) {
  if (!supabase) return;
  if (cloudInitialization) return cloudInitialization;

  if (!latestLocalState) {
    latestLocalState = localState;
  }
  const revisionAtStart = localRevision;

  cloudInitialization = (async () => {
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;

    let user = authData.session?.user ?? null;
    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      user = data.user ?? null;
    }
    if (!user) {
      throw new Error("Supabase did not return an authenticated user.");
    }
    cloudUserId = user.id;

    const { data: row, error: readError } = await supabase
      .from("task_workspaces")
      .select("state")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;

    if (localRevision !== revisionAtStart) {
      if (latestLocalState) {
        await persistCloudState(latestLocalState);
      }
      return;
    }

    if (!row) {
      await persistCloudState(latestLocalState ?? localState);
      return;
    }

    const remote = row.state;
    if (!remote || remote.version !== 1) {
      throw new Error("The Supabase workspace has an unsupported data format.");
    }

    const remoteState = normalizeWorkspaceState(remote);
    const currentLocal = latestLocalState ?? localState;

    if (!statesMatch(currentLocal, remoteState)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
      latestLocalState = remoteState;

      if (typeof onCloudRestore === "function") {
        onCloudRestore(remoteState);
      } else if (window.sessionStorage.getItem(CLOUD_RELOAD_KEY) !== "1") {
        window.sessionStorage.setItem(CLOUD_RELOAD_KEY, "1");
        window.location.reload();
      } else {
        window.sessionStorage.removeItem(CLOUD_RELOAD_KEY);
      }
    }
  })()
    .catch((error) => {
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

/**
 * Loads workspace state synchronously from localStorage and triggers optional cloud sync.
 */
export function loadWorkspaceState(onCloudRestore) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const state = raw
      ? normalizeWorkspaceState(JSON.parse(raw))
      : createInitialState();
    latestLocalState = state;
    void initializeCloudPersistence(state, onCloudRestore);
    return { state, error: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown storage read error";
    const state = createInitialState();
    latestLocalState = state;
    void initializeCloudPersistence(state, onCloudRestore);
    return {
      state,
      error: `Could not restore saved tasks (${reason}). Starting with a clean workspace.`,
    };
  }
}

/**
 * Saves workspace state synchronously to localStorage and queues optional cloud upsert.
 */
export function saveWorkspaceState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    queueCloudSave(state);
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Browser storage quota exceeded";
    return { ok: false, error: `Failed to save tasks locally: ${reason}` };
  }
}
