/**
 * Document Picture-in-Picture timer overlay.
 *
 * Opens a small always-on-top floating window (stays above all other apps)
 * that shows the live countdown, mode, subject, and a play/pause button.
 *
 * Supported in Chrome 116+. Falls back to a notification on unsupported browsers.
 */

import { useTimerStore, formatTime } from "@/store/timerStore";

const MODE_COLORS: Record<string, string> = {
  focus:       "#d2bbff",
  "short-break": "#40efb7",
  "long-break":  "#ffb95f",
};

const MODE_LABELS: Record<string, string> = {
  focus:       "FOCUS",
  "short-break": "SHORT BREAK",
  "long-break":  "LONG BREAK",
};

export function isPiPSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

interface DocumentPiP {
  window: Window | null;
  requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
}

function getDPiP(): DocumentPiP | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { documentPictureInPicture?: DocumentPiP }).documentPictureInPicture ?? null;
}

export function isPiPOpen(): boolean {
  return !!getDPiP()?.window;
}

export async function togglePiPTimer(): Promise<void> {
  if (!isPiPSupported()) {
    alert(
      "Picture-in-Picture is not supported in your browser.\n" +
      "Try Chrome 116 or newer for this feature."
    );
    return;
  }

  const dPiP = getDPiP()!;

  // If already open, close it
  if (dPiP.window) {
    dPiP.window.close();
    return;
  }

  const pipWin = await dPiP.requestWindow({ width: 260, height: 210 });

  // ── Base document styles ────────────────────────────────────────────────────
  pipWin.document.documentElement.style.cssText =
    "margin:0;padding:0;height:100%;overflow:hidden;";
  pipWin.document.body.style.cssText = `
    margin: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: #0c0c12;
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
    user-select: none;
    -webkit-font-smoothing: antialiased;
  `;

  // ── DOM nodes ───────────────────────────────────────────────────────────────
  const modeEl   = pipWin.document.createElement("div");
  const timeEl   = pipWin.document.createElement("div");
  const subjEl   = pipWin.document.createElement("div");
  const barWrap  = pipWin.document.createElement("div");
  const barFill  = pipWin.document.createElement("div");
  const btnRow   = pipWin.document.createElement("div");
  const playBtn  = pipWin.document.createElement("button");

  // ── Styles ──────────────────────────────────────────────────────────────────
  Object.assign(modeEl.style, {
    fontSize: "9px",
    letterSpacing: "3px",
    textTransform: "uppercase",
    fontWeight: "800",
    opacity: "0.85",
  } as Partial<CSSStyleDeclaration>);

  Object.assign(timeEl.style, {
    fontSize: "62px",
    fontWeight: "800",
    color: "#e8e8f0",
    letterSpacing: "-3px",
    lineHeight: "1",
    fontVariantNumeric: "tabular-nums",
  } as Partial<CSSStyleDeclaration>);

  Object.assign(subjEl.style, {
    fontSize: "11px",
    color: "#7c3aed",
    maxWidth: "230px",
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minHeight: "14px",
  } as Partial<CSSStyleDeclaration>);

  Object.assign(barWrap.style, {
    width: "180px",
    height: "3px",
    background: "#1e1e2e",
    borderRadius: "99px",
    overflow: "hidden",
    marginTop: "2px",
  } as Partial<CSSStyleDeclaration>);

  Object.assign(barFill.style, {
    height: "100%",
    borderRadius: "99px",
    transition: "width 0.8s linear",
  } as Partial<CSSStyleDeclaration>);

  Object.assign(btnRow.style, {
    display: "flex",
    gap: "10px",
    marginTop: "8px",
  } as Partial<CSSStyleDeclaration>);

  const btnBase: Partial<CSSStyleDeclaration> = {
    cursor: "pointer",
    border: "1px solid transparent",
    borderRadius: "50%",
    width: "38px",
    height: "38px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    transition: "opacity 0.15s",
    outline: "none",
  };

  Object.assign(playBtn.style, {
    ...btnBase,
    background: "rgba(124,58,237,0.25)",
    color: "#d2bbff",
    borderColor: "rgba(124,58,237,0.5)",
  } as Partial<CSSStyleDeclaration>);

  barWrap.appendChild(barFill);
  btnRow.appendChild(playBtn);
  pipWin.document.body.append(modeEl, timeEl, subjEl, barWrap, btnRow);

  // ── Controls ────────────────────────────────────────────────────────────────
  playBtn.addEventListener("click", () => {
    const ts = useTimerStore.getState();
    if (ts.state === "running") ts.pause(); else ts.start();
  });

  // ── Live update loop ────────────────────────────────────────────────────────
  const render = () => {
    const s = useTimerStore.getState();
    const color = MODE_COLORS[s.mode] ?? "#d2bbff";
    const pct   = s.totalSeconds > 0 ? (s.secondsRemaining / s.totalSeconds) * 100 : 100;
    const isPaused = s.state === "paused";

    modeEl.style.color   = color;
    modeEl.textContent   = (MODE_LABELS[s.mode] ?? "FOCUS") + (isPaused ? " · PAUSED" : "");

    timeEl.textContent   = formatTime(s.secondsRemaining);
    timeEl.style.color   = isPaused ? "#4a4a5a" : "#e8e8f0";

    const sub = s.selectedSubjectName !== "Select a Subject" ? s.selectedSubjectName : "";
    subjEl.textContent   = sub;
    subjEl.style.display = sub ? "block" : "none";

    barFill.style.width  = `${pct}%`;
    barFill.style.background = color;

    playBtn.textContent  = s.state === "running" ? "⏸" : "▶";
    const isRunning = s.state === "running";
    playBtn.style.background    = isRunning ? "rgba(124,58,237,0.25)" : "rgba(64,239,183,0.2)";
    playBtn.style.color         = isRunning ? "#d2bbff" : "#40efb7";
    playBtn.style.borderColor   = isRunning ? "rgba(124,58,237,0.5)" : "rgba(64,239,183,0.4)";
  };

  render();
  const interval = setInterval(render, 500);
  pipWin.addEventListener("pagehide", () => clearInterval(interval));
}
