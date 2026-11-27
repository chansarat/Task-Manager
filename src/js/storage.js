/**
 * @fileoverview Workspace persistence: local browser cache plus optional Supabase sync.
 *
 * `localStorage` serves as the immediate synchronous store and offline fallback.
 * When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured, the
 * workspace syncs to `public.task_workspaces` under either an email/password
 * account (cross-device) or an anonymous session.
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
let currentAuthUser = null;
let authChangeListener = null;

/**
 * Returns whether Supabase environment variables are configured in this build.
 */
export function isCloudSyncConfigured() {
  return Boolean(supabase);
}

/**
 * Returns the active Supabase user summary (`{ id, email, isAnonymous }`), or null.
 */
export function getCurrentAuthUser() {
  return currentAuthUser;
}

function setCurrentAuthUser(user) {
  currentAuthUser = user
    ? {
        id: user.id,
        email: typeof user.email === "string" && user.email ? user.email : null,
        isAnonymous: Boolean(user.is_anonymous || !user.email),
      }
    : null;
  cloudUserId = currentAuthUser ? currentAuthUser.id : null;
  if (typeof authChangeListener === "function") {
    authChangeListener(currentAuthUser);
  }
}

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

/**
 * Merges a remote Supabase workspace with any local tasks created before sign-in
 * so neither remote nor local items are lost.
 */
function mergeWorkspaces(localState, remoteState) {
  const remoteTaskIds = new Set(remoteState.tasks.map((t) => t.id));
  const remoteBinIds = new Set(remoteState.recycleBin.map((t) => t.id));

  const extraLocalTasks = localState.tasks.filter(
    (t) => !remoteTaskIds.has(t.id) && !remoteBinIds.has(t.id)
  );
  const extraLocalBin = localState.recycleBin.filter(
    (t) => !remoteBinIds.has(t.id) && !remoteTaskIds.has(t.id)
  );

  return normalizeWorkspaceState({
    version: 1,
    tasks: [...remoteState.tasks, ...extraLocalTasks],
    recycleBin: [...remoteState.recycleBin, ...extraLocalBin],
    classifications: Array.from(
      new Set([...remoteState.classifications, ...localState.classifications])
    ),
    classificationColors: {
      ...localState.classificationColors,
      ...remoteState.classificationColors,
    },
  });
}

async function persistCloudState(state) {
  if (!supabase || !cloudUserId) {
    return { ok: false, error: "Cloud sync is not active." };
  }
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
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

function queueCloudSave(state) {
  latestLocalState = state;
  localRevision += 1;
  if (!supabase || !cloudUserId) return;

  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
  }
  cloudSaveTimer = window.setTimeout(() => {
    cloudSaveTimer = null;
    void persistCloudState(state);
  }, 300);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (cloudSaveTimer && latestLocalState && supabase && cloudUserId) {
      window.clearTimeout(cloudSaveTimer);
      cloudSaveTimer = null;
      void persistCloudState(latestLocalState);
    }
  });
}

async function reconcileUserWorkspace(userId, localState, mergeLocalOnRemote) {
  const { data: row, error: readError } = await supabase
    .from("task_workspaces")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw readError;

  if (!row) {
    const saveRes = await persistCloudState(localState);
    if (!saveRes.ok) {
      throw new Error(saveRes.error || "Failed to initialize remote workspace.");
    }
    return localState;
  }

  const remote = row.state;
  if (!remote || remote.version !== 1) {
    throw new Error("The Supabase workspace has an unsupported data format.");
  }

  const remoteState = normalizeWorkspaceState(remote);
  const nextState = mergeLocalOnRemote
    ? mergeWorkspaces(localState, remoteState)
    : remoteState;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  latestLocalState = nextState;

  if (!statesMatch(nextState, remoteState)) {
    await persistCloudState(nextState);
  }

  return nextState;
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

    setCurrentAuthUser(user);

    if (localRevision !== revisionAtStart) {
      if (latestLocalState) {
        await persistCloudState(latestLocalState);
      }
      return;
    }

    const currentLocal = latestLocalState ?? localState;
    const syncedState = await reconcileUserWorkspace(user.id, currentLocal, false);

    if (!statesMatch(currentLocal, syncedState)) {
      if (typeof onCloudRestore === "function") {
        onCloudRestore(syncedState);
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
export function loadWorkspaceState(onCloudRestore, onAuthChange) {
  if (typeof onAuthChange === "function") {
    authChangeListener = onAuthChange;
  }

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

/**
 * Signs into an existing Supabase email/password account and merges/syncs tasks.
 */
export async function signInWithEmail(email, password, currentLocalState) {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured in this environment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable account sync."
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data.user) {
    throw new Error("Sign-in succeeded without returning a user session.");
  }

  setCurrentAuthUser(data.user);
  const baseLocal = currentLocalState ?? latestLocalState ?? createInitialState();
  const syncedState = await reconcileUserWorkspace(data.user.id, baseLocal, true);

  return { user: currentAuthUser, state: syncedState };
}

/**
 * Creates a new Supabase email/password account and uploads local tasks if immediately authenticated.
 */
export async function signUpWithEmail(email, password, currentLocalState) {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured in this environment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable account sync."
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.session && data.user) {
    setCurrentAuthUser(data.user);
    const baseLocal = currentLocalState ?? latestLocalState ?? createInitialState();
    const syncedState = await reconcileUserWorkspace(data.user.id, baseLocal, true);
    return {
      user: currentAuthUser,
      state: syncedState,
      needsEmailConfirmation: false,
    };
  }

  return {
    user: null,
    state: currentLocalState ?? latestLocalState ?? createInitialState(),
    needsEmailConfirmation: true,
  };
}

/**
 * Signs out of the current Supabase account while keeping local tasks in browser storage.
 */
export async function signOutAccount() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
  setCurrentAuthUser(null);
}

/**
 * Immediately flushes the current workspace state to Supabase.
 */
export async function syncWorkspaceNow(currentState) {
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase is not configured in this environment.",
    };
  }
  if (!cloudUserId) {
    return {
      ok: false,
      error: "Please sign in first to sync your tasks to Supabase.",
    };
  }

  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  latestLocalState = currentState;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
  return persistCloudState(currentState);
}
