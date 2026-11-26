/**
 * @fileoverview Client-side service wrapper for `/api/ai-helper`.
 *
 * Strictly sends only the user's explicit chatbox inquiry and recent chat
 * conversation turns—never any stored tasks, descriptions, or schedules.
 */

import type { AiChatMessage } from "../types/task";

export interface AiHelperResponse {
  reply: string;
}

/**
 * Sends a user productivity question to the server-side `/api/ai-helper` route.
 *
 * @param message - The user's explicit question entered in the AI Chatbox.
 * @param history - Prior chatbox turns for conversational context.
 * @returns The assistant's reply text.
 * @throws Error with a clear, user-readable message if the request fails.
 */
export async function requestAiHelp(
  message: string,
  history: AiChatMessage[]
): Promise<AiHelperResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("/api/ai-helper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history: history
          .filter((item) => !item.isError)
          .slice(-6)
          .map((item) => ({
            role: item.role,
            content: item.content,
          })),
      }),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as {
      reply?: string;
      error?: string;
    };

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "AI Helper server route (/api/ai-helper) is unavailable on static hosting like GitHub Pages. All task features work locally; deploy with Node.js (server.ts) to enable AI Helper."
        );
      }
      throw new Error(
        data.error || `AI Helper returned status ${response.status}.`
      );
    }

    if (!data.reply) {
      throw new Error("AI Helper returned an empty response.");
    }

    return { reply: data.reply };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("AI Helper request timed out. Please try again.");
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Unable to reach the AI Helper service.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}
