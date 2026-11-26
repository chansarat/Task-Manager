# Task Manager Architecture, Internal Modules & API Documentation

## 1. Overview

Task Manager is a local-first To-Do and productivity management web application. All task management data (titles, descriptions, classifications, due dates/times, completion states, and Recycle Bin items) is persisted locally in the browser (`localStorage`) and is **never transmitted to external services**.

## 2. Backend API Reference (`server.ts`)

### `POST /api/ai-helper`
Processes an on-demand productivity, planning, or task-breakdown inquiry submitted by the user in the AI Chatbox using `@google/genai` (`gemini-4-hydrogen`, `ThinkingLevel.LOW`).

- **Privacy Boundary**: Only the user's explicit chat inquiry (`message`) and up to 6 recent chatbox turns (`history`) are sent. No task records are ever included.
- **Request Body** (`application/json`, max `32kb`):
  ```json
  {
    "message": "How should I break down a 2-week study project?",
    "history": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
  ```
- **Responses**:
  - `200 OK`: `{ "reply": "..." }`
  - `400 Bad Request`: `{ "error": "..." }` (empty or oversized `message`)
  - `403 Forbidden`: `{ "error": "..." }` (invalid `GEMINI_API_KEY`)
  - `429 Too Many Requests`: `{ "error": "..." }` (rate limit exceeded)
  - `503 Service Unavailable`: `{ "error": "..." }` (`GEMINI_API_KEY` not configured)

### `GET /api/health`
Returns `{ "ok": true }` for server readiness checks.

---

## 3. Frontend Internal Modules (`src/`)

| Module | Responsibility | Key Exports |
| :--- | :--- | :--- |
| `src/types/task.ts` | Domain TypeScript contracts | `Task`, `RecycledTask`, `TaskFilterState`, `TaskMetrics`, `SaveNotification`, `AiChatMessage` |
| `src/utils/storage.ts` | Local browser persistence & schema validation | `STORAGE_KEY`, `loadWorkspaceState`, `saveWorkspaceState` |
| `src/utils/taskHelpers.ts` | Pure business logic for validation, filtering, metrics, and formatting | `findDuplicateTask`, `filterTasks`, `calculateTaskMetrics`, `isTaskOverdue`, `formatDueSchedule` |
| `src/services/aiHelperService.ts` | Fetch client for `/api/ai-helper` with 15s timeout & error parsing | `requestAiHelp` |
| `src/components/Header.tsx` | Top navigation bar (Tasks, Recycle Bin, Module Docs, Privacy, AI Helper) | `Header` |
| `src/components/StatsStrip.tsx` | 4-column summary metrics & progress bar | `StatsStrip` |
| `src/components/AddTaskForm.tsx` | Main-screen task & classification creation form | `AddTaskForm` |
| `src/components/TaskFilters.tsx` | 5-mode filter bar + Clear Completed trigger | `TaskFilters` |
| `src/components/TaskItem.tsx` | Task row with completion toggle, progress %, inline edit, and soft delete | `TaskItem` |
| `src/components/TaskList.tsx` | Task list container with empty/filtered states | `TaskList` |
| `src/components/RecycleBinView.tsx` | Soft-deleted task recovery & single/multi-select permanent deletion | `RecycleBinView` |
| `src/components/ConfirmDialog.tsx` | Accessible in-app confirmation modal | `ConfirmDialog` |
| `src/components/AiHelperChatbox.tsx` | 2-second non-blocking help prompt & AI chat drawer | `AiHelperChatbox` |
| `src/components/DocsModal.tsx` | In-app module & privacy documentation modal | `DocsModal` |
