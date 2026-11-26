/**
 * @fileoverview AI Helper Chatbox & 2-second offer-help prompt component.
 *
 * Implements FR10 and NFRs:
 * - Pops up a non-blocking offer-help question message within 2 seconds.
 * - Provides an interactive AI Chatbox powered by `/api/ai-helper` for fast
 *   productivity & task-planning guidance.
 * - Maintains strict data privacy: never reads or transmits stored tasks.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { requestAiHelp } from "../services/aiHelperService";
import type { AiChatMessage } from "../types/task";
import { generateId } from "../utils/taskHelpers";

interface AiHelperChatboxProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const STARTER_PROMPTS: readonly string[] = [
  "How should I prioritize urgent vs. important tasks today?",
  "Give me a 5-step checklist to break down a large project.",
  "What is a realistic time-blocking routine for deep focus?",
];

export const AiHelperChatbox: React.FC<AiHelperChatboxProps> = ({
  isOpen,
  onOpen,
  onClose,
}) => {
  const [showOfferPrompt, setShowOfferPrompt] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content:
        "Hi! How can I help you plan, organize, or break down your work today? Ask me anything about task prioritization, checklists, or scheduling.",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  // Pop up a non-blocking question message offering AI help within 2 seconds (at 1.1s)
  useEffect(() => {
    if (isOpen || promptDismissed) {
      return;
    }
    const timer = window.setTimeout(() => {
      setShowOfferPrompt(true);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [isOpen, promptDismissed]);

  useEffect(() => {
    if (isOpen) {
      setShowOfferPrompt(false);
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const userMsg: AiChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { reply } = await requestAiHelp(trimmed, nextMessages);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to get a response from AI Helper.";
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: errorMessage,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2.5 sm:bottom-6 sm:right-6">
      {/* Open AI Chatbox */}
      {isOpen && (
        <aside
          aria-label="AI Helper Chatbox"
          className="flex h-[min(540px,80vh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {/* Chatbox Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-4 w-4 text-blue-300" aria-hidden="true" />
              <div>
                <h2 className="font-display text-sm font-semibold leading-tight">
                  AI Helper
                </h2>
                <p className="text-[11px] text-slate-300">
                  Task planning &amp; productivity guide
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI Helper Chatbox"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Privacy Assurance Banner */}
          <div className="flex items-start gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-[11px] text-slate-600">
            <ShieldCheck
              className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <span>
              Private by design: Your saved task list stays in your browser and is never sent to external services.
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-700 text-white"
                      : msg.isError
                      ? "border border-red-200 bg-red-50 text-red-800"
                      : "border border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  {msg.isError && (
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-red-700">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Error</span>
                    </div>
                  )}
                  {msg.content}
                </div>
                <span className="mt-1 px-1 font-mono text-[10px] text-slate-400 tabular-nums">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" aria-hidden="true" />
                <span>Thinking...</span>
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>

          {/* Quick-Ask Suggestions (shown before first user turn) */}
          {messages.length <= 1 && (
            <div className="border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
              <p className="mb-1.5 text-[11px] font-medium text-slate-500">
                Quick questions:
              </p>
              <div className="flex flex-col gap-1.5">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isLoading}
                    onClick={() => void sendMessage(prompt)}
                    className="text-left rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleFormSubmit}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <label htmlFor="ai-helper-input" className="sr-only">
              Ask AI Helper a question
            </label>
            <input
              id="ai-helper-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask how to organize or plan..."
              disabled={isLoading}
              maxLength={2000}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send question to AI Helper"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </aside>
      )}

      {/* Non-blocking 2-second Offer-Help Question Popover */}
      {!isOpen && showOfferPrompt && (
        <div
          role="status"
          aria-live="polite"
          className="w-72 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium leading-relaxed text-slate-800">
              Need help breaking down a task or planning your schedule?
            </p>
            <button
              type="button"
              onClick={() => {
                setShowOfferPrompt(false);
                setPromptDismissed(true);
              }}
              aria-label="Dismiss AI help offer"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowOfferPrompt(false);
                onOpen();
              }}
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 transition-colors"
            >
              Open AI Helper
            </button>
            <button
              type="button"
              onClick={() => {
                setShowOfferPrompt(false);
                setPromptDismissed(true);
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      {/* Compact Floating Toggle Button (when chatbox is closed) */}
      {!isOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <MessageSquare className="h-4 w-4 text-blue-300" aria-hidden="true" />
          Ask AI Helper
        </button>
      )}
    </div>
  );
};
