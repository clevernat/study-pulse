"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTimerStore, formatTime } from "@/store/timerStore";
import { getColor } from "@/lib/colorPalette";
import { useAuth } from "@/context/AuthContext";
import { subscribeSubjects, subscribeSessions, subscribeGoals } from "@/lib/firebase/firestore";
import { computeStreak } from "@/lib/streakLogic";
import { localDateStr, daysAgoStr, formatSmartDuration } from "@/lib/dateUtils";
import { useStudyTargets } from "@/lib/firebase/useStudyTargets";
import { togglePiPTimer, isPiPSupported, isPiPOpen } from "@/lib/pipTimer";
import type { Subject, Session, Goal } from "@/types";
import { requestNotificationPermission } from "@/lib/sounds";
import { useCollection } from "@/lib/firebase/useCollection";
import { blockMinutes } from "@/lib/calendar";
import type { StudyBlock, Topic } from "@/types";
import TopicSelect from "@/components/ui/TopicSelect";
import { useNewSubject } from "@/components/ui/NewSubject";
import { targetProgress } from "@/lib/insights";

const BREAK_SUGGESTIONS = [
  { icon: "directions_walk", title: "Take a short walk", desc: "Even 5 minutes outside resets your focus." },
  { icon: "self_improvement", title: "Do some stretches", desc: "Release tension in your neck and shoulders." },
  { icon: "water_drop", title: "Drink some water", desc: "Staying hydrated improves concentration." },
  { icon: "air", title: "Try box breathing", desc: "In 4s → hold 4s → out 4s → hold 4s." },
  { icon: "visibility_off", title: "Rest your eyes", desc: "Look 20 feet away for 20 seconds (20-20-20 rule)." },
  { icon: "restaurant", title: "Have a light snack", desc: "Fuel your brain for the next session." },
  { icon: "phone_disabled", title: "Stay off your phone", desc: "Give your brain a true screen break." },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MODE_LABELS: Record<string, string> = {
  focus: "FOCUS",
  "short-break": "SHORT BREAK",
  "long-break": "LONG BREAK",
};

// ── DurationCol: module-level so React never remounts it between renders ──────
interface DurationColProps {
  label: string;
  color: string;
  presets: number[];
  value: number;
  draft: string;
  setDraft: (v: string) => void;
  onApply: (v: number) => void;
}

function DurationCol({ label, color, presets, value, draft, setDraft, onApply }: DurationColProps) {
  return (
    <div className="p-4 flex flex-col gap-2.5">
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setDraft(String(m)); onApply(m); }}
            className={`px-3 py-1 rounded-full text-[13px] font-jetbrains transition-all ${
              value === m
                ? `${color.replace("text-", "bg-")}/20 ${color} border border-current/40`
                : "border border-outline-variant text-on-surface-variant hover:border-outline"
            }`}
          >
            {m}m
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2">
        <input
          type="number"
          min={1}
          max={180}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const v = parseInt(draft, 10);
            if (!isNaN(v) && v >= 1) onApply(v);
            else setDraft(String(value));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = parseInt(draft, 10);
              if (!isNaN(v) && v >= 1) onApply(v);
            }
          }}
          className="w-full bg-transparent text-on-surface text-sm font-jetbrains focus:outline-none text-center"
        />
        <span className="text-on-surface-variant text-[11px] shrink-0">min</span>
      </div>
    </div>
  );
}

function TimerPageInner() {
  const {
    state,
    mode,
    secondsRemaining,
    totalSeconds,
    pomodoroIndex,
    totalPomodoros,
    selectedSubjectId,
    selectedSubjectName,
    pomodoroLength,
    start,
    pause,
    reset,
    skip,
    setSubject,
    setDurations,
    setTotalPomodoros,
    shortBreak,
    longBreak,
    sessionType,
    setSessionType,
  } = useTimerStore();

  const SESSION_TYPES = ["Deep Work","Reading","Writing","Coding","Research","Review","Planning","Admin","Practice","Job Search"];

  const { user } = useAuth();
  const activeBlockId = useTimerStore((s) => s.activeBlockId);
  const selectedTopicId = useTimerStore((s) => s.selectedTopicId);
  const setTopic = useTimerStore((s) => s.setTopic);
  const distractions = useTimerStore((s) => s.distractions);
  const addDistraction = useTimerStore((s) => s.addDistraction);
  const { items: topics } = useCollection<Topic>("topics");
  const setActiveBlock = useTimerStore((s) => s.setActiveBlock);
  const { items: blocks } = useCollection<StudyBlock>("studyBlocks");
  const searchParams = useSearchParams();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const newSubject = useNewSubject((id, name) => setSubject(id, name));
  const [pipOpen, setPipOpen] = useState(false);
  const [draftFocus, setDraftFocus] = useState(String(pomodoroLength));
  const [draftShort, setDraftShort] = useState(String(shortBreak));
  const [draftLong, setDraftLong] = useState(String(longBreak));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // If arriving from "Study Now", auto-select the subject from URL params
  useEffect(() => {
    const id = searchParams.get("subjectId");
    const name = searchParams.get("subjectName");
    if (id && name) {
      setSubject(id, name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load subjects and sessions for the dropdown and stats.
  // Session saving, cross-device sync, and notifications all live in TimerSync.
  useEffect(() => {
    if (!user) return;
    const unsub1 = subscribeSubjects(user.uid, (data) => {
      setSubjects(data);
      if (data.length === 0) {
        setSubject("", "Select a Subject");
      } else {
        const store = useTimerStore.getState();
        if (store.selectedSubjectId && !data.find((s) => s.id === store.selectedSubjectId)) {
          setSubject("", "Select a Subject");
        }
      }
    });
    const unsub2 = subscribeSessions(user.uid, setSessions);
    const unsub3 = subscribeGoals(user.uid, setGoals);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user, setSubject]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keep PiP button in sync with actual window state
  useEffect(() => {
    const id = setInterval(() => setPipOpen(isPiPOpen()), 800);
    return () => clearInterval(id);
  }, []);


  // Computed stats from real sessions
  const todayStr = localDateStr();
  const todayMinutes = sessions
    .filter((s) => s.date === todayStr)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const todayHours = todayMinutes / 60;

  // Your own target (Settings or Today): the daily one, else a seventh of the weekly one.
  const targets = useStudyTargets();
  const dayTargetMin = targets.daily || (targets.weekly ? Math.round(targets.weekly / 7) : 0);
  const todayProgress = dayTargetMin ? Math.min(todayMinutes / dayTargetMin, 1) : 0;

  // Productivity: compare this week vs last week hours
  // Last 7 days (today included) vs the 7 days before. Compare local date strings.
  const weekStart = daysAgoStr(6);
  const prevWeekStart = daysAgoStr(13);
  const thisWeekMins = sessions
    .filter((s) => s.date >= weekStart)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const lastWeekMins = sessions
    .filter((s) => s.date >= prevWeekStart && s.date < weekStart)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const productivityChange = lastWeekMins === 0
    ? null
    : Math.round(((thisWeekMins - lastWeekMins) / lastWeekMins) * 100);

  const streakDays = computeStreak(
    sessions.map((s) => s.date),
    localDateStr()
  );

  const handleSubjectSelect = (subject: Subject) => {
    setSubject(subject.id, subject.name);
    setIsDropdownOpen(false);
  };

  // SVG ring dimensions
  const R = 175;
  const circumference = 2 * Math.PI * R;
  const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 1;
  const dashOffset = circumference * progress;

  const completedPomodoros = pomodoroIndex % totalPomodoros;
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
  // This subject's own target, if it has one
  const subjectTarget = currentSubject && ((currentSubject.dailyTargetMinutes ?? 0) > 0 || (currentSubject.weeklyTargetMinutes ?? 0) > 0)
    ? targetProgress(sessions.filter((s) => s.subjectId === currentSubject.id), localDateStr(), currentSubject.dailyTargetMinutes, currentSubject.weeklyTargetMinutes)
    : null;
  const hasSubject = !!selectedSubjectId;

  const today = localDateStr();
  const hasActiveGoal = !selectedSubjectId || goals.some(
    (g) => g.subjectId === selectedSubjectId && g.deadline >= today
  );

  // Determine display list: real subjects if loaded, else empty (no mock fallback)
  const displaySubjects = subjects;

  // ── Mode-specific visual theme ────────────────────────────────────────────
  const modeTheme = {
    focus: {
      gradStart:   "#5e6ad2",
      gradEnd:     "#a7b2f7",
      glow:        "rgba(94, 106, 210,0.22)",
      labelColor:  "#a7b2f7",
      dotColor:    "#5e6ad2",
      btnBg:       "rgba(94, 106, 210,0.25)",
      btnBorder:   "rgba(94, 106, 210,0.6)",
      btnShadow:   "0 0 28px rgba(94, 106, 210,0.45)",
      btnText:     "#a7b2f7",
      trackColor:  "#2a2a3d",
      badge:       "FOCUS",
      badgeBg:     "rgba(94, 106, 210,0.15)",
      badgeBorder: "rgba(94, 106, 210,0.35)",
    },
    "short-break": {
      gradStart:   "#3fbe90",
      gradEnd:     "#5ed8a9",
      glow:        "rgba(94, 216, 169,0.2)",
      labelColor:  "#5ed8a9",
      dotColor:    "#5ed8a9",
      btnBg:       "rgba(94, 216, 169,0.18)",
      btnBorder:   "rgba(94, 216, 169,0.55)",
      btnShadow:   "0 0 28px rgba(94, 216, 169,0.35)",
      btnText:     "#5ed8a9",
      trackColor:  "#1a2e28",
      badge:       "SHORT BREAK",
      badgeBg:     "rgba(94, 216, 169,0.12)",
      badgeBorder: "rgba(94, 216, 169,0.3)",
    },
    "long-break": {
      gradStart:   "#f97316",
      gradEnd:     "#ffb95f",
      glow:        "rgba(255,185,95,0.2)",
      labelColor:  "#ffb95f",
      dotColor:    "#ffb95f",
      btnBg:       "rgba(255,185,95,0.18)",
      btnBorder:   "rgba(255,185,95,0.55)",
      btnShadow:   "0 0 28px rgba(255,185,95,0.35)",
      btnText:     "#ffb95f",
      trackColor:  "#2e2510",
      badge:       "LONG BREAK",
      badgeBg:     "rgba(255,185,95,0.12)",
      badgeBorder: "rgba(255,185,95,0.3)",
    },
  } as const;
  const theme = modeTheme[mode] ?? modeTheme.focus;
  const activeBlock = blocks.find((b) => b.id === activeBlockId);

  return (
    <div className="flex flex-col items-center gap-3 max-w-xl mx-auto w-full">

      {/* Planned study block this timer belongs to */}
      {activeBlock && (
        <div data-testid="timer-active-block" className="glass-card w-full px-4 py-3 flex items-center gap-3 border-primary/40">
          <span className="material-symbols-outlined text-primary">edit_calendar</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface truncate">{activeBlock.title}</p>
            <p className="text-[11px] text-on-surface-variant">Planned {activeBlock.start}–{activeBlock.end} · {activeBlock.minutesDone ?? 0} of {blockMinutes(activeBlock)} min done</p>
          </div>
          <button onClick={() => setActiveBlock("")} aria-label="Stop linking to this block" className="text-on-surface-variant hover:text-on-surface p-1">
            <span className="material-symbols-outlined text-[18px]">link_off</span>
          </button>
        </div>
      )}

      {/* Subject Selector */}
      <div className="relative w-full" ref={dropdownRef}>
        <div
          className="glass-card flex items-center justify-between px-5 py-4 cursor-pointer hover:border-primary/40 transition-colors duration-200"
          onClick={() => setIsDropdownOpen((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[22px]">
              {currentSubject?.icon ?? "school"}
            </span>
            <span className="text-on-surface font-medium text-base">{selectedSubjectName}</span>
          </div>
          <span
            className="material-symbols-outlined text-on-surface-variant text-[22px] transition-transform duration-200"
            style={{ transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            expand_more
          </span>
        </div>
        {isDropdownOpen && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 glass-card overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-h-48 overflow-y-auto">
            {displaySubjects.length === 0 && (
              <div className="px-5 pt-4 text-on-surface-variant text-sm text-center">No subjects yet</div>
            )}
            {displaySubjects.map((subject) => (
              <div key={subject.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-surface-container transition-colors" onClick={() => handleSubjectSelect(subject)}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: getColor(subject.color).text }}>{subject.icon}</span>
                <span className="text-on-surface text-[15px] font-medium">{subject.name}</span>
                <span className="ml-auto text-on-surface-variant text-[11px]">{subject.category}</span>
              </div>
            ))}
            <button type="button" data-testid="timer-new-subject" onClick={() => { setIsDropdownOpen(false); newSubject.open(); }}
              className="w-full flex items-center gap-3 px-5 py-3 text-primary text-[15px] font-medium hover:bg-surface-container border-t border-outline-variant">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>New subject
            </button>
          </div>
        )}
      </div>
      {newSubject.form && <div className="w-full">{newSubject.form}</div>}

      {/* Topic of the subject (optional) */}
      {hasSubject && (
        <div className="w-full flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-on-surface-variant">Topic</span>
          <TopicSelect subjectId={selectedSubjectId} topics={topics} value={selectedTopicId} testId="timer-topic"
            onChange={(t) => setTopic(t?.id ?? "", t?.title ?? "")} />
        </div>
      )}

      {/* No active goal banner */}
      {hasSubject && !hasActiveGoal && (
        <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-tertiary/10 border border-tertiary/30">
          <span className="material-symbols-outlined text-tertiary text-[18px] flex-shrink-0">flag</span>
          <p className="text-xs text-tertiary flex-1">
            No active goal for <span className="font-semibold">{currentSubject?.name}</span> — set one to track your progress.
          </p>
          <a href="/goals" className="text-xs font-bold text-tertiary underline underline-offset-2 flex-shrink-0">
            Create goal
          </a>
        </div>
      )}

      {/* Session Type Selector */}
      <div className="w-full flex flex-col gap-2">
        <span className="text-xs font-semibold text-on-surface-variant">Session type</span>
        <div className="flex flex-wrap gap-1.5">
          {SESSION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSessionType(t)}
              className={`px-3 py-1 rounded-full text-[12px] font-inter font-medium border transition-all ${
                sessionType === t
                  ? "bg-primary/20 text-primary border-primary/50"
                  : "border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Ring */}
      <div className="relative w-full max-w-[320px] sm:max-w-[400px]" style={{ aspectRatio: "1" }}>
        <svg className="w-full h-full" viewBox="0 0 380 380" style={{ transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={theme.gradStart} style={{ transition: "stop-color 0.6s ease" }} />
              <stop offset="100%" stopColor={theme.gradEnd} style={{ transition: "stop-color 0.6s ease" }} />
            </linearGradient>
          </defs>
          <circle cx="190" cy="190" r={R} fill="none" stroke={theme.trackColor} strokeWidth="12"
            style={{ transition: "stroke 0.6s ease" }} />
          <circle cx="190" cy="190" r={R} fill="none" stroke="url(#timerGrad)" strokeWidth="12"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="font-jetbrains text-[68px] sm:text-[86px] font-bold tracking-tighter text-on-surface leading-none tabular-nums">
            {formatTime(secondsRemaining)}
          </span>
          {/* Mode badge — color changes per mode */}
          <span
            className="text-[11px] sm:text-[13px] uppercase tracking-[0.22em] font-bold px-3 py-1 rounded-full border"
            style={{ color: theme.labelColor, background: theme.badgeBg, borderColor: theme.badgeBorder, transition: "all 0.5s ease" }}
          >
            {theme.badge}
          </span>
          {/* Pomodoro progress dots */}
          <div className="flex gap-2 mt-1">
            {Array.from({ length: totalPomodoros }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-500"
                style={i < completedPomodoros
                  ? { background: theme.dotColor }
                  : { background: "transparent", border: `1px solid rgba(255,255,255,0.15)` }
                }
              />
            ))}
          </div>
        </div>
        {/* Ambient glow — color matches mode */}
        {state === "running" && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: `0 0 90px ${theme.glow}`, transition: "box-shadow 0.6s ease" }}
          />
        )}
      </div>

      {/* Distraction counter: one tap each time your mind wanders during a focus */}
      {mode === "focus" && state !== "idle" && (
        <button
          data-testid="timer-distracted"
          type="button"
          onClick={addDistraction}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant text-sm text-on-surface-variant hover:border-tertiary/60 hover:text-tertiary active:scale-95 transition-all"
          aria-label={`I got distracted. ${distractions} so far in this focus`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">notifications_paused</span>
          I got distracted
          <span data-testid="timer-distractions" className="font-jetbrains font-bold text-on-surface bg-surface-container px-2 rounded-full">{distractions}</span>
        </button>
      )}

      {/* Controls */}
      <div className="flex items-center gap-5 justify-center">
        <button onClick={() => reset()} className="w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all active:scale-95" aria-label="Reset">
          <span className="material-symbols-outlined text-[20px]">restart_alt</span>
        </button>
        <div className="flex flex-col items-center gap-1.5">
          <button
            data-testid="timer-start"
            onClick={() => { if (state === "running") pause(); else { requestNotificationPermission(); start(); } }}
            disabled={!hasSubject && state !== "running"}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={hasSubject || state === "running" ? {
              background: theme.btnBg,
              border: `2px solid ${theme.btnBorder}`,
              boxShadow: theme.btnShadow,
              color: theme.btnText,
              transition: "all 0.5s ease",
            } : {
              background: "transparent",
              border: "2px dashed rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.3)",
              cursor: "not-allowed",
              opacity: 0.5,
            }}
            aria-label={state === "running" ? "Pause" : "Start"}
          >
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {state === "running" ? "pause" : "play_arrow"}
            </span>
          </button>
          {!hasSubject && state !== "running" && (
            <span className="text-[11px] text-on-surface-variant font-inter text-center">Select a subject to start</span>
          )}
        </div>
        <button onClick={() => skip()} className="w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all active:scale-95" aria-label="Skip">
          <span className="material-symbols-outlined text-[20px]">skip_next</span>
        </button>

        {/* Picture-in-Picture — float the timer above all other apps */}
        {isPiPSupported() && (
          <button
            onClick={() => { togglePiPTimer(); setTimeout(() => setPipOpen(isPiPOpen()), 300); }}
            className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all active:scale-95 ${
              pipOpen
                ? "border-primary/60 text-primary bg-primary/10"
                : "border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
            }`}
            aria-label={pipOpen ? "Close picture-in-picture" : "Open picture-in-picture"}
            title={pipOpen ? "Close floating window" : "Float timer above all windows (Chrome only)"}
          >
            <span className="material-symbols-outlined text-[20px]">picture_in_picture</span>
          </button>
        )}
      </div>

      {/* Smart Break Suggestion — shown during any break mode */}
      {(mode === "short-break" || mode === "long-break") && (() => {
        const s = BREAK_SUGGESTIONS[pomodoroIndex % BREAK_SUGGESTIONS.length];
        const isLong = mode === "long-break";
        return (
          <div className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border ${
            isLong
              ? "bg-tertiary/8 border-tertiary/25"
              : "bg-secondary/8 border-secondary/25"
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isLong ? "bg-tertiary/15" : "bg-secondary/15"
            }`}>
              <span
                className={`material-symbols-outlined text-[22px] ${isLong ? "text-tertiary" : "text-secondary"}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {s.icon}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-xs font-semibold mb-0.5 ${isLong ? "text-tertiary" : "text-secondary"}`}>
                Break suggestion
              </span>
              <span className="text-on-surface font-semibold text-sm">{s.title}</span>
              <span className="text-on-surface-variant text-xs mt-0.5">{s.desc}</span>
            </div>
          </div>
        );
      })()}

      {/* Duration Controls */}
      <div className="w-full bg-card border border-outline-variant rounded-2xl overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-outline-variant">
          <DurationCol label="Focus"       color="text-primary"   presets={[25,45,60]}  value={pomodoroLength} draft={draftFocus} setDraft={setDraftFocus} onApply={(v)=>setDurations(v,shortBreak,longBreak)} />
          <DurationCol label="Short Break" color="text-secondary" presets={[5,10,15]}   value={shortBreak}     draft={draftShort} setDraft={setDraftShort} onApply={(v)=>setDurations(pomodoroLength,v,longBreak)} />
          <DurationCol label="Long Break"  color="text-tertiary"  presets={[15,20,30]}  value={longBreak}      draft={draftLong}  setDraft={setDraftLong}  onApply={(v)=>setDurations(pomodoroLength,shortBreak,v)} />
        </div>
        {/* Rounds before long break */}
        <div className="border-t border-outline-variant px-4 py-3 flex items-center gap-3">
          <span className="text-xs font-semibold text-on-surface-variant flex-1">
            Rounds before long break
          </span>
          <div className="flex gap-1.5">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTotalPomodoros(n)}
                className={`w-8 h-8 rounded-full text-[13px] font-jetbrains font-bold transition-all ${
                  totalPomodoros === n
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "border border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The selected subject's target */}
      {currentSubject && subjectTarget && (
        <div data-testid="timer-subject-target" className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 flex flex-col gap-2">
          <span className="text-[11px] text-on-surface-variant font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: getColor(currentSubject.color).dot }} />{currentSubject.name} target
          </span>
          {[subjectTarget.daily && { label: "Today", done: subjectTarget.todayMinutes, t: subjectTarget.daily },
            subjectTarget.weekly && { label: "This week", done: subjectTarget.weekMinutes, t: subjectTarget.weekly }].filter(Boolean).map((row) => row && (
            <div key={row.label} className="flex items-center gap-3 text-xs">
              <span className="w-20 text-on-surface-variant">{row.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-container overflow-hidden"><div className="h-full rounded-full bg-secondary" style={{ width: `${row.t.pct}%` }} /></div>
              <span className="text-on-surface font-jetbrains whitespace-nowrap">{formatSmartDuration(row.done)} / {formatSmartDuration(row.t.target)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Session Stats */}
      <div className="grid grid-cols-3 gap-2 w-full sm:gap-3">

        {/* Today's Focus */}
        <div className="bg-surface-container-low border border-outline-variant p-2.5 sm:p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant font-semibold leading-tight">Today&apos;s focus</span>
            <span className="material-symbols-outlined text-secondary text-[18px]">timer</span>
          </div>
          <div>
            {todayMinutes === 0 ? (
              <span className="text-xl sm:text-3xl font-bold text-secondary font-jetbrains leading-none">--</span>
            ) : todayMinutes < 60 ? (
              <>
                <span className="text-xl sm:text-3xl font-bold text-secondary font-jetbrains leading-none">{todayMinutes}</span>
                <span className="text-on-surface-variant text-xs sm:text-sm ml-1">min</span>
              </>
            ) : (
              <>
                <span className="text-xl sm:text-3xl font-bold text-secondary font-jetbrains leading-none">{todayHours.toFixed(1)}</span>
                <span className="text-on-surface-variant text-xs sm:text-sm ml-1">hrs</span>
              </>
            )}
          </div>
          {dayTargetMin ? (
            <>
              <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${todayProgress * 100}%`, background: "linear-gradient(to right,#5ed8a9,#3fbe90)" }} />
              </div>
              <p data-testid="timer-target" className="text-[11px] text-on-surface-variant">of {formatSmartDuration(dayTargetMin)} target</p>
            </>
          ) : (
            <a href="/today" className="text-[11px] text-on-surface-variant underline underline-offset-2">Set a target</a>
          )}
        </div>

        {/* Productivity */}
        <div className="bg-surface-container-low border border-outline-variant p-2.5 sm:p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant font-semibold leading-tight">Productivity</span>
            <span className="material-symbols-outlined text-secondary text-[18px]">
              {(productivityChange ?? 0) >= 0 ? "trending_up" : "trending_down"}
            </span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-xl sm:text-3xl font-bold text-secondary font-jetbrains leading-none">
              {productivityChange === null ? "--" : `${productivityChange >= 0 ? "+" : ""}${productivityChange}`}
            </span>
            {productivityChange !== null && <span className="text-on-surface-variant text-xs sm:text-sm mb-0.5">%</span>}
          </div>
          <p className="text-xs text-on-surface-variant">{productivityChange === null ? "No data yet" : "vs last week"}</p>
        </div>

        {/* Current Streak */}
        <div className="bg-surface-container-low border border-outline-variant p-2.5 sm:p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant font-semibold leading-tight">Streak</span>
            <span className="material-symbols-outlined text-tertiary text-[18px]">local_fire_department</span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-xl sm:text-3xl font-bold text-tertiary font-jetbrains leading-none">
              {streakDays === 0 ? "--" : streakDays}
            </span>
            {streakDays > 0 && <span className="text-on-surface-variant text-xs sm:text-sm mb-0.5">{streakDays === 1 ? "day" : "days"}</span>}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {streakDays === 0
              ? <span className="text-xs text-on-surface-variant">No streak yet</span>
              : Array.from({ length: Math.min(streakDays, 7) }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full" style={{ background: "#ffb95f" }} />
                ))
            }
          </div>
        </div>

      </div>
    </div>
  );
}

export default function TimerPage() {
  return (
    <Suspense>
      <TimerPageInner />
    </Suspense>
  );
}
