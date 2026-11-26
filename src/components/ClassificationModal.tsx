/**
 * @fileoverview Classification color palette utilities and New Classification modal.
 *
 * Allows users to create new classifications with a chosen color and customize
 * colors assigned to existing categories directly from the main workspace bar.
 */

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, FolderPlus, X } from "lucide-react";
import type { ClassificationColor } from "../types/task";

export const CLASSIFICATION_COLOR_OPTIONS: ReadonlyArray<{
  value: ClassificationColor;
  label: string;
  swatchClass: string;
  textClass: string;
}> = [
  {
    value: "blue",
    label: "Blue",
    swatchClass: "bg-blue-600",
    textClass: "text-blue-800",
  },
  {
    value: "indigo",
    label: "Indigo",
    swatchClass: "bg-indigo-600",
    textClass: "text-indigo-800",
  },
  {
    value: "emerald",
    label: "Emerald",
    swatchClass: "bg-emerald-600",
    textClass: "text-emerald-800",
  },
  {
    value: "teal",
    label: "Teal",
    swatchClass: "bg-teal-600",
    textClass: "text-teal-800",
  },
  {
    value: "amber",
    label: "Amber",
    swatchClass: "bg-amber-500",
    textClass: "text-amber-800",
  },
  {
    value: "rose",
    label: "Rose",
    swatchClass: "bg-rose-600",
    textClass: "text-rose-800",
  },
  {
    value: "violet",
    label: "Violet",
    swatchClass: "bg-violet-600",
    textClass: "text-violet-800",
  },
  {
    value: "slate",
    label: "Slate",
    swatchClass: "bg-slate-600",
    textClass: "text-slate-700",
  },
];

/**
 * Looks up Tailwind swatch & text classes for a given classification name.
 */
export function getClassificationColorMeta(
  classification: string,
  colorMap: Record<string, ClassificationColor>
): { swatchClass: string; textClass: string } {
  const matchedKey = Object.keys(colorMap).find(
    (key) => key.toLowerCase() === classification.toLowerCase()
  );
  const colorValue = matchedKey ? colorMap[matchedKey] : "blue";
  const found =
    CLASSIFICATION_COLOR_OPTIONS.find((opt) => opt.value === colorValue) ??
    CLASSIFICATION_COLOR_OPTIONS[0];
  return {
    swatchClass: found.swatchClass,
    textClass: found.textClass,
  };
}

interface ClassificationModalProps {
  isOpen: boolean;
  classifications: string[];
  classificationColors: Record<string, ClassificationColor>;
  onClose: () => void;
  onAddClassification: (
    name: string,
    color: ClassificationColor
  ) => { ok: boolean; error?: string };
  onUpdateClassificationColor: (
    name: string,
    color: ClassificationColor
  ) => void;
}

export const ClassificationModal: React.FC<ClassificationModalProps> = ({
  isOpen,
  classifications,
  classificationColors,
  onClose,
  onAddClassification,
  onUpdateClassificationColor,
}) => {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] =
    useState<ClassificationColor>("blue");
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Classification name cannot be empty.");
      return;
    }

    const result = onAddClassification(trimmed, selectedColor);
    if (!result.ok) {
      setError(result.error || "Unable to create classification.");
      return;
    }

    setName("");
    setSelectedColor("blue");
    setError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="classification-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
    >
      <section className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-blue-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-blue-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="classification-modal-title"
                className="font-display text-lg font-semibold text-slate-900"
              >
                New Classification
              </h2>
              <p className="text-xs text-slate-500">
                Create a classification or assign a color to any existing category.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close New Classification dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm text-red-800"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Create New Classification Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="create-classification-name"
              className="block text-xs font-medium text-slate-700"
            >
              Classification Name <span className="text-red-600">*</span>
            </label>
            <input
              ref={inputRef}
              id="create-classification-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g., Finance, Health, Client Project"
              maxLength={40}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700">
              Assign Color
            </span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CLASSIFICATION_COLOR_OPTIONS.map((opt) => {
                const active = selectedColor === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedColor(opt.value)}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors ${
                      active
                        ? "border-blue-600 bg-blue-50/70 text-slate-900"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-xs shrink-0 ${opt.swatchClass}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            Add Classification
          </button>
        </form>

        {/* Existing Classifications & Color Assignment */}
        <div className="pt-4 border-t border-blue-100 space-y-3">
          <h3 className="text-xs font-semibold text-slate-700">
            Existing Classifications ({classifications.length})
          </h3>

          <ul className="divide-y divide-blue-100 rounded-xl border border-blue-100 bg-slate-50/40">
            {classifications.map((cls) => {
              const currentMeta = getClassificationColorMeta(
                cls,
                classificationColors
              );
              const matchedKey = Object.keys(classificationColors).find(
                (key) => key.toLowerCase() === cls.toLowerCase()
              );
              const activeColor = matchedKey
                ? classificationColors[matchedKey]
                : "blue";

              return (
                <li
                  key={cls}
                  className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`h-3 w-3 rounded-xs shrink-0 ${currentMeta.swatchClass}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {cls}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1.5"
                    role="group"
                    aria-label={`Assign color for ${cls}`}
                  >
                    {CLASSIFICATION_COLOR_OPTIONS.map((opt) => {
                      const isSelected = activeColor === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            onUpdateClassificationColor(cls, opt.value)
                          }
                          title={`${opt.label}`}
                          aria-label={`Set ${cls} color to ${opt.label}`}
                          aria-pressed={isSelected}
                          className={`flex h-6 w-6 items-center justify-center rounded-md border transition-transform ${
                            opt.swatchClass
                          } ${
                            isSelected
                              ? "border-slate-900 scale-110 ring-2 ring-blue-500/40"
                              : "border-white/80 opacity-80 hover:opacity-100"
                          }`}
                        >
                          {isSelected && (
                            <Check
                              className="h-3.5 w-3.5 text-white"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
};
