/**
 * @fileoverview Active task list container with populated and empty states.
 */

import React from "react";
import { CheckSquare } from "lucide-react";
import type {
  ClassificationColor,
  Task,
  TaskFilterState,
} from "../types/task";
import { TaskItem, type UpdateTaskPayload } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  totalActiveCount: number;
  filter: TaskFilterState;
  classifications: string[];
  classificationColors: Record<string, ClassificationColor>;
  onToggleComplete: (taskId: string) => void;
  onUpdateTask: (payload: UpdateTaskPayload) => { ok: boolean; error?: string };
  onDeleteTask: (taskId: string) => void;
  onResetFilters: () => void;
  onOpenAddTask: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  totalActiveCount,
  filter,
  classifications,
  classificationColors,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
  onResetFilters,
  onOpenAddTask,
}) => {
  if (totalActiveCount === 0) {
    return (
      <section
        aria-label="Task list"
        className="rounded-2xl border border-blue-200/80 bg-white px-6 py-14 text-center shadow-[0_1px_3px_rgba(30,58,138,0.04),0_6px_18px_-6px_rgba(37,99,235,0.08)]"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
          <CheckSquare className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-display text-base font-semibold text-slate-900">
          Your task list is empty
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 leading-relaxed">
          Click Add New Task to create your first task, assign a classification, and optionally set a due date and time.
        </p>
        <button
          type="button"
          onClick={onOpenAddTask}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          Add New Task
        </button>
      </section>
    );
  }

  if (tasks.length === 0) {
    return (
      <section
        aria-label="Filtered task list"
        className="rounded-2xl border border-blue-200/80 bg-white px-6 py-14 text-center shadow-[0_1px_3px_rgba(30,58,138,0.04),0_6px_18px_-6px_rgba(37,99,235,0.08)]"
      >
        <h3 className="font-display text-base font-semibold text-slate-900">
          No tasks match the current filter
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          {filter.mode === "pending" && "There are no pending tasks right now."}
          {filter.mode === "completed" && "No tasks have been marked as completed yet."}
          {filter.mode === "dueDate" && "No tasks match the selected due date criteria."}
          {filter.mode === "classification" &&
            `No tasks found under "${filter.selectedClassification}".`}
          {filter.mode === "all" && "No tasks found."}
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2 text-xs font-medium text-blue-900 hover:bg-blue-100 transition-colors"
        >
          Show All Tasks
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Task list"
      className="rounded-2xl border border-blue-200/80 bg-white shadow-[0_1px_3px_rgba(30,58,138,0.04),0_6px_18px_-6px_rgba(37,99,235,0.08)] overflow-hidden"
    >
      <ul className="divide-y divide-blue-100">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            classifications={classifications}
            classificationColors={classificationColors}
            onToggleComplete={onToggleComplete}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </ul>
    </section>
  );
};
