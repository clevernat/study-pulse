export interface PaletteColor {
  label: string;
  dot: string;    // hex for color swatch
  text: string;   // hex for text / icon
  bg: string;     // rgba for icon background
  bar: string;    // hex for progress bar
  chip: string;   // rgba for category chip background
  chipText: string; // hex for chip text
}

export const COLOR_PALETTE: Record<string, PaletteColor> = {
  violet:  { label: "Violet",  dot: "#7c3aed", text: "#d2bbff", bg: "rgba(124,58,237,0.15)",  bar: "#7c3aed", chip: "rgba(124,58,237,0.2)",  chipText: "#d2bbff" },
  emerald: { label: "Emerald", dot: "#40efb7", text: "#40efb7", bg: "rgba(64,239,183,0.15)",  bar: "#40efb7", chip: "rgba(64,239,183,0.15)",  chipText: "#40efb7" },
  amber:   { label: "Amber",   dot: "#ffb95f", text: "#ffb95f", bg: "rgba(255,185,95,0.15)",  bar: "#ffb95f", chip: "rgba(255,185,95,0.15)",  chipText: "#ffb95f" },
  rose:    { label: "Rose",    dot: "#f43f5e", text: "#fb7185", bg: "rgba(244,63,94,0.15)",   bar: "#f43f5e", chip: "rgba(244,63,94,0.15)",   chipText: "#fb7185" },
  blue:    { label: "Blue",    dot: "#3b82f6", text: "#60a5fa", bg: "rgba(59,130,246,0.15)",  bar: "#3b82f6", chip: "rgba(59,130,246,0.15)",  chipText: "#60a5fa" },
  cyan:    { label: "Cyan",    dot: "#06b6d4", text: "#22d3ee", bg: "rgba(6,182,212,0.15)",   bar: "#06b6d4", chip: "rgba(6,182,212,0.15)",   chipText: "#22d3ee" },
  orange:  { label: "Orange",  dot: "#f97316", text: "#fb923c", bg: "rgba(249,115,22,0.15)",  bar: "#f97316", chip: "rgba(249,115,22,0.15)",  chipText: "#fb923c" },
  pink:    { label: "Pink",    dot: "#ec4899", text: "#f472b6", bg: "rgba(236,72,153,0.15)",  bar: "#ec4899", chip: "rgba(236,72,153,0.15)",  chipText: "#f472b6" },
  lime:    { label: "Lime",    dot: "#84cc16", text: "#a3e635", bg: "rgba(132,204,22,0.15)",  bar: "#84cc16", chip: "rgba(132,204,22,0.15)",  chipText: "#a3e635" },
  indigo:  { label: "Indigo",  dot: "#6366f1", text: "#818cf8", bg: "rgba(99,102,241,0.15)",  bar: "#6366f1", chip: "rgba(99,102,241,0.15)",  chipText: "#818cf8" },
  teal:    { label: "Teal",    dot: "#14b8a6", text: "#2dd4bf", bg: "rgba(20,184,166,0.15)",  bar: "#14b8a6", chip: "rgba(20,184,166,0.15)",  chipText: "#2dd4bf" },
  red:     { label: "Red",     dot: "#ef4444", text: "#f87171", bg: "rgba(239,68,68,0.15)",   bar: "#ef4444", chip: "rgba(239,68,68,0.15)",   chipText: "#f87171" },
  sky:     { label: "Sky",     dot: "#0ea5e9", text: "#38bdf8", bg: "rgba(14,165,233,0.15)",  bar: "#0ea5e9", chip: "rgba(14,165,233,0.15)",  chipText: "#38bdf8" },
  purple:  { label: "Purple",  dot: "#a855f7", text: "#c084fc", bg: "rgba(168,85,247,0.15)",  bar: "#a855f7", chip: "rgba(168,85,247,0.15)",  chipText: "#c084fc" },
  gold:    { label: "Gold",    dot: "#eab308", text: "#facc15", bg: "rgba(234,179,8,0.15)",   bar: "#eab308", chip: "rgba(234,179,8,0.15)",   chipText: "#facc15" },
};

// Backward compat: map old token names to palette keys
const LEGACY: Record<string, string> = {
  primary:   "violet",
  secondary: "emerald",
  tertiary:  "amber",
};

export function getColor(key: string): PaletteColor {
  const resolved = LEGACY[key] ?? key;
  return COLOR_PALETTE[resolved] ?? COLOR_PALETTE.violet;
}
