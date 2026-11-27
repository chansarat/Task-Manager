# Task Manager Architecture, Internal Modules & API Documentation

## 1. Overview

Task Manager is a local-first To-Do and productivity management web application built with **HTML**, **CSS**, and **Vanilla JavaScript** (`index.html`, `src/styles/main.css`, and `src/js/*`). All task management data (titles, descriptions, classifications, due dates/times, completion states, and Recycle Bin items) is persisted locally in the browser (`localStorage`) under `taskledger_workspace_v1`, with optional anonymous-auth cloud sync when Supabase environment variables are configured.

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

## 3. Frontend Modules (HTML, CSS & Vanilla JavaScript)

| File | Responsibility | Key Exports / Sections |
| :--- | :--- | :--- |
| `index.html` | Semantic HTML5 application structure | Header, stats strip, 5-mode filter bar, task list, Recycle Bin, modals, AI Helper dock |
| `src/styles/main.css` | Pure CSS styling & responsive layout | Custom properties, Grid/Flexbox layouts, color swatches, modal & mobile breakpoints |
| `src/js/constants.js` | Configuration & safe SVG builder | `STORAGE_KEY`, `DEFAULT_CLASSIFICATIONS`, `CLASSIFICATION_COLOR_OPTIONS`, `createSvgIcon` |
| `src/js/storage.js` | Browser persistence, schema normalization & optional Supabase sync | `loadWorkspaceState`, `saveWorkspaceState`, `normalizeWorkspaceState` |
| `src/js/taskHelpers.js` | Pure domain logic for validation, urgency sorting, filtering & formatting | `findDuplicateTask`, `filterTasks`, `sortTasksForDisplay`, `calculateTaskMetrics`, `isTaskOverdue` |
| `src/js/renderers.js` | Safe DOM rendering via `createElement` and `textContent` | `renderStatsStrip`, `renderFilterBar`, `renderTaskList`, `renderRecycleBin`, `renderAiChat` |
| `src/js/aiHelperService.js` | Fetch client for `/api/ai-helper` with 15s timeout & error handling | `requestAiHelp` |
| `src/js/main.js` | Main controller managing state, events, dialogs, banners, and AI chatbox | `init`, `commitWorkspace`, `renderApp` |
