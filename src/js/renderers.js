/**
 * @fileoverview Safe DOM rendering functions for Task Manager.
 *
 * All user-supplied text (task titles, descriptions, classifications, chat
 * messages) is rendered strictly via `.textContent` and `document.createElement`
 * to prevent HTML/XSS injection.
 */

import {
  CLASSIFICATION_COLOR_OPTIONS,
  createSvgIcon,
  getClassificationColorMeta,
} from "./constants.js";
import {
  formatDueSchedule,
  formatTimestamp,
  getTaskUrgencyTier,
  isTaskOverdue,
} from "./taskHelpers.js";

/**
 * Updates the 4-column summary metrics strip and progress bar.
 */
export function renderStatsStrip(metrics) {
  const totalEl = document.getElementById("stat-total");
  const pendingEl = document.getElementById("stat-pending");
  const completedEl = document.getElementById("stat-completed");
  const progressEl = document.getElementById("stat-progress");
  const fractionEl = document.getElementById("stat-fraction");
  const barEl = document.getElementById("overall-progressbar");
  const fillEl = document.getElementById("overall-progress-fill");

  if (totalEl) totalEl.textContent = String(metrics.total);
  if (pendingEl) pendingEl.textContent = String(metrics.pending);
  if (completedEl) completedEl.textContent = String(metrics.completed);
  if (progressEl) progressEl.textContent = `${metrics.progressPercentage}%`;
  if (fractionEl) fractionEl.textContent = `${metrics.completed}/${metrics.total}`;

  if (barEl) {
    barEl.setAttribute("aria-valuenow", String(metrics.progressPercentage));
    barEl.setAttribute(
      "aria-label",
      `Overall task completion ${metrics.progressPercentage}%`
    );
  }
  if (fillEl) {
    fillEl.style.width = `${metrics.progressPercentage}%`;
  }
}

/**
 * Updates the 5-mode filter bar, secondary filter rows, and Clear Completed control.
 */
export function renderFilterBar(filter, classifications, metrics, visibleCount) {
  const tabsContainer = document.getElementById("filter-tabs");
  if (tabsContainer) {
    const tabButtons = tabsContainer.querySelectorAll("[data-filter-mode]");
    tabButtons.forEach((btn) => {
      const isSelected = btn.getAttribute("data-filter-mode") === filter.mode;
      btn.classList.toggle("is-active", isSelected);
      btn.setAttribute("aria-selected", String(isSelected));
    });
  }

  const countLabel = document.getElementById("filter-count-label");
  if (countLabel) {
    countLabel.textContent = `Showing ${visibleCount} of ${metrics.total}`;
  }

  const clearBtn = document.getElementById("clear-completed-btn");
  const clearCount = document.getElementById("clear-completed-count");
  if (clearCount) {
    clearCount.textContent = String(metrics.completed);
  }
  if (clearBtn) {
    clearBtn.disabled = metrics.completed === 0;
  }

  const dueDateRow = document.getElementById("due-date-subfilter");
  const classificationRow = document.getElementById("classification-subfilter");

  if (dueDateRow) {
    dueDateRow.hidden = filter.mode !== "dueDate";
    const presetButtons = dueDateRow.querySelectorAll("[data-date-preset]");
    presetButtons.forEach((btn) => {
      const isSelected = btn.getAttribute("data-date-preset") === filter.dueDatePreset;
      btn.classList.toggle("is-active", isSelected);
    });
  }

  const specificDateWrap = document.getElementById("specific-date-wrap");
  const specificDateInput = document.getElementById("specific-date-input");
  if (specificDateWrap) {
    specificDateWrap.hidden = filter.dueDatePreset !== "specific_date";
  }
  if (specificDateInput && specificDateInput.value !== filter.specificDate) {
    specificDateInput.value = filter.specificDate;
  }

  if (classificationRow) {
    classificationRow.hidden = filter.mode !== "classification";
  }

  const classSelect = document.getElementById("filter-classification-select");
  if (classSelect) {
    classSelect.textContent = "";

    const allOption = document.createElement("option");
    allOption.value = "__ALL__";
    allOption.textContent = "All Classifications";
    classSelect.appendChild(allOption);

    for (const category of classifications) {
      const opt = document.createElement("option");
      opt.value = category;
      opt.textContent = category;
      classSelect.appendChild(opt);
    }

    classSelect.value = filter.selectedClassification || "__ALL__";
  }
}

/**
 * Populates the classification select and updates the color preview dot in Add New Task modal.
 */
export function renderAddTaskClassificationOptions(
  selectEl,
  classifications,
  colorMap,
  previewDotEl,
  previewNameEl,
  selectedValue
) {
  if (!selectEl) return;

  selectEl.textContent = "";
  for (const cat of classifications) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  }

  const resolved = classifications.includes(selectedValue)
    ? selectedValue
    : classifications[0] || "Work";
  selectEl.value = resolved;

  updateClassificationPreview(resolved, colorMap, previewDotEl, previewNameEl);
}

/**
 * Updates the color swatch dot and label next to a classification dropdown.
 */
export function updateClassificationPreview(
  classification,
  colorMap,
  previewDotEl,
  previewNameEl
) {
  const meta = getClassificationColorMeta(classification, colorMap);
  if (previewDotEl) {
    previewDotEl.className = `color-swatch ${meta.swatchClass}`;
  }
  if (previewNameEl) {
    previewNameEl.textContent = classification || "";
  }
}

/**
 * Renders the color picker grid and existing classification swatch rows inside the Classification modal.
 */
export function renderClassificationModalContent({
  colorGridEl,
  existingListEl,
  headingEl,
  classifications,
  classificationColors,
  selectedNewColor,
  onSelectNewColor,
  onUpdateExistingColor,
}) {
  if (colorGridEl) {
    colorGridEl.textContent = "";
    for (const option of CLASSIFICATION_COLOR_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `color-option-btn${selectedNewColor === option.value ? " is-active" : ""}`;
      btn.setAttribute("aria-pressed", String(selectedNewColor === option.value));

      const swatch = document.createElement("span");
      swatch.className = `color-swatch ${option.swatchClass}`;
      swatch.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.textContent = option.label;

      btn.appendChild(swatch);
      btn.appendChild(label);
      btn.addEventListener("click", () => onSelectNewColor(option.value));
      colorGridEl.appendChild(btn);
    }
  }

  if (headingEl) {
    headingEl.textContent = `Existing Classifications (${classifications.length})`;
  }

  if (existingListEl) {
    existingListEl.textContent = "";
    for (const category of classifications) {
      const li = document.createElement("li");
      li.className = "existing-list-item";

      const meta = getClassificationColorMeta(category, classificationColors);

      const left = document.createElement("div");
      left.className = "existing-item-name";

      const dot = document.createElement("span");
      dot.className = `color-swatch ${meta.swatchClass}`;
      dot.setAttribute("aria-hidden", "true");

      const nameSpan = document.createElement("span");
      nameSpan.textContent = category;

      left.appendChild(dot);
      left.appendChild(nameSpan);

      const swatchRow = document.createElement("div");
      swatchRow.className = "swatch-row";

      for (const option of CLASSIFICATION_COLOR_OPTIONS) {
        const isSelected = meta.value === option.value;
        const swatchBtn = document.createElement("button");
        swatchBtn.type = "button";
        swatchBtn.className = `swatch-btn ${option.swatchClass}${isSelected ? " is-selected" : ""}`;
        swatchBtn.title = `${category}: ${option.label}`;
        swatchBtn.setAttribute("aria-label", `Set ${category} color to ${option.label}`);
        swatchBtn.setAttribute("aria-pressed", String(isSelected));

        if (isSelected) {
          swatchBtn.appendChild(createSvgIcon("check", "icon-xs"));
        }

        swatchBtn.addEventListener("click", () => {
          onUpdateExistingColor(category, option.value);
        });
        swatchRow.appendChild(swatchBtn);
      }

      li.appendChild(left);
      li.appendChild(swatchRow);
      existingListEl.appendChild(li);
    }
  }
}

/**
 * Builds an inline edit row for a task being updated.
 */
function buildInlineEditRow({
  task,
  classifications,
  editError,
  onSaveEdit,
  onCancelEdit,
}) {
  const li = document.createElement("li");
  li.className = "task-edit-item";

  const header = document.createElement("div");
  header.className = "task-edit-header";

  const heading = document.createElement("span");
  heading.className = "task-edit-heading";
  heading.textContent = "Editing Task";

  const cancelTopBtn = document.createElement("button");
  cancelTopBtn.type = "button";
  cancelTopBtn.className = "btn-text";
  cancelTopBtn.textContent = "Cancel";
  cancelTopBtn.addEventListener("click", onCancelEdit);

  header.appendChild(heading);
  header.appendChild(cancelTopBtn);
  li.appendChild(header);

  if (editError) {
    const alert = document.createElement("div");
    alert.className = "form-alert";
    alert.setAttribute("role", "alert");
    alert.style.marginTop = "0";
    alert.style.marginBottom = "12px";
    alert.appendChild(createSvgIcon("alert", "icon-sm shrink-0"));

    const errText = document.createElement("span");
    errText.textContent = editError;
    alert.appendChild(errText);
    li.appendChild(alert);
  }

  const form = document.createElement("form");
  form.className = "modal-form";
  form.style.marginTop = "0";
  form.noValidate = true;

  const grid = document.createElement("div");
  grid.className = "task-edit-grid";

  // Title input
  const titleWrap = document.createElement("div");
  titleWrap.className = "form-field";
  const titleLabel = document.createElement("label");
  titleLabel.className = "field-label";
  titleLabel.htmlFor = `edit-title-${task.id}`;
  titleLabel.textContent = "Task Name *";
  const titleInput = document.createElement("input");
  titleInput.id = `edit-title-${task.id}`;
  titleInput.type = "text";
  titleInput.maxLength = 140;
  titleInput.value = task.title;
  titleInput.className = "field-input field-input-sm";
  titleWrap.appendChild(titleLabel);
  titleWrap.appendChild(titleInput);

  // Classification select
  const classWrap = document.createElement("div");
  classWrap.className = "form-field";
  const classLabel = document.createElement("label");
  classLabel.className = "field-label";
  classLabel.htmlFor = `edit-class-${task.id}`;
  classLabel.textContent = "Classification";
  const classSelect = document.createElement("select");
  classSelect.id = `edit-class-${task.id}`;
  classSelect.className = "field-input field-input-sm";

  const availableCategories = classifications.includes(task.classification)
    ? classifications
    : [...classifications, task.classification];
  for (const cat of availableCategories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    classSelect.appendChild(opt);
  }
  classSelect.value = task.classification;
  classWrap.appendChild(classLabel);
  classWrap.appendChild(classSelect);

  // Due Date input
  const dateWrap = document.createElement("div");
  dateWrap.className = "form-field";
  const dateLabel = document.createElement("label");
  dateLabel.className = "field-label";
  dateLabel.htmlFor = `edit-date-${task.id}`;
  dateLabel.textContent = "Due Date";
  const dateInput = document.createElement("input");
  dateInput.id = `edit-date-${task.id}`;
  dateInput.type = "date";
  dateInput.value = task.dueDate;
  dateInput.className = "field-input field-input-sm font-mono";
  dateWrap.appendChild(dateLabel);
  dateWrap.appendChild(dateInput);

  // Due Time input
  const timeWrap = document.createElement("div");
  timeWrap.className = "form-field";
  const timeLabel = document.createElement("label");
  timeLabel.className = "field-label";
  timeLabel.htmlFor = `edit-time-${task.id}`;
  timeLabel.textContent = "Due Time";
  const timeInput = document.createElement("input");
  timeInput.id = `edit-time-${task.id}`;
  timeInput.type = "time";
  timeInput.value = task.dueTime;
  timeInput.className = "field-input field-input-sm font-mono";
  timeWrap.appendChild(timeLabel);
  timeWrap.appendChild(timeInput);

  grid.appendChild(titleWrap);
  grid.appendChild(classWrap);
  grid.appendChild(dateWrap);
  grid.appendChild(timeWrap);
  form.appendChild(grid);

  // Description textarea
  const descWrap = document.createElement("div");
  descWrap.className = "form-field";
  const descLabel = document.createElement("label");
  descLabel.className = "field-label";
  descLabel.htmlFor = `edit-desc-${task.id}`;
  descLabel.textContent = "Description (optional)";
  const descInput = document.createElement("textarea");
  descInput.id = `edit-desc-${task.id}`;
  descInput.rows = 2;
  descInput.maxLength = 400;
  descInput.value = task.description;
  descInput.placeholder = "Optional details...";
  descInput.className = "field-textarea field-input-sm";
  descWrap.appendChild(descLabel);
  descWrap.appendChild(descInput);
  form.appendChild(descWrap);

  const actions = document.createElement("div");
  actions.className = "task-edit-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-outline btn-xs";
  cancelBtn.appendChild(createSvgIcon("x", "icon-xs"));
  cancelBtn.appendChild(document.createTextNode("Cancel"));
  cancelBtn.addEventListener("click", onCancelEdit);

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "btn btn-primary btn-xs";
  saveBtn.appendChild(createSvgIcon("check", "icon-xs"));
  saveBtn.appendChild(document.createTextNode("Save Changes"));

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  form.appendChild(actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSaveEdit(task.id, {
      title: titleInput.value,
      description: descInput.value,
      classification: classSelect.value,
      dueDate: dateInput.value,
      dueTime: timeInput.value,
    });
  });

  li.appendChild(form);
  return li;
}

/**
 * Builds a standard task row with completion checkbox, metadata, and Edit/Delete actions.
 */
function buildTaskRow({
  task,
  classificationColors,
  onToggleStatus,
  onStartEdit,
  onRequestDelete,
}) {
  const isCompleted = task.status === "completed";
  const overdue = isTaskOverdue(task);
  const urgencyTier = getTaskUrgencyTier(task);
  const colorMeta = getClassificationColorMeta(
    task.classification,
    classificationColors
  );

  const li = document.createElement("li");
  li.className = `task-item${isCompleted ? " is-completed" : ""}`;

  const main = document.createElement("div");
  main.className = "task-item-main";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `task-check-${task.id}`;
  checkbox.className = "task-checkbox";
  checkbox.checked = isCompleted;
  checkbox.setAttribute(
    "aria-label",
    `Mark "${task.title}" as ${isCompleted ? "pending" : "completed"}`
  );
  checkbox.addEventListener("change", () => onToggleStatus(task.id));

  const body = document.createElement("div");
  body.className = "task-item-body";

  const titleLabel = document.createElement("label");
  titleLabel.htmlFor = checkbox.id;
  titleLabel.className = "task-title";
  titleLabel.textContent = task.title;

  const desc = document.createElement("p");
  if (task.description) {
    desc.className = "task-description";
    desc.textContent = task.description;
  } else {
    desc.className = "task-description is-empty";
    desc.textContent = "No description added";
  }

  const meta = document.createElement("div");
  meta.className = "task-meta-row";

  // Classification with color swatch
  const catSpan = document.createElement("span");
  catSpan.className = `meta-classification ${colorMeta.textClass}`;
  const swatch = document.createElement("span");
  swatch.className = `color-swatch ${colorMeta.swatchClass}`;
  swatch.setAttribute("aria-hidden", "true");
  catSpan.appendChild(swatch);
  catSpan.appendChild(document.createTextNode(task.classification));
  meta.appendChild(catSpan);

  const appendSeparator = () => {
    const sep = document.createElement("span");
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "•";
    meta.appendChild(sep);
  };

  appendSeparator();

  const dueSpan = document.createElement("span");
  if (overdue) {
    dueSpan.className = "meta-overdue";
  } else if (urgencyTier === 1 || urgencyTier === 2) {
    dueSpan.className = "meta-urgent";
  }
  let dueText = formatDueSchedule(task.dueDate, task.dueTime);
  if (overdue) {
    dueText += " (Urgent · Overdue)";
  } else if (urgencyTier === 1) {
    dueText += " (Urgent · Due today)";
  } else if (urgencyTier === 2) {
    dueText += " (Urgent · Due tomorrow)";
  }
  dueSpan.textContent = dueText;
  meta.appendChild(dueSpan);

  appendSeparator();

  const statusSpan = document.createElement("span");
  statusSpan.className = isCompleted ? "meta-status-completed" : "meta-status-pending";
  statusSpan.textContent = isCompleted ? "Completed" : "Pending";
  meta.appendChild(statusSpan);

  appendSeparator();

  const progressSpan = document.createElement("span");
  progressSpan.className = "meta-progress tabular-nums";
  progressSpan.textContent = `Progress: ${task.progress}%`;
  meta.appendChild(progressSpan);

  body.appendChild(titleLabel);
  body.appendChild(desc);
  body.appendChild(meta);

  main.appendChild(checkbox);
  main.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "task-item-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn-outline btn-xs";
  editBtn.setAttribute("aria-label", `Edit ${task.title}`);
  editBtn.appendChild(createSvgIcon("pencil", "icon-xs"));
  editBtn.appendChild(document.createTextNode("Edit"));
  editBtn.addEventListener("click", () => onStartEdit(task.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-outline-danger btn-xs";
  deleteBtn.setAttribute("aria-label", `Delete ${task.title}`);
  deleteBtn.appendChild(createSvgIcon("trash", "icon-xs"));
  deleteBtn.appendChild(document.createTextNode("Delete"));
  deleteBtn.addEventListener("click", () => onRequestDelete(task));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(main);
  li.appendChild(actions);
  return li;
}

/**
 * Renders either an empty state or the sorted task list into `#task-list-section`.
 */
export function renderTaskList({
  container,
  tasks,
  totalActiveCount,
  filter,
  classifications,
  classificationColors,
  editingTaskId,
  editError,
  handlers,
}) {
  if (!container) return;
  container.textContent = "";

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const iconBox = document.createElement("div");
    iconBox.className = "empty-icon-box";
    iconBox.appendChild(createSvgIcon("checkSquare", "icon-lg"));

    const title = document.createElement("h2");
    title.className = "empty-title";
    const text = document.createElement("p");
    text.className = "empty-text";

    const ctaWrap = document.createElement("div");
    ctaWrap.className = "empty-cta";

    if (totalActiveCount === 0) {
      title.textContent = "Your task list is empty";
      text.textContent =
        "Use Add New Task above to create your first task with a classification and optional due date.";
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-primary btn-sm";
      addBtn.textContent = "Add New Task";
      addBtn.addEventListener("click", handlers.onOpenAddTask);
      ctaWrap.appendChild(addBtn);
    } else {
      title.textContent = "No tasks match this filter";
      if (filter.mode === "dueDate" && filter.dueDatePreset === "overdue") {
        text.textContent = "Great news—you have zero overdue tasks right now.";
      } else {
        text.textContent =
          "Try switching tabs or resetting to All Tasks to see your complete list.";
      }
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "btn btn-secondary btn-sm";
      resetBtn.textContent = "Show All Tasks";
      resetBtn.addEventListener("click", handlers.onResetFilter);
      ctaWrap.appendChild(resetBtn);
    }

    empty.appendChild(iconBox);
    empty.appendChild(title);
    empty.appendChild(text);
    empty.appendChild(ctaWrap);
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("ul");
  list.className = "task-list";

  for (const task of tasks) {
    if (editingTaskId === task.id) {
      list.appendChild(
        buildInlineEditRow({
          task,
          classifications,
          editError,
          onSaveEdit: handlers.onSaveEdit,
          onCancelEdit: handlers.onCancelEdit,
        })
      );
    } else {
      list.appendChild(
        buildTaskRow({
          task,
          classificationColors,
          onToggleStatus: handlers.onToggleStatus,
          onStartEdit: handlers.onStartEdit,
          onRequestDelete: handlers.onRequestDelete,
        })
      );
    }
  }

  container.appendChild(list);
}

/**
 * Renders the Recycle Bin view, counts, select-all bar, and soft-deleted items.
 */
export function renderRecycleBin({
  container,
  items,
  selectedIds,
  classificationColors,
  handlers,
}) {
  const navCountEl = document.getElementById("nav-bin-count");
  if (navCountEl) {
    navCountEl.textContent = String(items.length);
  }

  const itemsCountEl = document.getElementById("bin-items-count");
  if (itemsCountEl) {
    itemsCountEl.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  }

  const selectedCountEl = document.getElementById("bin-selected-count");
  if (selectedCountEl) {
    selectedCountEl.textContent = String(selectedIds.size);
  }

  const deleteSelectedBtn = document.getElementById("delete-selected-bin-btn");
  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = selectedIds.size === 0;
  }

  if (!container) return;
  container.textContent = "";

  const card = document.createElement("div");
  card.className = "card list-card";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const iconBox = document.createElement("div");
    iconBox.className = "empty-icon-box";
    iconBox.appendChild(createSvgIcon("trash", "icon-lg"));

    const title = document.createElement("h3");
    title.className = "empty-title";
    title.textContent = "Recycle Bin is empty";

    const text = document.createElement("p");
    text.className = "empty-text";
    text.textContent =
      "Deleted tasks and cleared completed tasks appear here so you can restore them anytime.";

    empty.appendChild(iconBox);
    empty.appendChild(title);
    empty.appendChild(text);
    card.appendChild(empty);
    container.appendChild(card);
    return;
  }

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const selectAllBar = document.createElement("div");
  selectAllBar.className = "bin-select-all-bar";

  const selectAllLabel = document.createElement("label");
  selectAllLabel.className = "bin-select-all-label";

  const selectAllCheckbox = document.createElement("input");
  selectAllCheckbox.type = "checkbox";
  selectAllCheckbox.className = "bin-checkbox";
  selectAllCheckbox.checked = allSelected;
  selectAllCheckbox.addEventListener("change", handlers.onToggleSelectAll);

  const selectAllText = document.createElement("span");
  selectAllText.textContent = allSelected
    ? "Deselect all items"
    : "Select all items for permanent deletion";

  selectAllLabel.appendChild(selectAllCheckbox);
  selectAllLabel.appendChild(selectAllText);

  const selectedLabel = document.createElement("span");
  selectedLabel.className = "tabular-nums";
  selectedLabel.textContent = `${selectedIds.size} selected`;

  selectAllBar.appendChild(selectAllLabel);
  selectAllBar.appendChild(selectedLabel);
  card.appendChild(selectAllBar);

  const list = document.createElement("ul");
  list.className = "task-list";

  for (const item of items) {
    const isSelected = selectedIds.has(item.id);
    const colorMeta = getClassificationColorMeta(
      item.classification,
      classificationColors
    );

    const li = document.createElement("li");
    li.className = `task-item${isSelected ? " is-selected-bin" : ""}`;

    const main = document.createElement("div");
    main.className = "task-item-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bin-checkbox";
    checkbox.style.marginTop = "4px";
    checkbox.checked = isSelected;
    checkbox.setAttribute("aria-label", `Select ${item.title} for permanent deletion`);
    checkbox.addEventListener("change", () => handlers.onToggleSelectItem(item.id));

    const body = document.createElement("div");
    body.className = "task-item-body";

    const title = document.createElement("p");
    title.className = "task-title";
    title.style.cursor = "default";
    title.textContent = item.title;
    body.appendChild(title);

    if (item.description) {
      const desc = document.createElement("p");
      desc.className = "task-description";
      desc.textContent = item.description;
      body.appendChild(desc);
    }

    const meta = document.createElement("div");
    meta.className = "task-meta-row";

    const catSpan = document.createElement("span");
    catSpan.className = `meta-classification ${colorMeta.textClass}`;
    const swatch = document.createElement("span");
    swatch.className = `color-swatch ${colorMeta.swatchClass}`;
    swatch.setAttribute("aria-hidden", "true");
    catSpan.appendChild(swatch);
    catSpan.appendChild(document.createTextNode(item.classification));
    meta.appendChild(catSpan);

    const sep1 = document.createElement("span");
    sep1.setAttribute("aria-hidden", "true");
    sep1.textContent = "•";
    meta.appendChild(sep1);

    const dueSpan = document.createElement("span");
    dueSpan.textContent = formatDueSchedule(item.dueDate, item.dueTime);
    meta.appendChild(dueSpan);

    const sep2 = document.createElement("span");
    sep2.setAttribute("aria-hidden", "true");
    sep2.textContent = "•";
    meta.appendChild(sep2);

    const deletedSpan = document.createElement("span");
    deletedSpan.textContent = `Deleted ${formatTimestamp(item.deletedAt)}`;
    meta.appendChild(deletedSpan);

    body.appendChild(meta);
    main.appendChild(checkbox);
    main.appendChild(body);

    const actions = document.createElement("div");
    actions.className = "task-item-actions";

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "btn btn-outline btn-xs";
    restoreBtn.appendChild(createSvgIcon("restore", "icon-xs"));
    restoreBtn.appendChild(document.createTextNode("Restore"));
    restoreBtn.addEventListener("click", () => handlers.onRestore(item.id));

    const deleteForeverBtn = document.createElement("button");
    deleteForeverBtn.type = "button";
    deleteForeverBtn.className = "btn btn-outline-danger btn-xs";
    deleteForeverBtn.appendChild(createSvgIcon("trash", "icon-xs"));
    deleteForeverBtn.appendChild(document.createTextNode("Delete Forever"));
    deleteForeverBtn.addEventListener("click", () => handlers.onRequestDeleteSingle(item));

    actions.appendChild(restoreBtn);
    actions.appendChild(deleteForeverBtn);

    li.appendChild(main);
    li.appendChild(actions);
    list.appendChild(li);
  }

  card.appendChild(list);
  container.appendChild(card);
}

/**
 * Renders AI Helper chat messages and quick prompt buttons safely.
 */
export function renderAiChat({
  messagesEl,
  quickButtonsEl,
  quickWrapEl,
  messages,
  isLoading,
  quickPrompts,
  onQuickPrompt,
}) {
  if (messagesEl) {
    messagesEl.textContent = "";

    for (const msg of messages) {
      const wrap = document.createElement("div");
      wrap.className = `ai-msg-wrap ${msg.role === "user" ? "is-user" : "is-assistant"}`;

      const bubble = document.createElement("div");
      if (msg.role === "user") {
        bubble.className = "ai-msg-bubble is-user";
      } else if (msg.isError) {
        bubble.className = "ai-msg-bubble is-error";
      } else {
        bubble.className = "ai-msg-bubble is-assistant";
      }
      bubble.textContent = msg.content;

      const time = document.createElement("span");
      time.className = "ai-msg-time";
      time.textContent = formatTimestamp(msg.timestamp);

      wrap.appendChild(bubble);
      wrap.appendChild(time);
      messagesEl.appendChild(wrap);
    }

    if (isLoading) {
      const loading = document.createElement("div");
      loading.className = "ai-loading";
      loading.textContent = "Thinking...";
      messagesEl.appendChild(loading);
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  if (quickWrapEl) {
    quickWrapEl.hidden = messages.length > 1;
  }

  if (quickButtonsEl && messages.length <= 1) {
    quickButtonsEl.textContent = "";
    for (const prompt of quickPrompts) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-quick-btn";
      btn.textContent = prompt;
      btn.disabled = isLoading;
      btn.addEventListener("click", () => onQuickPrompt(prompt));
      quickButtonsEl.appendChild(btn);
    }
  }
}
