/**
 * @fileoverview Vanilla JS client service wrapper for `/api/ai-helper`.
 *
 * Strictly sends only the user's explicit chatbox inquiry and recent chat
 * turns—never stored tasks, descriptions, or schedules.
 * Supports an optional `VITE_AI_API_URL` build variable so static deployments
 * (such as GitHub Pages) can connect to a separately hosted `server.ts` backend.
 */

function resolveAiEndpoint() {
  const configuredBase = String(import.meta.env.VITE_AI_API_URL || "").trim();
  if (!configuredBase) {
    return "/api/ai-helper";
  }

  try {
    const parsed = new URL(configuredBase);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}/api/ai-helper`;
    }
  } catch {
    // Ignore invalid URL and fall back to same-origin API route.
  }

  return "/api/ai-helper";
}

/**
 * Sends a user productivity question to `/api/ai-helper`.
 */
export async function requestAiHelp(message, history) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);
  const endpoint = resolveAiEndpoint();

  try {
    const response = await fetch(endpoint, {
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
      if (response.status === 404 || response.status === 405) {
        throw new Error(
          "AI Helper needs the Node.js backend (server.ts), which static GitHub Pages cannot run directly. Use the Node-hosted site URL, or deploy server.ts and set VITE_AI_API_URL in your GitHub Actions secrets."
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
    if (err instanceof TypeError) {
      throw new Error(
        "Unable to reach the AI Helper backend. Check that your Node server is running and allows this site's origin."
      );
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Unable to reach the AI Helper service.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}
