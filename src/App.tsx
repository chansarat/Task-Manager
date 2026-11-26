/**
 * @fileoverview Root Task Manager application component.
 *
 * Coordinates local persistence, task CRUD operations, duplicate checking,
 * 5-mode task filtering, progress metrics, classification & color management,
 * Recycle Bin lifecycle, save confirmation banners, confirmation dialogs, and
 * the AI Helper chatbox.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FolderPlus, Info, AlertCircle, Plus, X } from "lucide-react";
import { AddTaskForm, type AddTaskPayload } from "./components/AddTaskForm";
import { AiHelperChatbox } from "./components/AiHelperChatbox";
import { ClassificationModal } from "./components/ClassificationModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DocsModal } from "./components/DocsModal";
import { Header } from "./components/Header";
import { RecycleBinView } from "./components/RecycleBinView";
import { StatsStrip } from "./components/StatsStrip";
import { TaskFilters } from "./components/TaskFilters";
import type { UpdateTaskPayload } from "./components/TaskItem";
import { TaskList } from "./components/TaskList";
import type {
  ActiveWorkspaceView,
  ClassificationColor,
  RecycledTask,
  SaveNotification,
  Task,
  TaskFilterState,
} from "./types/task";
import {
  DEFAULT_CLASSIFICATION_COLORS,
  loadWorkspaceState,
  saveWorkspaceState,
} from "./utils/storage";
import {
  calculateTaskMetrics,
  filterTasks,
  findDuplicateTask,
  generateId,
} from "./utils/taskHelpers";

type PendingConfirmation =
  | { type: "clearCompleted"; count: number }
  | { type: "deletePermanentSingle"; task: RecycledTask }
  | { type: "deletePermanentMultiple"; taskIds: string[] };

const INITIAL_FILTER: TaskFilterState = {
  mode: "all",
  dueDatePreset: "all_scheduled",
  specificDate: "",
  selectedClassification: "__ALL__",
};

export default function App() {
  const initialLoad = useMemo(() => loadWorkspaceState(), []);

  const [tasks, setTasks] = useState<Task[]>(initialLoad.state.tasks);
  const [recycleBin, setRecycleBin] = useState<RecycledTask[]>(
    initialLoad.state.recycleBin
  );
  const [classifications, setClassifications] = useState<string[]>(
    initialLoad.state.classifications
  );
  const [classificationColors, setClassificationColors] = useState<
    Record<string, ClassificationColor>
  >(
    initialLoad.state.classificationColors ?? DEFAULT_CLASSIFICATION_COLORS
  );

  const [activeView, setActiveView] = useState<ActiveWorkspaceView>("tasks");
  const [filter, setFilter] = useState<TaskFilterState>(INITIAL_FILTER);
  const [notification, setNotification] = useState<SaveNotification | null>(
    initialLoad.error
      ? {
          id: "init-error",
          message: initialLoad.error,
          tone: "error",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }
      : null
  );

  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirmation | null>(null);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isClassificationModalOpen, setIsClassificationModalOpen] =
    useState(false);
  const [isAiHelperOpen, setIsAiHelperOpen] = useState(false);
  const [docsModalState, setDocsModalState] = useState<{
    open: boolean;
    tab: "modules" | "privacy";
  }>({ open: false, tab: "modules" });

  const notificationTimerRef = useRef<number | null>(null);

  const todayDisplay = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const showSaveConfirmation = useCallback(
    (message: string, tone: SaveNotification["tone"] = "success") => {
      if (notificationTimerRef.current !== null) {
        window.clearTimeout(notificationTimerRef.current);
      }

      setNotification({
        id: generateId(),
        message,
        tone,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });

      notificationTimerRef.current = window.setTimeout(() => {
        setNotification(null);
      }, 4000);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current !== null) {
        window.clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  /**
   * Atomically updates workspace state, persists it to `localStorage`,
   * and displays a visible save confirmation message.
   */
  const commitWorkspaceUpdate = useCallback(
    (
      nextTasks: Task[],
      nextRecycleBin: RecycledTask[],
      nextClassifications: string[],
      nextColors: Record<string, ClassificationColor>,
      confirmationMessage: string
    ): { ok: boolean; error?: string } => {
      const saveResult = saveWorkspaceState({
        version: 1,
        tasks: nextTasks,
        recycleBin: nextRecycleBin,
        classifications: nextClassifications,
        classificationColors: nextColors,
      });

      if (!saveResult.ok) {
        showSaveConfirmation(
          saveResult.error || "Failed to save changes locally.",
          "error"
        );
        return { ok: false, error: saveResult.error };
      }

      setTasks(nextTasks);
      setRecycleBin(nextRecycleBin);
      setClassifications(nextClassifications);
      setClassificationColors(nextColors);
      showSaveConfirmation(confirmationMessage, "success");
      return { ok: true };
    },
    [showSaveConfirmation]
  );

  /**
   * Adds a new classification category with an assigned color if it does not already exist.
   */
  const handleAddClassification = useCallback(
    (
      rawName: string,
      color: ClassificationColor = "blue"
    ): { ok: boolean; error?: string } => {
      const trimmed = rawName.trim();
      if (!trimmed) {
        return { ok: false, error: "Classification name cannot be empty." };
      }

      const exists = classifications.some(
        (c) => c.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) {
        return {
          ok: false,
          error: `Classification "${trimmed}" already exists.`,
        };
      }

      const nextClassifications = [...classifications, trimmed];
      const nextColors: Record<string, ClassificationColor> = {
        ...classificationColors,
        [trimmed]: color,
      };
      return commitWorkspaceUpdate(
        tasks,
        recycleBin,
        nextClassifications,
        nextColors,
        `Classification "${trimmed}" added and saved.`
      );
    },
    [
      classificationColors,
      classifications,
      commitWorkspaceUpdate,
      recycleBin,
      tasks,
    ]
  );

  /**
   * Assigns or updates the color of an existing classification.
   */
  const handleUpdateClassificationColor = useCallback(
    (name: string, color: ClassificationColor) => {
      const nextColors: Record<string, ClassificationColor> = {
        ...classificationColors,
        [name]: color,
      };
      commitWorkspaceUpdate(
        tasks,
        recycleBin,
        classifications,
        nextColors,
        `Updated color for "${name}" and saved.`
      );
    },
    [
      classificationColors,
      classifications,
      commitWorkspaceUpdate,
      recycleBin,
      tasks,
    ]
  );

  /**
   * Creates a new task in `pending` status after checking for empty name
   * and duplicate `(title + dueDate + dueTime)`.
   */
  const handleAddTask = useCallback(
    (payload: AddTaskPayload): { ok: boolean; error?: string } => {
      const cleanTitle = payload.title.trim();
      if (!cleanTitle) {
        return {
          ok: false,
          error: "Task name cannot be empty. Please enter a task title.",
        };
      }

      const duplicate = findDuplicateTask(
        tasks,
        cleanTitle,
        payload.dueDate,
        payload.dueTime
      );
      if (duplicate) {
        return {
          ok: false,
          error: `Duplicate task detected: "${duplicate.title}" with the same due date and time already exists.`,
        };
      }

      const nowIso = new Date().toISOString();
      const newTask: Task = {
        id: generateId(),
        title: cleanTitle,
        description: payload.description.trim(),
        classification: payload.classification.trim() || "Work",
        dueDate: payload.dueDate.trim(),
        dueTime: payload.dueTime.trim(),
        status: "pending",
        progress: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const nextClassifications = classifications.some(
        (c) => c.toLowerCase() === newTask.classification.toLowerCase()
      )
        ? classifications
        : [...classifications, newTask.classification];

      return commitWorkspaceUpdate(
        [newTask, ...tasks],
        recycleBin,
        nextClassifications,
        classificationColors,
        `Task "${newTask.title}" saved.`
      );
    },
    [
      classificationColors,
      classifications,
      commitWorkspaceUpdate,
      recycleBin,
      tasks,
    ]
  );

  /**
   * Toggles a task between `pending` (0%) and `completed` (100%).
   */
  const handleToggleComplete = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const nextStatus: Task["status"] =
        target.status === "completed" ? "pending" : "completed";
      const nextProgress = nextStatus === "completed" ? 100 : 0;
      const nowIso = new Date().toISOString();

      const nextTasks = tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: nextStatus,
              progress: nextProgress,
              updatedAt: nowIso,
            }
          : task
      );

      commitWorkspaceUpdate(
        nextTasks,
        recycleBin,
        classifications,
        classificationColors,
        nextStatus === "completed"
          ? `Marked "${target.title}" as completed and saved.`
          : `Returned "${target.title}" to pending status and saved.`
      );
    },
    [
      classificationColors,
      classifications,
      commitWorkspaceUpdate,
      recycleBin,
      tasks,
    ]
  );

  /**
   * Updates an existing task's title, description, classification, or schedule.
   * Preserves the original task if validation fails.
   */
  const handleUpdateTask = useCallback(
    (payload: UpdateTaskPayload): { ok: boolean; error?: string } => {
      const cleanTitle = payload.title.trim();
      if (!cleanTitle) {
        return {
          ok: false,
          error: "Task name cannot be empty. Original task preserved.",
        };
      }

      const duplicate = findDuplicateTask(
        tasks,
        cleanTitle,
        payload.dueDate,
        payload.dueTime,
        payload.id
      );
      if (duplicate) {
        return {
          ok: false,
          error: `Duplicate task detected: "${duplicate.title}" already has the same due date and time. Original task preserved.`,
        };
      }

      const nowIso = new Date().toISOString();
      const cleanClassification = payload.classification.trim() || "Work";
      const nextTasks = tasks.map((task) =>
        task.id === payload.id
          ? {
              ...task,
              title: cleanTitle,
              description: payload.description.trim(),
              classification: cleanClassification,
              dueDate: payload.dueDate.trim(),
              dueTime: payload.dueTime.trim(),
              updatedAt: nowIso,
            }
          : task
      );

      const nextClassifications = classifications.some(
        (c) => c.toLowerCase() === cleanClassification.toLowerCase()
      )
        ? classifications
        : [...classifications, cleanClassification];

      return commitWorkspaceUpdate(
        nextTasks,
        recycleBin,
        nextClassifications,
        classificationColors,
        `Updated "${cleanTitle}" and saved changes.`
      );
    },
    [
      classificationColors,
      classifications,
      commitWorkspaceUpdate,
      recycleBin,
      tasks,
    ]
  );

  /**
   * Moves an individual task from the active To-Do list into the Recycle Bin.
   */
  const handleDeleteTaskToRecycleBin = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;

      const recycled: RecycledTask = {
        ...target,
        deletedAt: new Date().toISOString(),
      };

      const nextTasks = tasks.filter((t) => t.id !== taskId);
      const nextRecycleBin = [recycled, ...recycleBin];

      commitWorkspaceUpdate(
        nextTasks,
        nextRecycleBin,
        classifications,
        classificationColors,
        `Moved "${target.title}" to the Recycle Bin.`
      );
    },
    [
      classificationColors,
      classifications,
      commitWorkspaceUpdate,
      recycleBin,
      tasks,
    ]
  );

  /**
   * Restores a task from the Recycle Bin back to the active To-Do list.
   */
  const handleRestoreTask = useCallback(
    (taskId: string) => {
      const target = recycleBin.find((item) => item.id === taskId);
      if (!target) return;

      const { deletedAt: _removed, ...restoredTask } = target;
      const nextTasks = [
        { ...restoredTask, updatedAt: new Date().toISOString() },
        ...tasks,
      ];
      const nextRecycleBin = recycleBin.filter((item) => item.id !== taskId);

      commitWorkspaceUpdate(
        nextTasks,
        nextRecycleBin,
        classifications,
        classificationColors,
        `Restored "${target.title}" to your task list.`
      );
    },
    [
      classificationColors,
      classifications,
      commitWorkspaceUpdate,
      recycleBin,
      tasks,
    ]
  );

  /**
   * Executes confirmed destructive actions: Clear Completed or permanent
   * Recycle Bin deletion (single or multi-select).
   */
  const handleConfirmAction = useCallback(() => {
    if (!pendingConfirm) return;

    if (pendingConfirm.type === "clearCompleted") {
      const completedTasks = tasks.filter((t) => t.status === "completed");
      const pendingTasks = tasks.filter((t) => t.status === "pending");
      const nowIso = new Date().toISOString();

      const recycledCompleted: RecycledTask[] = completedTasks.map((task) => ({
        ...task,
        deletedAt: nowIso,
      }));

      commitWorkspaceUpdate(
        pendingTasks,
        [...recycledCompleted, ...recycleBin],
        classifications,
        classificationColors,
        `Cleared ${completedTasks.length} completed ${
          completedTasks.length === 1 ? "task" : "tasks"
        } to Recycle Bin. Pending tasks preserved.`
      );
    } else if (pendingConfirm.type === "deletePermanentSingle") {
      const nextRecycleBin = recycleBin.filter(
        (item) => item.id !== pendingConfirm.task.id
      );
      commitWorkspaceUpdate(
        tasks,
        nextRecycleBin,
        classifications,
        classificationColors,
        `Permanently deleted "${pendingConfirm.task.title}".`
      );
    } else if (pendingConfirm.type === "deletePermanentMultiple") {
      const idsToDelete = new Set(pendingConfirm.taskIds);
      const nextRecycleBin = recycleBin.filter(
        (item) => !idsToDelete.has(item.id)
      );
      commitWorkspaceUpdate(
        tasks,
        nextRecycleBin,
        classifications,
        classificationColors,
        `Permanently deleted ${pendingConfirm.taskIds.length} ${
          pendingConfirm.taskIds.length === 1 ? "task" : "tasks"
        } from Recycle Bin.`
      );
    }

    setPendingConfirm(null);
  }, [
    classificationColors,
    classifications,
    commitWorkspaceUpdate,
    pendingConfirm,
    recycleBin,
    tasks,
  ]);

  const metrics = useMemo(() => calculateTaskMetrics(tasks), [tasks]);
  const filteredTasks = useMemo(
    () => filterTasks(tasks, filter),
    [tasks, filter]
  );

  const confirmDialogProps = useMemo(() => {
    if (!pendingConfirm) {
      return null;
    }
    if (pendingConfirm.type === "clearCompleted") {
      return {
        title: "Clear Completed Tasks?",
        description: `This will remove ${pendingConfirm.count} completed ${
          pendingConfirm.count === 1 ? "task" : "tasks"
        } from your active list and move ${
          pendingConfirm.count === 1 ? "it" : "them"
        } to the Recycle Bin. All pending tasks will remain untouched.`,
        confirmLabel: "Clear Completed",
      };
    }
    if (pendingConfirm.type === "deletePermanentSingle") {
      return {
        title: "Permanently Delete Task?",
        description: `"${pendingConfirm.task.title}" will be permanently removed from your browser storage and cannot be recovered.`,
        confirmLabel: "Delete Forever",
      };
    }
    return {
      title: `Permanently Delete ${pendingConfirm.taskIds.length} Selected Tasks?`,
      description: `These ${pendingConfirm.taskIds.length} tasks will be permanently removed from your Recycle Bin and cannot be recovered.`,
      confirmLabel: `Delete ${pendingConfirm.taskIds.length} Forever`,
    };
  }, [pendingConfirm]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100/80 via-blue-50 to-sky-100/70 text-slate-900">
      <Header
        activeView={activeView}
        recycleBinCount={recycleBin.length}
        onSelectView={setActiveView}
        onOpenDocs={(tab) => setDocsModalState({ open: true, tab })}
        onOpenAiHelper={() => setIsAiHelperOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 pb-24">
        {/* Workspace Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              {activeView === "tasks" ? "Task Workspace" : "Recycle Bin"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {activeView === "tasks"
                ? "Organize tasks by classification and due date, track completion progress, and keep everything saved locally."
                : "Recover accidentally deleted tasks or permanently clear items you no longer need."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-end shrink-0">
            <p className="text-xs font-medium text-blue-900/70 whitespace-nowrap shrink-0 mr-1.5">
              {todayDisplay}
            </p>
            {activeView === "tasks" && (
              <>
                <button
                  type="button"
                  onClick={() => setIsClassificationModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-900 shadow-xs hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <FolderPlus className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  New Classification
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddTaskOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add New Task
                </button>
              </>
            )}
          </div>
        </div>

        {/* Visible Save Confirmation Banner */}
        {notification && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xs ${
              notification.tone === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : notification.tone === "info"
                ? "border-blue-200 bg-white text-blue-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {notification.tone === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              ) : notification.tone === "info" ? (
                <Info className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              )}
              <span className="font-medium truncate">{notification.message}</span>
              <span className="hidden sm:inline font-mono text-xs opacity-75 tabular-nums shrink-0">
                · {notification.timestamp}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setNotification(null)}
              aria-label="Dismiss save confirmation"
              className="rounded p-1 opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Summary Metrics Strip */}
        <StatsStrip metrics={metrics} />

        {activeView === "tasks" ? (
          <div className="space-y-4">
            <TaskFilters
              filter={filter}
              classifications={classifications}
              completedCount={metrics.completed}
              visibleCount={filteredTasks.length}
              totalCount={metrics.total}
              onFilterChange={setFilter}
              onRequestClearCompleted={() =>
                setPendingConfirm({
                  type: "clearCompleted",
                  count: metrics.completed,
                })
              }
            />

            <TaskList
              tasks={filteredTasks}
              totalActiveCount={tasks.length}
              filter={filter}
              classifications={classifications}
              classificationColors={classificationColors}
              onToggleComplete={handleToggleComplete}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTaskToRecycleBin}
              onResetFilters={() => setFilter(INITIAL_FILTER)}
              onOpenAddTask={() => setIsAddTaskOpen(true)}
            />
          </div>
        ) : (
          <RecycleBinView
            items={recycleBin}
            classificationColors={classificationColors}
            onRestoreTask={handleRestoreTask}
            onRequestPermanentDeleteSingle={(task) =>
              setPendingConfirm({ type: "deletePermanentSingle", task })
            }
            onRequestPermanentDeleteMultiple={(taskIds) =>
              setPendingConfirm({ type: "deletePermanentMultiple", taskIds })
            }
            onBackToTasks={() => setActiveView("tasks")}
          />
        )}
      </main>

      {/* On-demand Add New Task Modal */}
      <AddTaskForm
        isOpen={isAddTaskOpen}
        classifications={classifications}
        classificationColors={classificationColors}
        onClose={() => setIsAddTaskOpen(false)}
        onAddTask={handleAddTask}
      />

      {/* New Classification & Color Assignment Modal */}
      <ClassificationModal
        isOpen={isClassificationModalOpen}
        classifications={classifications}
        classificationColors={classificationColors}
        onClose={() => setIsClassificationModalOpen(false)}
        onAddClassification={handleAddClassification}
        onUpdateClassificationColor={handleUpdateClassificationColor}
      />

      {/* Confirmation Dialog for Clear Completed & Permanent Recycle Bin Deletions */}
      <ConfirmDialog
        isOpen={pendingConfirm !== null}
        title={confirmDialogProps?.title ?? ""}
        description={confirmDialogProps?.description ?? ""}
        confirmLabel={confirmDialogProps?.confirmLabel ?? "Confirm"}
        tone="danger"
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingConfirm(null)}
      />

      {/* Module & Privacy Documentation Modal */}
      <DocsModal
        isOpen={docsModalState.open}
        initialTab={docsModalState.tab}
        onClose={() => setDocsModalState((prev) => ({ ...prev, open: false }))}
      />

      {/* AI Helper Chatbox & 2-second offer-help prompt */}
      <AiHelperChatbox
        isOpen={isAiHelperOpen}
        onOpen={() => setIsAiHelperOpen(true)}
        onClose={() => setIsAiHelperOpen(false)}
      />
    </div>
  );
}
