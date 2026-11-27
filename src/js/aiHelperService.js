/**
 * @fileoverview Vanilla JS client service wrapper for `/api/ai-helper`.
 *
 * Strictly sends only the user's explicit chatbox inquiry and recent chat
 * turns—never stored tasks, descriptions, or schedules.
 */

/**
 * Sends a user productivity question to `/api/ai-helper`.
 */
export async function requestAiHelp(message, history) {
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "AI Helper server route (/api/ai-helper) is unavailable on static hosting like GitHub Pages. All task features work locally; deploy with Node.js (server.ts) to enable AI Helper."
        );
      }
      throw new Error(data.error || `AI Helper returned status ${response.status}.`);
    }

    if (!data.reply) {
      throw new Error("AI Helper returned an empty response.");
    }

    return { reply: data.reply };
  } catch (err) {
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
