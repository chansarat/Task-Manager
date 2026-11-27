/**
 * @fileoverview Express server entry point for Task Manager.
 *
 * Serves the Vite SPA middleware in development and the compiled static bundle
 * in production on port 3000. Also exposes the `/api/ai-helper` endpoint backed
 * by the `@google/genai` SDK (`gemini-4-hydrogen`) so the Gemini API key
 * remains exclusively on the server.
 *
 * Privacy guarantee: This server never receives, stores, or persists user task
 * records. Only explicit user inquiries submitted via the AI Helper chatbox
 * are processed.
 */

import dotenv from "dotenv";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Maximum character length permitted for a single AI Helper chat inquiry.
 */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Maximum number of prior chat turns forwarded for conversational continuity.
 */
const MAX_HISTORY_ITEMS = 6;

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface AiHelperRequestBody {
  message?: unknown;
  history?: unknown;
}

/**
 * Creates a configured `@google/genai` client instance when `GEMINI_API_KEY`
 * is present in the server environment.
 *
 * @returns Configured GoogleGenAI instance, or null if the key is unset.
 */
function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Validates and normalizes optional chat history sent from the AI Chatbox.
 *
 * @param rawHistory - Unknown payload value for `history`.
 * @returns Sanitized array of prior chat messages capped to `MAX_HISTORY_ITEMS`.
 */
function sanitizeHistory(rawHistory: unknown): ChatHistoryItem[] {
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  const sanitized: ChatHistoryItem[] = [];
  for (const item of rawHistory.slice(-MAX_HISTORY_ITEMS)) {
    if (
      item &&
      typeof item === "object" &&
      "role" in item &&
      "content" in item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string" &&
      item.content.trim().length > 0
    ) {
      sanitized.push({
        role: item.role,
        content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
      });
    }
  }
  return sanitized;
}

function getAllowedOrigins(): Set<string> {
  const raw = process.env.ALLOWED_ORIGINS || "";
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter((origin) => /^https?:\/\/[^/\s]+$/i.test(origin))
  );
}

/**
 * Boots the Express server, attaches API routes, and mounts either Vite's
 * development middleware or the production static build.
 */
async function startServer(): Promise<void> {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(express.json({ limit: "32kb" }));

  app.use("/api", (req: Request, res: Response, next) => {
    const requestOrigin = req.headers.origin;
    if (typeof requestOrigin === "string" && allowedOrigins.has(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });

  /**
   * POST /api/ai-helper
   *
   * Processes an on-demand productivity/planning inquiry from the AI Helper
   * chatbox using `gemini-4-hydrogen` with low thinking latency.
   */
  app.post("/api/ai-helper", async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as AiHelperRequestBody;
    const rawMessage = typeof body.message === "string" ? body.message.trim() : "";

    if (!rawMessage) {
      res.status(400).json({
        error: "Please enter a question before sending to the AI Helper.",
      });
      return;
    }

    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        error: `Question is too long. Please keep inquiries under ${MAX_MESSAGE_LENGTH} characters.`,
      });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          "Gemini API key is not configured. Add GEMINI_API_KEY in Settings > Secrets to enable AI Helper responses.",
      });
      return;
    }

    const history = sanitizeHistory(body.history);
    const formattedHistory = history
      .map((entry) =>
        `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content}`
      )
      .join("\n");

    const prompt = formattedHistory
      ? `Previous conversation:\n${formattedHistory}\n\nCurrent question:\n${rawMessage}`
      : rawMessage;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "You are Task Manager's concise, practical productivity and task-planning assistant. Help users break down work, estimate realistic steps, organize classifications, prioritize deadlines, and overcome procrastination. Keep answers clear, structured, and concise (under 180 words unless asked for more detail). Never ask for or claim access to private user task databases.",
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const replyText = response.text?.trim();
      if (!replyText) {
        res.status(502).json({
          error: "The AI Helper returned an empty response. Please try rephrasing your question.",
        });
        return;
      }

      res.json({ reply: replyText });
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "Unexpected error contacting Gemini API.";

      if (errMsg.includes("403") || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("API_KEY_INVALID")) {
        res.status(403).json({
          error:
            "Your Gemini API key appears invalid or lacks permission. Please verify it in Settings > Secrets.",
        });
        return;
      }

      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        res.status(429).json({
          error:
            "AI Helper rate limit reached. Please wait a moment and try again.",
        });
        return;
      }

      res.status(500).json({
        error: `AI Helper request failed: ${errMsg}`,
      });
    }
  });

  /**
   * GET /api/health
   * Simple readiness probe verifying server availability.
   */
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Production build not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Task Manager server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Task Manager server:", err);
  process.exit(1);
});
