/**
 * @fileoverview Main Vanilla JavaScript application controller for Task Manager.
 *
 * Coordinates application state, DOM events, validation, sorting/filtering,
 * Recycle Bin recovery, modal dialogs, save confirmation banners, and AI Helper.
 */

import { requestAiHelp } from "./aiHelperService.js";
import { AI_STARTER_PROMPTS, createSvgIcon } from "./constants.js";
import {
  renderAddTaskClassificationOptions,
  renderAiChat,
  renderClassificationModalContent,
  renderFilterBar,
  renderRecycleBin,
  renderStatsStrip,
  renderTaskList,
  updateClassificationPreview,
} from "./renderers.js";
import {
  getCurrentAuthUser,
  isCloudSyncConfigured,
  loadWorkspaceState,
  saveWorkspaceState,
  signInWithEmail,
  signOutAccount,
  signUpWithEmail,
  syncWorkspaceNow,
} from "./storage.js";
import {
  calculateTaskMetrics,
  filterTasks,
  findDuplicateTask,
  formatTimestamp,
  generateId,
  getLocalTodayDateString,
} from "./taskHelpers.js";

/** @type {ReturnType<typeof loadWorkspaceState>["state"]} */
let workspace;

const uiState = {
  activeView: "tasks", // "tasks" | "recycleBin"
  filter: {
    mode: "all", // "all" | "pending" | "completed" | "dueDate" | "classification"
    dueDatePreset: "all_scheduled",
    specificDate: getLocalTodayDateString(),
    selectedClassification: "__ALL__",
  },
  editingTaskId: null,
  editError: null,
  selectedBinIds: new Set(),
  selectedNewColor: "teal",
  pendingConfirm: null,
  docsTab: "modules",
  accountMode: "signin", // "signin" | "signup"
  accountBusy: false,
  ai: {
    isOpen: false,
    showOfferPopover: false,
    offerDismissed: false,
    isLoading: false,
    messages: [
      {
        id: "ai_welcome",
        role: "assistant",
        content:
          "Hi! Ask me how to prioritize tasks, break down a project, or structure your daily schedule. Your saved task list remains strictly private in your browser.",
        timestamp: new Date().toISOString(),
      },
    ],
  },
};

let saveBannerTimer = null;

// Cached DOM references
const dom = {
  // Navigation & Header
  brandHomeBtn: document.getElementById("brand-home-btn"),
  navTasksBtn: document.getElementById("nav-tasks-btn"),
  navBinBtn: document.getElementById("nav-bin-btn"),
  navDocsBtn: document.getElementById("nav-docs-btn"),
  navPrivacyBtn: document.getElementById("nav-privacy-btn"),
  navAccountBtn: document.getElementById("nav-account-btn"),
  headerAiBtn: document.getElementById("header-ai-btn"),

  // Workspace Header & Banner
  workspaceTitle: document.getElementById("workspace-title"),
  workspaceSubtitle: document.getElementById("workspace-subtitle"),
  todayDateLabel: document.getElementById("today-date-label"),
  tasksToolbarButtons: document.getElementById("tasks-toolbar-buttons"),
  openClassificationBtn: document.getElementById("open-classification-btn"),
  openAddTaskBtn: document.getElementById("open-add-task-btn"),

  saveBanner: document.getElementById("save-banner"),
  saveBannerIcon: document.getElementById("save-banner-icon"),
  saveBannerMessage: document.getElementById("save-banner-message"),
  saveBannerTime: document.getElementById("save-banner-time"),
  dismissSaveBannerBtn: document.getElementById("dismiss-save-banner-btn"),

  // Views & Filters
  tasksView: document.getElementById("tasks-view"),
  recycleBinView: document.getElementById("recycle-bin-view"),
  filterTabs: document.getElementById("filter-tabs"),
  dueDatePresets: document.getElementById("due-date-presets"),
  specificDateInput: document.getElementById("specific-date-input"),
  filterClassificationSelect: document.getElementById("filter-classification-select"),
  clearCompletedBtn: document.getElementById("clear-completed-btn"),
  taskListSection: document.getElementById("task-list-section"),

  // Recycle Bin
  backToTasksBtn: document.getElementById("back-to-tasks-btn"),
  deleteSelectedBinBtn: document.getElementById("delete-selected-bin-btn"),
  recycleBinListContainer: document.getElementById("recycle-bin-list-container"),

  // Add Task Modal
  addTaskModal: document.getElementById("add-task-modal"),
  closeAddTaskBtn: document.getElementById("close-add-task-btn"),
  cancelAddTaskBtn: document.getElementById("cancel-add-task-btn"),
  addTaskForm: document.getElementById("add-task-form"),
  addTaskError: document.getElementById("add-task-error"),
  addTaskErrorText: document.getElementById("add-task-error-text"),
  taskTitleInput: document.getElementById("task-title-input"),
  taskDescriptionInput: document.getElementById("task-description-input"),
  taskClassificationSelect: document.getElementById("task-classification-select"),
  addTaskColorDot: document.getElementById("add-task-color-dot"),
  addTaskColorName: document.getElementById("add-task-color-name"),
  taskDueDateInput: document.getElementById("task-due-date-input"),
  taskDueTimeInput: document.getElementById("task-due-time-input"),

  // Classification Modal
  classificationModal: document.getElementById("classification-modal"),
  closeClassificationBtn: document.getElementById("close-classification-btn"),
  classificationForm: document.getElementById("classification-form"),
  createClassificationName: document.getElementById("create-classification-name"),
  classificationError: document.getElementById("classification-error"),
  classificationErrorText: document.getElementById("classification-error-text"),
  newClassificationColorGrid: document.getElementById("new-classification-color-grid"),
  existingClassificationsHeading: document.getElementById("existing-classifications-heading"),
  existingClassificationsList: document.getElementById("existing-classifications-list"),

  // Confirm Modal
  confirmModal: document.getElementById("confirm-modal"),
  confirmDialogTitle: document.getElementById("confirm-dialog-title"),
  confirmDialogDesc: document.getElementById("confirm-dialog-desc"),
  closeConfirmBtn: document.getElementById("close-confirm-btn"),
  cancelConfirmBtn: document.getElementById("cancel-confirm-btn"),
  acceptConfirmBtn: document.getElementById("accept-confirm-btn"),

  // Docs Modal
  docsModal: document.getElementById("docs-modal"),
  closeDocsBtn: document.getElementById("close-docs-btn"),
  docsDoneBtn: document.getElementById("docs-done-btn"),
  docsTabModules: document.getElementById("docs-tab-modules"),
  docsTabPrivacy: document.getElementById("docs-tab-privacy"),
  docsContentModules: document.getElementById("docs-content-modules"),
  docsContentPrivacy: document.getElementById("docs-content-privacy"),

  // Account Modal
  accountModal: document.getElementById("account-modal"),
  closeAccountBtn: document.getElementById("close-account-btn"),
  cancelAccountBtn: document.getElementById("cancel-account-btn"),
  accountUnconfiguredNotice: document.getElementById("account-unconfigured-notice"),
  accountError: document.getElementById("account-error"),
  accountErrorText: document.getElementById("account-error-text"),
  accountInfo: document.getElementById("account-info"),
  accountInfoText: document.getElementById("account-info-text"),
  accountSignedInView: document.getElementById("account-signed-in-view"),
  accountUserEmail: document.getElementById("account-user-email"),
  accountSignoutBtn: document.getElementById("account-signout-btn"),
  accountSyncNowBtn: document.getElementById("account-sync-now-btn"),
  accountAuthView: document.getElementById("account-auth-view"),
  authTabSignin: document.getElementById("auth-tab-signin"),
  authTabSignup: document.getElementById("auth-tab-signup"),
  accountAuthForm: document.getElementById("account-auth-form"),
  accountEmailInput: document.getElementById("account-email-input"),
  accountPasswordInput: document.getElementById("account-password-input"),
  accountSubmitBtn: document.getElementById("account-submit-btn"),

  // AI Helper
  aiChatbox: document.getElementById("ai-chatbox"),
  closeAiChatBtn: document.getElementById("close-ai-chat-btn"),
  aiMessagesList: document.getElementById("ai-messages-list"),
  aiQuickPrompts: document.getElementById("ai-quick-prompts"),
  aiQuickButtons: document.getElementById("ai-quick-buttons"),
  aiChatForm: document.getElementById("ai-chat-form"),
  aiHelperInput: document.getElementById("ai-helper-input"),
  aiSendBtn: document.getElementById("ai-send-btn"),
  aiOfferPopover: document.getElementById("ai-offer-popover"),
  dismissAiOfferBtn: document.getElementById("dismiss-ai-offer-btn"),
  acceptAiOfferBtn: document.getElementById("accept-ai-offer-btn"),
  declineAiOfferBtn: document.getElementById("decline-ai-offer-btn"),
  aiFloatingBtn: document.getElementById("ai-floating-btn"),
};

/**
 * Displays a transient save/status banner in the workspace.
 */
function showSaveNotification(message, variant = "success") {
  if (!dom.saveBanner || !dom.saveBannerMessage || !dom.saveBannerTime || !dom.saveBannerIcon) {
    return;
  }

  dom.saveBanner.classList.remove("is-error", "is-info");
  if (variant === "error") {
    dom.saveBanner.classList.add("is-error");
  } else if (variant === "info") {
    dom.saveBanner.classList.add("is-info");
  }

  dom.saveBannerIcon.textContent = "";
  const iconName =
    variant === "error" ? "alert" : variant === "info" ? "info" : "checkCircle";
  dom.saveBannerIcon.appendChild(createSvgIcon(iconName, "icon-sm"));

  dom.saveBannerMessage.textContent = message;
  dom.saveBannerTime.textContent =
    variant === "error" ? "" : `Saved ${formatTimestamp(new Date().toISOString())}`;

  dom.saveBanner.hidden = false;

  if (saveBannerTimer) {
    window.clearTimeout(saveBannerTimer);
  }
  saveBannerTimer = window.setTimeout(() => {
    if (dom.saveBanner) {
      dom.saveBanner.hidden = true;
    }
  }, 4000);
}

/**
 * Persists state to storage, displays feedback, and re-renders the UI.
 */
function commitWorkspace(nextState, successMessage, variant = "success") {
  const result = saveWorkspaceState(nextState);
  workspace = nextState;

  if (!result.ok) {
    showSaveNotification(
      result.error || "Unable to persist tasks locally.",
      "error"
    );
  } else if (successMessage) {
    showSaveNotification(successMessage, variant);
  }

  renderApp();
}

/**
 * Switches between Tasks and Recycle Bin views.
 */
function setActiveView(view) {
  uiState.activeView = view;
  renderApp();
}

/**
 * Renders all visible workspace components based on current `workspace` and `uiState`.
 */
function renderApp() {
  const metrics = calculateTaskMetrics(workspace.tasks);
  const visibleTasks = filterTasks(workspace.tasks, uiState.filter);

  // Header & View Toggle
  const isTasksView = uiState.activeView === "tasks";
  if (dom.navTasksBtn) {
    dom.navTasksBtn.classList.toggle("is-active", isTasksView);
    if (isTasksView) {
      dom.navTasksBtn.setAttribute("aria-current", "page");
    } else {
      dom.navTasksBtn.removeAttribute("aria-current");
    }
  }
  if (dom.navBinBtn) {
    dom.navBinBtn.classList.toggle("is-active", !isTasksView);
    if (!isTasksView) {
      dom.navBinBtn.setAttribute("aria-current", "page");
    } else {
      dom.navBinBtn.removeAttribute("aria-current");
    }
  }

  if (dom.workspaceTitle) {
    dom.workspaceTitle.textContent = isTasksView ? "Task Workspace" : "Recycle Bin";
  }
  if (dom.workspaceSubtitle) {
    dom.workspaceSubtitle.textContent = isTasksView
      ? "Organize tasks by classification and due date, track completion progress, and keep everything saved locally."
      : "Review deleted tasks, restore items to your active list, or permanently delete selected tasks.";
  }
  if (dom.tasksToolbarButtons) {
    dom.tasksToolbarButtons.hidden = !isTasksView;
  }
  if (dom.tasksView) {
    dom.tasksView.hidden = !isTasksView;
  }
  if (dom.recycleBinView) {
    dom.recycleBinView.hidden = isTasksView;
  }

  // Stats & Filter
  renderStatsStrip(metrics);
  renderFilterBar(uiState.filter, workspace.classifications, metrics, visibleTasks.length);

  // Task List
  renderTaskList({
    container: dom.taskListSection,
    tasks: visibleTasks,
    totalActiveCount: workspace.tasks.length,
    filter: uiState.filter,
    classifications: workspace.classifications,
    classificationColors: workspace.classificationColors,
    editingTaskId: uiState.editingTaskId,
    editError: uiState.editError,
    handlers: {
      onOpenAddTask: openAddTaskModal,
      onResetFilter: () => {
        uiState.filter = {
          mode: "all",
          dueDatePreset: "all_scheduled",
          specificDate: getLocalTodayDateString(),
          selectedClassification: "__ALL__",
        };
        renderApp();
      },
      onToggleStatus: handleToggleTaskStatus,
      onStartEdit: (taskId) => {
        uiState.editingTaskId = taskId;
        uiState.editError = null;
        renderApp();
      },
      onCancelEdit: () => {
        uiState.editingTaskId = null;
        uiState.editError = null;
        renderApp();
      },
      onSaveEdit: handleUpdateTask,
      onRequestDelete: (task) => {
        openConfirmModal({
          title: "Confirm Delete Task",
          message: `Move "${task.title}" to the Recycle Bin? You can restore it anytime from the Recycle Bin.`,
          confirmLabel: "Move to Recycle Bin",
          onConfirm: () => handleMoveToRecycleBin(task.id),
        });
      },
    },
  });

  // Recycle Bin
  renderRecycleBin({
    container: dom.recycleBinListContainer,
    items: workspace.recycleBin,
    selectedIds: uiState.selectedBinIds,
    classificationColors: workspace.classificationColors,
    handlers: {
      onToggleSelectItem: (id) => {
        if (uiState.selectedBinIds.has(id)) {
          uiState.selectedBinIds.delete(id);
        } else {
          uiState.selectedBinIds.add(id);
        }
        renderApp();
      },
      onToggleSelectAll: () => {
        if (uiState.selectedBinIds.size === workspace.recycleBin.length) {
          uiState.selectedBinIds.clear();
        } else {
          uiState.selectedBinIds = new Set(workspace.recycleBin.map((item) => item.id));
        }
        renderApp();
      },
      onRestore: handleRestoreFromRecycleBin,
      onRequestDeleteSingle: (item) => {
        openConfirmModal({
          title: "Delete Task Forever",
          message: `Permanently delete "${item.title}" from the Recycle Bin? This action cannot be undone.`,
          confirmLabel: "Delete Forever",
          onConfirm: () => handleDeletePermanentSingle(item.id),
        });
      },
    },
  });

  // Update Classification Modal if open
  if (dom.classificationModal && !dom.classificationModal.hidden) {
    refreshClassificationModal();
  }

  // Update AI Chatbox UI
  renderAiSection();
}

// ---------------------------------------------------------------------------
// Task CRUD Handlers
// ---------------------------------------------------------------------------

function handleToggleTaskStatus(taskId) {
  const target = workspace.tasks.find((t) => t.id === taskId);
  if (!target) return;

  const now = new Date().toISOString();
  const nextStatus = target.status === "completed" ? "pending" : "completed";
  const nextProgress = nextStatus === "completed" ? 100 : 0;

  const updatedTasks = workspace.tasks.map((task) =>
    task.id === taskId
      ? { ...task, status: nextStatus, progress: nextProgress, updatedAt: now }
      : task
  );

  commitWorkspace(
    { ...workspace, tasks: updatedTasks },
    nextStatus === "completed"
      ? `Task "${target.title}" marked as Completed (100% progress) and saved.`
      : `Task "${target.title}" marked as Pending (0% progress) and saved.`
  );
}

function handleUpdateTask(taskId, updates) {
  const trimmedTitle = String(updates.title || "").trim();
  if (!trimmedTitle) {
    uiState.editError = "Task name cannot be empty.";
    renderApp();
    return;
  }

  const duplicate = findDuplicateTask(
    workspace.tasks,
    trimmedTitle,
    updates.dueDate,
    updates.dueTime,
    taskId
  );

  if (duplicate) {
    uiState.editError =
      "Cannot update: another task already exists with the same name, due date, and due time.";
    renderApp();
    return;
  }

  const now = new Date().toISOString();
  const updatedTasks = workspace.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          title: trimmedTitle,
          description: String(updates.description || "").trim(),
          classification: updates.classification || task.classification,
          dueDate: updates.dueDate || "",
          dueTime: updates.dueTime || "",
          updatedAt: now,
        }
      : task
  );

  uiState.editingTaskId = null;
  uiState.editError = null;
  commitWorkspace(
    { ...workspace, tasks: updatedTasks },
    `Updated task "${trimmedTitle}" and saved.`
  );
}

function handleMoveToRecycleBin(taskId) {
  const target = workspace.tasks.find((t) => t.id === taskId);
  if (!target) return;

  const recycledItem = {
    ...target,
    deletedAt: new Date().toISOString(),
  };

  if (uiState.editingTaskId === taskId) {
    uiState.editingTaskId = null;
    uiState.editError = null;
  }

  commitWorkspace(
    {
      ...workspace,
      tasks: workspace.tasks.filter((t) => t.id !== taskId),
      recycleBin: [recycledItem, ...workspace.recycleBin],
    },
    `Moved "${target.title}" to Recycle Bin and saved.`,
    "info"
  );
}

function handleClearCompletedTasks() {
  const completedTasks = workspace.tasks.filter((t) => t.status === "completed");
  if (completedTasks.length === 0) return;

  const now = new Date().toISOString();
  const recycledItems = completedTasks.map((task) => ({
    ...task,
    deletedAt: now,
  }));

  commitWorkspace(
    {
      ...workspace,
      tasks: workspace.tasks.filter((t) => t.status !== "completed"),
      recycleBin: [...recycledItems, ...workspace.recycleBin],
    },
    `Cleared ${completedTasks.length} completed ${
      completedTasks.length === 1 ? "task" : "tasks"
    } to the Recycle Bin and saved.`,
    "info"
  );
}

function handleRestoreFromRecycleBin(taskId) {
  const item = workspace.recycleBin.find((t) => t.id === taskId);
  if (!item) return;

  const { deletedAt: _deletedAt, ...restoredTask } = item;
  const restored = {
    ...restoredTask,
    updatedAt: new Date().toISOString(),
  };

  const classifications = workspace.classifications.includes(restored.classification)
    ? workspace.classifications
    : [...workspace.classifications, restored.classification];

  uiState.selectedBinIds.delete(taskId);

  commitWorkspace(
    {
      ...workspace,
      tasks: [restored, ...workspace.tasks],
      recycleBin: workspace.recycleBin.filter((t) => t.id !== taskId),
      classifications,
    },
    `Restored "${restored.title}" to your task list and saved.`
  );
}

function handleDeletePermanentSingle(taskId) {
  const target = workspace.recycleBin.find((t) => t.id === taskId);
  uiState.selectedBinIds.delete(taskId);

  commitWorkspace(
    {
      ...workspace,
      recycleBin: workspace.recycleBin.filter((t) => t.id !== taskId),
    },
    target
      ? `Permanently deleted "${target.title}".`
      : "Permanently deleted task from Recycle Bin.",
    "info"
  );
}

function handleDeletePermanentMultiple() {
  if (uiState.selectedBinIds.size === 0) return;
  const count = uiState.selectedBinIds.size;
  const remaining = workspace.recycleBin.filter(
    (item) => !uiState.selectedBinIds.has(item.id)
  );
  uiState.selectedBinIds.clear();

  commitWorkspace(
    { ...workspace, recycleBin: remaining },
    `Permanently deleted ${count} ${count === 1 ? "task" : "tasks"} from Recycle Bin.`,
    "info"
  );
}

// ---------------------------------------------------------------------------
// Modals: Add Task, Classification, Confirm, Docs
// ---------------------------------------------------------------------------

function openAddTaskModal() {
  if (!dom.addTaskModal) return;

  if (dom.addTaskForm) {
    dom.addTaskForm.reset();
  }
  hideFormAlert(dom.addTaskError);

  renderAddTaskClassificationOptions(
    dom.taskClassificationSelect,
    workspace.classifications,
    workspace.classificationColors,
    dom.addTaskColorDot,
    dom.addTaskColorName,
    workspace.classifications[0] || "Work"
  );

  dom.addTaskModal.hidden = false;
  window.setTimeout(() => dom.taskTitleInput?.focus(), 0);
}

function closeAddTaskModal() {
  if (dom.addTaskModal) {
    dom.addTaskModal.hidden = true;
  }
  hideFormAlert(dom.addTaskError);
}

function openClassificationModal() {
  if (!dom.classificationModal) return;
  if (dom.createClassificationName) {
    dom.createClassificationName.value = "";
  }
  hideFormAlert(dom.classificationError);
  refreshClassificationModal();
  dom.classificationModal.hidden = false;
  window.setTimeout(() => dom.createClassificationName?.focus(), 0);
}

function closeClassificationModal() {
  if (dom.classificationModal) {
    dom.classificationModal.hidden = true;
  }
  hideFormAlert(dom.classificationError);
}

function refreshClassificationModal() {
  renderClassificationModalContent({
    colorGridEl: dom.newClassificationColorGrid,
    existingListEl: dom.existingClassificationsList,
    headingEl: dom.existingClassificationsHeading,
    classifications: workspace.classifications,
    classificationColors: workspace.classificationColors,
    selectedNewColor: uiState.selectedNewColor,
    onSelectNewColor: (color) => {
      uiState.selectedNewColor = color;
      refreshClassificationModal();
    },
    onUpdateExistingColor: (classification, color) => {
      const nextColors = {
        ...workspace.classificationColors,
        [classification]: color,
      };
      commitWorkspace(
        { ...workspace, classificationColors: nextColors },
        `Updated "${classification}" color and saved.`
      );
    },
  });
}

function openConfirmModal({ title, message, confirmLabel, onConfirm }) {
  if (!dom.confirmModal) return;
  uiState.pendingConfirm = onConfirm;
  if (dom.confirmDialogTitle) dom.confirmDialogTitle.textContent = title;
  if (dom.confirmDialogDesc) dom.confirmDialogDesc.textContent = message;
  if (dom.acceptConfirmBtn) dom.acceptConfirmBtn.textContent = confirmLabel;
  dom.confirmModal.hidden = false;
  dom.acceptConfirmBtn?.focus();
}

function closeConfirmModal() {
  if (dom.confirmModal) {
    dom.confirmModal.hidden = true;
  }
  uiState.pendingConfirm = null;
}

function openDocsModal(tab = "modules") {
  if (!dom.docsModal) return;
  setDocsTab(tab);
  dom.docsModal.hidden = false;
}

function closeDocsModal() {
  if (dom.docsModal) {
    dom.docsModal.hidden = true;
  }
}

function setDocsTab(tab) {
  uiState.docsTab = tab;
  const isModules = tab === "modules";
  if (dom.docsTabModules) dom.docsTabModules.classList.toggle("is-active", isModules);
  if (dom.docsTabPrivacy) dom.docsTabPrivacy.classList.toggle("is-active", !isModules);
  if (dom.docsContentModules) dom.docsContentModules.hidden = !isModules;
  if (dom.docsContentPrivacy) dom.docsContentPrivacy.hidden = isModules;
}

function showFormAlert(alertEl, textEl, message) {
  if (textEl) textEl.textContent = message;
  if (alertEl) alertEl.hidden = false;
}

function hideFormAlert(alertEl) {
  if (alertEl) alertEl.hidden = true;
}

// ---------------------------------------------------------------------------
// Account & Database Sync Controls
// ---------------------------------------------------------------------------

function refreshAccountModal() {
  const configured = isCloudSyncConfigured();
  const user = getCurrentAuthUser();
  const isSignedInWithEmail = Boolean(user && user.email && !user.isAnonymous);

  if (dom.navAccountBtn) {
    dom.navAccountBtn.textContent = "Account";
  }

  if (dom.accountUnconfiguredNotice) {
    dom.accountUnconfiguredNotice.hidden = configured;
  }

  if (dom.accountSignedInView) {
    dom.accountSignedInView.hidden = !isSignedInWithEmail;
  }
  if (dom.accountAuthView) {
    dom.accountAuthView.hidden = isSignedInWithEmail;
  }
  if (dom.accountUserEmail) {
    dom.accountUserEmail.textContent = user?.email || "";
  }

  const isSignIn = uiState.accountMode === "signin";
  if (dom.authTabSignin) {
    dom.authTabSignin.classList.toggle("is-active", isSignIn);
    dom.authTabSignin.setAttribute("aria-selected", String(isSignIn));
  }
  if (dom.authTabSignup) {
    dom.authTabSignup.classList.toggle("is-active", !isSignIn);
    dom.authTabSignup.setAttribute("aria-selected", String(!isSignIn));
  }
  if (dom.accountPasswordInput) {
    dom.accountPasswordInput.autocomplete = isSignIn
      ? "current-password"
      : "new-password";
  }
  if (dom.accountSubmitBtn) {
    dom.accountSubmitBtn.disabled = uiState.accountBusy || !configured;
    dom.accountSubmitBtn.textContent = uiState.accountBusy
      ? isSignIn
        ? "Signing in..."
        : "Creating account..."
      : isSignIn
      ? "Sign In"
      : "Create Account";
  }
  if (dom.accountSyncNowBtn) {
    dom.accountSyncNowBtn.disabled = uiState.accountBusy;
  }
  if (dom.accountSignoutBtn) {
    dom.accountSignoutBtn.disabled = uiState.accountBusy;
  }
}

function openAccountModal() {
  if (!dom.accountModal) return;
  hideFormAlert(dom.accountError);
  hideFormAlert(dom.accountInfo);
  refreshAccountModal();
  dom.accountModal.hidden = false;
  const user = getCurrentAuthUser();
  if (!user || !user.email || user.isAnonymous) {
    window.setTimeout(() => dom.accountEmailInput?.focus(), 0);
  }
}

function closeAccountModal() {
  if (dom.accountModal) {
    dom.accountModal.hidden = true;
  }
  hideFormAlert(dom.accountError);
  hideFormAlert(dom.accountInfo);
}

function setAccountMode(mode) {
  uiState.accountMode = mode;
  hideFormAlert(dom.accountError);
  hideFormAlert(dom.accountInfo);
  refreshAccountModal();
}

async function handleAccountAuthSubmit(event) {
  event.preventDefault();
  if (uiState.accountBusy) return;

  hideFormAlert(dom.accountError);
  hideFormAlert(dom.accountInfo);

  const email = (dom.accountEmailInput?.value || "").trim();
  const password = dom.accountPasswordInput?.value || "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormAlert(
      dom.accountError,
      dom.accountErrorText,
      "Please enter a valid email address."
    );
    dom.accountEmailInput?.focus();
    return;
  }

  if (password.length < 6) {
    showFormAlert(
      dom.accountError,
      dom.accountErrorText,
      "Password must be at least 6 characters."
    );
    dom.accountPasswordInput?.focus();
    return;
  }

  uiState.accountBusy = true;
  refreshAccountModal();

  try {
    if (uiState.accountMode === "signin") {
      const result = await signInWithEmail(email, password, workspace);
      workspace = result.state;
      if (dom.accountPasswordInput) dom.accountPasswordInput.value = "";
      renderApp();
      closeAccountModal();
      showSaveNotification(`Signed in as ${result.user.email} and synced tasks.`);
    } else {
      const result = await signUpWithEmail(email, password, workspace);
      if (dom.accountPasswordInput) dom.accountPasswordInput.value = "";
      if (result.needsEmailConfirmation) {
        showFormAlert(
          dom.accountInfo,
          dom.accountInfoText,
          "Account created! Check your email inbox to confirm your address, then sign in."
        );
        uiState.accountMode = "signin";
      } else {
        workspace = result.state;
        renderApp();
        closeAccountModal();
        showSaveNotification(`Account created for ${result.user.email} and synced tasks.`);
      }
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication failed. Please try again.";
    showFormAlert(dom.accountError, dom.accountErrorText, message);
  } finally {
    uiState.accountBusy = false;
    refreshAccountModal();
  }
}

async function handleAccountSyncNow() {
  if (uiState.accountBusy) return;
  hideFormAlert(dom.accountError);
  hideFormAlert(dom.accountInfo);
  uiState.accountBusy = true;
  refreshAccountModal();

  try {
    const result = await syncWorkspaceNow(workspace);
    if (!result.ok) {
      showFormAlert(
        dom.accountError,
        dom.accountErrorText,
        result.error || "Could not sync to Supabase right now."
      );
    } else {
      showFormAlert(
        dom.accountInfo,
        dom.accountInfoText,
        "Workspace synced to Supabase."
      );
    }
  } finally {
    uiState.accountBusy = false;
    refreshAccountModal();
  }
}

async function handleAccountSignOut() {
  if (uiState.accountBusy) return;
  hideFormAlert(dom.accountError);
  hideFormAlert(dom.accountInfo);
  uiState.accountBusy = true;
  refreshAccountModal();

  try {
    await signOutAccount();
    showSaveNotification(
      "Signed out of cloud sync. Your tasks remain saved locally in this browser.",
      "info"
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to sign out right now.";
    showFormAlert(dom.accountError, dom.accountErrorText, message);
  } finally {
    uiState.accountBusy = false;
    refreshAccountModal();
  }
}

// ---------------------------------------------------------------------------
// AI Helper Controls
// ---------------------------------------------------------------------------

function renderAiSection() {
  if (dom.aiChatbox) {
    dom.aiChatbox.hidden = !uiState.ai.isOpen;
  }
  if (dom.aiOfferPopover) {
    dom.aiOfferPopover.hidden =
      uiState.ai.isOpen || !uiState.ai.showOfferPopover || uiState.ai.offerDismissed;
  }
  if (dom.aiFloatingBtn) {
    dom.aiFloatingBtn.hidden = uiState.ai.isOpen;
  }

  renderAiChat({
    messagesEl: dom.aiMessagesList,
    quickButtonsEl: dom.aiQuickButtons,
    quickWrapEl: dom.aiQuickPrompts,
    messages: uiState.ai.messages,
    isLoading: uiState.ai.isLoading,
    quickPrompts: AI_STARTER_PROMPTS,
    onQuickPrompt: (prompt) => {
      void sendAiMessage(prompt);
    },
  });

  if (dom.aiSendBtn && dom.aiHelperInput) {
    dom.aiSendBtn.disabled =
      uiState.ai.isLoading || dom.aiHelperInput.value.trim().length === 0;
  }
}

function openAiChatbox() {
  uiState.ai.isOpen = true;
  uiState.ai.showOfferPopover = false;
  uiState.ai.offerDismissed = true;
  renderAiSection();
  window.setTimeout(() => dom.aiHelperInput?.focus(), 0);
}

function closeAiChatbox() {
  uiState.ai.isOpen = false;
  renderAiSection();
}

function dismissAiOffer() {
  uiState.ai.showOfferPopover = false;
  uiState.ai.offerDismissed = true;
  renderAiSection();
}

async function sendAiMessage(rawQuestion) {
  const question = String(rawQuestion || "").trim();
  if (!question || uiState.ai.isLoading) return;

  const userMsg = {
    id: `ai_u_${Date.now()}`,
    role: "user",
    content: question,
    timestamp: new Date().toISOString(),
  };

  const historySnapshot = [...uiState.ai.messages];
  uiState.ai.messages = [...uiState.ai.messages, userMsg];
  uiState.ai.isLoading = true;
  if (dom.aiHelperInput) {
    dom.aiHelperInput.value = "";
  }
  renderAiSection();

  try {
    const { reply } = await requestAiHelp(question, historySnapshot);
    uiState.ai.messages = [
      ...uiState.ai.messages,
      {
        id: `ai_a_${Date.now()}`,
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      },
    ];
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unable to reach AI Helper right now.";
    uiState.ai.messages = [
      ...uiState.ai.messages,
      {
        id: `ai_e_${Date.now()}`,
        role: "assistant",
        content: errorMessage,
        timestamp: new Date().toISOString(),
        isError: true,
      },
    ];
  } finally {
    uiState.ai.isLoading = false;
    renderAiSection();
  }
}

// ---------------------------------------------------------------------------
// Event Wiring & Bootstrap
// ---------------------------------------------------------------------------

function bindEvents() {
  // Header Navigation
  dom.brandHomeBtn?.addEventListener("click", () => setActiveView("tasks"));
  dom.navTasksBtn?.addEventListener("click", () => setActiveView("tasks"));
  dom.navBinBtn?.addEventListener("click", () => setActiveView("recycleBin"));
  dom.backToTasksBtn?.addEventListener("click", () => setActiveView("tasks"));
  dom.navDocsBtn?.addEventListener("click", () => openDocsModal("modules"));
  dom.navPrivacyBtn?.addEventListener("click", () => openDocsModal("privacy"));
  dom.navAccountBtn?.addEventListener("click", openAccountModal);
  dom.headerAiBtn?.addEventListener("click", openAiChatbox);

  // Workspace Action Buttons
  dom.openAddTaskBtn?.addEventListener("click", openAddTaskModal);
  dom.openClassificationBtn?.addEventListener("click", openClassificationModal);
  dom.dismissSaveBannerBtn?.addEventListener("click", () => {
    if (dom.saveBanner) dom.saveBanner.hidden = true;
  });

  // Filter Tabs
  dom.filterTabs?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-filter-mode]");
    if (!target) return;
    const mode = target.getAttribute("data-filter-mode");
    if (!mode) return;
    uiState.filter.mode = mode;
    renderApp();
  });

  // Due Date Presets
  dom.dueDatePresets?.addEventListener("click", (event) => {
    const target = event.target.closest("[data-date-preset]");
    if (!target) return;
    const preset = target.getAttribute("data-date-preset");
    if (!preset) return;
    uiState.filter.dueDatePreset = preset;
    renderApp();
  });

  dom.specificDateInput?.addEventListener("change", (event) => {
    uiState.filter.specificDate = event.target.value;
    renderApp();
  });

  dom.filterClassificationSelect?.addEventListener("change", (event) => {
    uiState.filter.selectedClassification = event.target.value;
    renderApp();
  });

  // Clear Completed
  dom.clearCompletedBtn?.addEventListener("click", () => {
    const completedCount = workspace.tasks.filter((t) => t.status === "completed").length;
    if (completedCount === 0) return;
    openConfirmModal({
      title: "Clear Completed Tasks",
      message: `Move ${completedCount} completed ${
        completedCount === 1 ? "task" : "tasks"
      } to the Recycle Bin? Pending tasks will remain untouched.`,
      confirmLabel: `Move ${completedCount} to Recycle Bin`,
      onConfirm: handleClearCompletedTasks,
    });
  });

  // Recycle Bin Multi-select Delete
  dom.deleteSelectedBinBtn?.addEventListener("click", () => {
    const count = uiState.selectedBinIds.size;
    if (count === 0) return;
    openConfirmModal({
      title: "Delete Selected Tasks Forever",
      message: `Permanently delete ${count} selected ${
        count === 1 ? "task" : "tasks"
      } from the Recycle Bin? This action cannot be undone.`,
      confirmLabel: `Delete ${count} Forever`,
      onConfirm: handleDeletePermanentMultiple,
    });
  });

  // Add Task Modal Events
  dom.closeAddTaskBtn?.addEventListener("click", closeAddTaskModal);
  dom.cancelAddTaskBtn?.addEventListener("click", closeAddTaskModal);
  dom.addTaskModal?.addEventListener("click", (event) => {
    if (event.target === dom.addTaskModal) closeAddTaskModal();
  });
  dom.taskClassificationSelect?.addEventListener("change", (event) => {
    updateClassificationPreview(
      event.target.value,
      workspace.classificationColors,
      dom.addTaskColorDot,
      dom.addTaskColorName
    );
  });
  dom.taskTitleInput?.addEventListener("input", () => {
    hideFormAlert(dom.addTaskError);
  });
  dom.addTaskForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = (dom.taskTitleInput?.value || "").trim();
    const description = (dom.taskDescriptionInput?.value || "").trim();
    const classification =
      dom.taskClassificationSelect?.value || workspace.classifications[0] || "Work";
    const dueDate = dom.taskDueDateInput?.value || "";
    const dueTime = dom.taskDueTimeInput?.value || "";

    if (!title) {
      showFormAlert(
        dom.addTaskError,
        dom.addTaskErrorText,
        "Please enter a task name before adding."
      );
      dom.taskTitleInput?.focus();
      return;
    }

    const duplicate = findDuplicateTask(workspace.tasks, title, dueDate, dueTime);
    if (duplicate) {
      showFormAlert(
        dom.addTaskError,
        dom.addTaskErrorText,
        "Duplicate task detected: a task with the same name, due date, and due time already exists."
      );
      return;
    }

    const now = new Date().toISOString();
    const newTask = {
      id: generateId(),
      title,
      description,
      classification,
      dueDate,
      dueTime,
      status: "pending",
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };

    closeAddTaskModal();
    commitWorkspace(
      { ...workspace, tasks: [newTask, ...workspace.tasks] },
      `Task "${title}" added and saved.`
    );
  });

  // Classification Modal Events
  dom.closeClassificationBtn?.addEventListener("click", closeClassificationModal);
  dom.classificationModal?.addEventListener("click", (event) => {
    if (event.target === dom.classificationModal) closeClassificationModal();
  });
  dom.createClassificationName?.addEventListener("input", () => {
    hideFormAlert(dom.classificationError);
  });
  dom.classificationForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const trimmed = (dom.createClassificationName?.value || "").trim();
    if (!trimmed) {
      showFormAlert(
        dom.classificationError,
        dom.classificationErrorText,
        "Enter a classification name first."
      );
      dom.createClassificationName?.focus();
      return;
    }

    const exists = workspace.classifications.some(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      showFormAlert(
        dom.classificationError,
        dom.classificationErrorText,
        `Classification "${trimmed}" already exists.`
      );
      return;
    }

    const nextClassifications = [...workspace.classifications, trimmed];
    const nextColors = {
      ...workspace.classificationColors,
      [trimmed]: uiState.selectedNewColor,
    };

    if (dom.createClassificationName) {
      dom.createClassificationName.value = "";
    }
    hideFormAlert(dom.classificationError);

    commitWorkspace(
      {
        ...workspace,
        classifications: nextClassifications,
        classificationColors: nextColors,
      },
      `Classification "${trimmed}" added and saved.`
    );
  });

  // Confirm Modal Events
  dom.closeConfirmBtn?.addEventListener("click", closeConfirmModal);
  dom.cancelConfirmBtn?.addEventListener("click", closeConfirmModal);
  dom.confirmModal?.addEventListener("click", (event) => {
    if (event.target === dom.confirmModal) closeConfirmModal();
  });
  dom.acceptConfirmBtn?.addEventListener("click", () => {
    const action = uiState.pendingConfirm;
    closeConfirmModal();
    if (typeof action === "function") {
      action();
    }
  });

  // Docs Modal Events
  dom.closeDocsBtn?.addEventListener("click", closeDocsModal);
  dom.docsDoneBtn?.addEventListener("click", closeDocsModal);
  dom.docsModal?.addEventListener("click", (event) => {
    if (event.target === dom.docsModal) closeDocsModal();
  });
  dom.docsTabModules?.addEventListener("click", () => setDocsTab("modules"));
  dom.docsTabPrivacy?.addEventListener("click", () => setDocsTab("privacy"));

  // Account Modal Events
  dom.closeAccountBtn?.addEventListener("click", closeAccountModal);
  dom.cancelAccountBtn?.addEventListener("click", closeAccountModal);
  dom.accountModal?.addEventListener("click", (event) => {
    if (event.target === dom.accountModal) closeAccountModal();
  });
  dom.authTabSignin?.addEventListener("click", () => setAccountMode("signin"));
  dom.authTabSignup?.addEventListener("click", () => setAccountMode("signup"));
  dom.accountAuthForm?.addEventListener("submit", (event) => {
    void handleAccountAuthSubmit(event);
  });
  dom.accountSyncNowBtn?.addEventListener("click", () => {
    void handleAccountSyncNow();
  });
  dom.accountSignoutBtn?.addEventListener("click", () => {
    void handleAccountSignOut();
  });

  // AI Helper Events
  dom.aiFloatingBtn?.addEventListener("click", openAiChatbox);
  dom.closeAiChatBtn?.addEventListener("click", closeAiChatbox);
  dom.dismissAiOfferBtn?.addEventListener("click", dismissAiOffer);
  dom.declineAiOfferBtn?.addEventListener("click", dismissAiOffer);
  dom.acceptAiOfferBtn?.addEventListener("click", openAiChatbox);
  dom.aiHelperInput?.addEventListener("input", () => {
    if (dom.aiSendBtn && dom.aiHelperInput) {
      dom.aiSendBtn.disabled =
        uiState.ai.isLoading || dom.aiHelperInput.value.trim().length === 0;
    }
  });
  dom.aiChatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!dom.aiHelperInput) return;
    void sendAiMessage(dom.aiHelperInput.value);
  });

  // Global Escape handler for open modals
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (dom.confirmModal && !dom.confirmModal.hidden) {
      closeConfirmModal();
      return;
    }
    if (dom.addTaskModal && !dom.addTaskModal.hidden) {
      closeAddTaskModal();
      return;
    }
    if (dom.classificationModal && !dom.classificationModal.hidden) {
      closeClassificationModal();
      return;
    }
    if (dom.docsModal && !dom.docsModal.hidden) {
      closeDocsModal();
      return;
    }
    if (dom.accountModal && !dom.accountModal.hidden) {
      closeAccountModal();
    }
  });
}

function init() {
  const initialLoad = loadWorkspaceState(
    (restoredWorkspace) => {
      workspace = restoredWorkspace;
      renderApp();
    },
    () => {
      refreshAccountModal();
    }
  );
  workspace = initialLoad.state;

  if (dom.todayDateLabel) {
    dom.todayDateLabel.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  bindEvents();
  refreshAccountModal();
  renderApp();

  if (initialLoad.error) {
    showSaveNotification(initialLoad.error, "error");
  }

  // Non-blocking AI help offer after 2 seconds (1.1s display trigger)
  window.setTimeout(() => {
    if (!uiState.ai.offerDismissed && !uiState.ai.isOpen) {
      uiState.ai.showOfferPopover = true;
      renderAiSection();
    }
  }, 1100);
}

init();
