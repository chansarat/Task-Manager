/**
 * @fileoverview Static configuration, color options, starter AI prompts, and SVG icon helpers.
 */

export const STORAGE_KEY = "taskledger_workspace_v1";
export const CLOUD_RELOAD_KEY = "taskledger_supabase_restore_v1";

export const DEFAULT_CLASSIFICATIONS = ["Work", "Personal", "Study"];

export const DEFAULT_CLASSIFICATION_COLORS = {
  Work: "blue",
  Personal: "emerald",
  Study: "violet",
};

export const CLASSIFICATION_COLOR_OPTIONS = [
  { value: "blue", label: "Blue", swatchClass: "swatch-blue", textClass: "text-cat-blue" },
  { value: "indigo", label: "Indigo", swatchClass: "swatch-indigo", textClass: "text-cat-indigo" },
  { value: "emerald", label: "Emerald", swatchClass: "swatch-emerald", textClass: "text-cat-emerald" },
  { value: "teal", label: "Teal", swatchClass: "swatch-teal", textClass: "text-cat-teal" },
  { value: "amber", label: "Amber", swatchClass: "swatch-amber", textClass: "text-cat-amber" },
  { value: "rose", label: "Rose", swatchClass: "swatch-rose", textClass: "text-cat-rose" },
  { value: "violet", label: "Violet", swatchClass: "swatch-violet", textClass: "text-cat-violet" },
  { value: "slate", label: "Slate", swatchClass: "swatch-slate", textClass: "text-cat-slate" },
];

export const VALID_COLORS = new Set(CLASSIFICATION_COLOR_OPTIONS.map((c) => c.value));

export const AI_STARTER_PROMPTS = [
  "How should I prioritize urgent vs. important tasks today?",
  "Give me a 5-step checklist to break down a large project.",
  "What is a realistic time-blocking routine for deep focus?",
];

/**
 * Looks up CSS swatch and text classes for a given classification name.
 */
export function getClassificationColorMeta(classification, colorMap) {
  const matchedKey = Object.keys(colorMap || {}).find(
    (key) => key.toLowerCase() === String(classification).toLowerCase()
  );
  const colorValue = matchedKey ? colorMap[matchedKey] : "blue";
  const found =
    CLASSIFICATION_COLOR_OPTIONS.find((opt) => opt.value === colorValue) ||
    CLASSIFICATION_COLOR_OPTIONS[0];
  return {
    value: found.value,
    swatchClass: found.swatchClass,
    textClass: found.textClass,
  };
}

/**
 * Creates a small inline SVG icon element safely without external dependencies.
 */
export function createSvgIcon(name, className = "icon-xs") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);

  const pathsByIcon = {
    pencil: [
      "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",
      "m15 5 4 4",
    ],
    trash: [
      "M3 6h18",
      "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
      "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
    ],
    restore: [
      "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
      "M3 3v5h5",
    ],
    check: ["M20 6 9 17l-5-5"],
    x: ["M18 6 6 18", "m6 6 12 12"],
    checkSquare: [
      "m9 11 3 3L22 4",
      "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    ],
    checkCircle: [
      "M22 11.08V12a10 10 0 1 1-5.93-9.14",
      "m9 11 3 3L22 4",
    ],
    alert: [
      "M12 8v4",
      "M12 16h.01",
    ],
    info: [
      "M12 16v-4",
      "M12 8h.01",
    ],
  };

  if (name === "alert" || name === "info") {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "10");
    svg.appendChild(circle);
  }

  const paths = pathsByIcon[name] || [];
  for (const d of paths) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }

  return svg;
}
