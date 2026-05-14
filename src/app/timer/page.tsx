"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTimerStore, formatTime } from "@/store/timerStore";
import { useAuth } from "@/context/AuthContext";
import { getUserSubjects, getUserSessions, addSession } from "@/lib/firebase/firestore";
import { computeStreak } from "@/lib/streakLogic";
import type { Subject, Session } from "@/types";

const MODE_LABELS: Record<string, string> = {
  focus: "FOCUS",
  "short-break": "SHORT BREAK",
  "long-break": "LONG BREAK",
};

export default function TimerPage() {
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
    setPreset,
  } = useTimerStore();

  const { user } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track previous timer state to detect transitions
  const prevStateRef = useRef<string>("idle");
  // Track start time when timer begins
  const startTimeRef = useRef<string | null>(null);
  // Track the totalSeconds at start of focus session (for duration calc)
  const sessionTotalSecondsRef = useRef<number>(totalSeconds);

  // Load subjects and sessions from Firestore
  useEffect(() => {
    if (!user) return;
    getUserSubjects(user.uid).then((data) => {
      if (data.length > 0) setSubjects(data);
    });
    getUserSessions(user.uid).then(setSessions);
  }, [user]);

  // Only set preset on first mount if the timer is completely idle (not running/paused)
  useEffect(() => {
    if (state === "idle") {
      setPreset(pomodoroLength);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Capture start time when timer transitions to running
  useEffect(() => {
    if (state === "running" && prevStateRef.current !== "running") {
      startTimeRef.current = new Date().toTimeString().slice(0, 5);
      sessionTotalSecondsRef.current = totalSeconds;
    }
    prevStateRef.current = state;
  }, [state, totalSeconds]);

  // Save session when a focus pomodoro completes (state goes from running to break)
  const saveSession = useCallback(async () => {
    if (!user) return;
    const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const durationMinutes = Math.round(sessionTotalSecondsRef.current / 60);
    const session: Omit<Session, "id"> = {
      uid: user.uid,
      subjectId: currentSubject?.id ?? "unknown",
      subjectName: currentSubject?.name ?? selectedSubjectName,
      subjectColor: (currentSubject?.color ?? "primary") as Session["subjectColor"],
      durationMinutes,
      focusScore: 85,
      pomodoroCount: 1,
      date: today,
      startTime: startTimeRef.current ?? now.toTimeString().slice(0, 5),
      endTime: now.toTimeString().slice(0, 5),
      notes: "",
    };
    try {
      await addSession(user.uid, session);
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  }, [user, subjects, selectedSubjectId, selectedSubjectName]);

  // Detect focus session completion: was running in focus mode, now in break state
  useEffect(() => {
    if (
      state === "break" &&
      prevStateRef.current === "running" &&
      mode !== "focus" // mode has already transitioned to a break mode
    ) {
      // Only save if we were in a focus session (not a break session completing)
      // The timer transitions: focus running -> break state with break mode
      // prevStateRef is updated inside the running effect, so at this point
      // prevStateRef.current may already be "break". We use a separate ref below.
    }
  }, [state, mode]);

  // Use a dedicated ref to track mode at time of transition for session save
  const prevModeRef = useRef<string>("focus");
  useEffect(() => {
    // When state becomes "break" and previous mode was "focus" => focus session just completed
    if (state === "break" && prevModeRef.current === "focus") {
      saveSession();
    }
    prevModeRef.current = mode;
  }, [state, mode, saveSession]);

  const handleCustomApply = () => {
    const mins = parseInt(customMinutes, 10);
    if (!isNaN(mins) && mins >= 1 && mins <= 180) {
      setPreset(mins);
      setShowCustomInput(false);
      setCustomMinutes("");
    }
  };

  // Computed stats from real sessions
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMinutes = sessions
    .filter((s) => s.date === todayStr)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const todayHours = todayMinutes / 60;

  const todayGoalHours = 8;
  const todayProgress = Math.min(todayHours / todayGoalHours, 1);

  // Productivity: compare this week vs last week hours
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const thisWeekMins = sessions
    .filter((s) => new Date(s.date) >= weekAgo)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const lastWeekMins = sessions
    .filter((s) => new Date(s.date) >= twoWeeksAgo && new Date(s.date) < weekAgo)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const productivityChange = lastWeekMins === 0
    ? (thisWeekMins > 0 ? 100 : 0)
    : Math.round(((thisWeekMins - lastWeekMins) / lastWeekMins) * 100);

  const streakDays = computeStreak(
    sessions.map((s) => s.date),
    todayStr
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

  // Determine display list: real subjects if loaded, else empty (no mock fallback)
  const displaySubjects = subjects;

  return (
    <section className="flex flex-col items-center gap-8 py-4">

      {/* Subject Selector */}
      <div className="relative w-full max-w-md" ref={dropdownRef}>
        <div
          className="glass-card flex items-center justify-between px-5 py-3.5 cursor-pointer hover:border-primary/40 transition-colors duration-200"
          onClick={() => setIsDropdownOpen((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-primary text-[20px]"
              style={{ fontFamily: "'Material Symbols Outlined'" }}
            >
              {currentSubject?.icon ?? "school"}
            </span>
            <span className="text-on-surface font-medium text-[15px]">
              {selectedSubjectName}
            </span>
          </div>
          <span
            className="material-symbols-outlined text-on-surface-variant text-[20px] transition-transform duration-200"
            style={{
              fontFamily: "'Material Symbols Outlined'",
              transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            expand_more
          </span>
        </div>

        {isDropdownOpen && (
          <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 glass-card overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            {displaySubjects.length === 0 ? (
              <div className="px-5 py-4 text-on-surface-variant text-sm text-center">
                No subjects yet — add one in Subjects
              </div>
            ) : (
              displaySubjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-surface-container transition-colors duration-150"
                  onClick={() => handleSubjectSelect(subject)}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      subject.color === "primary"
                        ? "text-primary"
                        : subject.color === "secondary"
                        ? "text-secondary"
                        : "text-tertiary"
                    }`}
                    style={{ fontFamily: "'Material Symbols Outlined'" }}
                  >
                    {subject.icon}
                  </span>
                  <span className="text-on-surface text-[14px] font-medium">{subject.name}</span>
                  <span className="ml-auto text-on-surface-variant text-[11px] uppercase tracking-widest">
                    {subject.category}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* SVG Ring Timer */}
      <div className="relative w-[380px] h-[380px]">
        <svg
          className="w-full h-full timer-ring"
          viewBox="0 0 380 380"
          style={{ transform: "rotate(-90deg)" }}
        >
          <defs>
            <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#d2bbff" />
            </linearGradient>
          </defs>
          {/* Track — visible dark ring */}
          <circle
            cx="190"
            cy="190"
            r={R}
            fill="none"
            stroke="#2a2a3d"
            strokeWidth="10"
          />
          {/* Progress */}
          <circle
            cx="190"
            cy="190"
            r={R}
            fill="none"
            stroke="url(#timerGrad)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="font-jetbrains text-[72px] font-bold tracking-tighter text-on-surface leading-none tabular-nums">
            {formatTime(secondsRemaining)}
          </span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant font-medium">
            {MODE_LABELS[mode] ?? "FOCUS"}
          </span>
          {/* Pomodoro dots */}
          <div className="flex gap-2 mt-1">
            {Array.from({ length: totalPomodoros }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i < completedPomodoros
                    ? "bg-primary shadow-[0_0_6px_rgba(210,187,255,0.8)]"
                    : "border border-outline-variant bg-transparent"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Glow when running */}
        {state === "running" && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "0 0 60px rgba(124,58,237,0.12)" }}
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 justify-center mt-8">
        {/* Reset */}
        <button
          onClick={reset}
          className="w-14 h-14 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all active:scale-95"
          aria-label="Reset timer"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontFamily: "'Material Symbols Outlined'" }}
          >
            restart_alt
          </span>
        </button>

        {/* Play / Pause */}
        <button
          onClick={state === "running" ? pause : start}
          className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-[0_0_32px_rgba(124,58,237,0.4)] hover:scale-105 active:scale-95 transition-all"
          aria-label={state === "running" ? "Pause timer" : "Start timer"}
        >
          <span
            className="material-symbols-outlined text-4xl"
            style={{
              fontFamily: "'Material Symbols Outlined'",
              fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48",
            }}
          >
            {state === "running" ? "pause" : "play_arrow"}
          </span>
        </button>

        {/* Skip */}
        <button
          onClick={skip}
          className="w-14 h-14 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all active:scale-95"
          aria-label="Skip to next session"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontFamily: "'Material Symbols Outlined'" }}
          >
            skip_next
          </span>
        </button>
      </div>

      {/* Preset Pills */}
      <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-full p-1 mt-8">
        {[25, 45, 60].map((m) => (
          <button
            key={m}
            onClick={() => setPreset(m)}
            className={`px-5 py-2 rounded-full text-sm font-jetbrains transition-all ${
              pomodoroLength === m
                ? "bg-primary-container/20 text-primary border border-primary/30"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {m}m
          </button>
        ))}
        <div className="w-px h-4 bg-outline-variant mx-1" />
        <button
          onClick={() => setShowCustomInput((v) => !v)}
          className={`px-4 py-2 rounded-full text-sm transition-all ${
            showCustomInput
              ? "bg-primary-container/20 text-primary border border-primary/30"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom duration input */}
      {showCustomInput && (
        <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3">
          <span className="text-on-surface-variant text-sm">Minutes:</span>
          <input
            type="number"
            min={1}
            max={180}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustomApply()}
            placeholder="e.g. 90"
            className="w-20 bg-transparent border-b border-outline-variant text-on-surface text-sm font-jetbrains focus:outline-none focus:border-primary text-center"
            autoFocus
          />
          <button
            onClick={handleCustomApply}
            className="px-3 py-1 rounded-lg bg-primary-container text-on-primary-container text-sm font-medium hover:opacity-90 active:scale-95 transition-all"
          >
            Set
          </button>
        </div>
      )}

      {/* Session Stats */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mt-4">
        {/* Today's Focus */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl h-32 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-on-surface-variant font-medium">
              Today&apos;s Focus
            </span>
            <span
              className="material-symbols-outlined text-secondary text-[16px]"
              style={{ fontFamily: "'Material Symbols Outlined'" }}
            >
              timer
            </span>
          </div>
          <div>
            <span className="text-[28px] font-bold text-secondary font-jetbrains leading-none">
              {todayHours.toFixed(1)}
            </span>
            <span className="text-on-surface-variant text-[13px] ml-1">hrs</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${todayProgress * 100}%`, background: "linear-gradient(to right, #40efb7, #00d29c)" }}
            />
          </div>
        </div>

        {/* Productivity */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl h-32 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-on-surface-variant font-medium">
              Productivity
            </span>
            <span
              className="material-symbols-outlined text-secondary text-[16px]"
              style={{ fontFamily: "'Material Symbols Outlined'" }}
            >
              {productivityChange >= 0 ? "trending_up" : "trending_down"}
            </span>
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-[28px] font-bold text-secondary font-jetbrains leading-none">
              {productivityChange >= 0 ? "+" : ""}{productivityChange}
            </span>
            <span className="text-on-surface-variant text-[13px] mb-0.5">%</span>
          </div>
          <p className="text-[10px] text-on-surface-variant">vs last week</p>
        </div>

        {/* Current Streak */}
        <div className="bg-surface-container-low border border-outline-variant p-4 rounded-xl h-32 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-on-surface-variant font-medium">
              Current Streak
            </span>
            <span
              className="material-symbols-outlined text-tertiary text-[16px]"
              style={{ fontFamily: "'Material Symbols Outlined'" }}
            >
              local_fire_department
            </span>
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-[28px] font-bold text-tertiary font-jetbrains leading-none">{streakDays}</span>
            <span className="text-on-surface-variant text-[13px] mb-0.5">days</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {streakDays === 0 ? (
              <span className="text-[10px] text-on-surface-variant">Start studying to build a streak!</span>
            ) : (
              Array.from({ length: Math.min(streakDays, 14) }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#ffb95f" }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
