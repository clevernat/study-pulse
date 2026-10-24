"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeSessions, deleteAllUserData, saveUserPreferences, subscribeUserPreferences, hasTimerPrefs } from "@/lib/firebase/firestore";
import { useTimerStore } from "@/store/timerStore";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InstallCard from "@/components/settings/InstallCard";
import RemindersCard from "@/components/settings/RemindersCard";
import CalendarFeedCard from "@/components/settings/CalendarFeedCard";
import type { Session } from "@/types";
import { localDateStr } from "@/lib/dateUtils";
import { toCsv, downloadText as download } from "@/lib/csv";

interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
}

function Toggle({ enabled, onToggle, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-[#e8e8f0] font-medium">{label}</p>
        {description && (
          <p className="text-xs text-[#958da1] mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
          enabled ? "bg-secondary" : "bg-[#252535]"
        }`}
        aria-pressed={enabled}
        aria-label={label}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-[#0e0e11] transition-transform duration-200 ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  unit?: string;
}

function Stepper({ label, value, min, max, onChange, unit = "min" }: StepperProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <p className="text-sm text-[#e8e8f0] font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-lg border border-[#252535] text-[#958da1] hover:text-[#e8e8f0] hover:border-[#d2bbff]/40 transition-colors flex items-center justify-center text-lg leading-none"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <div className="bg-[#0e0e11] border border-outline-variant rounded-lg p-2 text-center font-jetbrains w-16 text-[#e8e8f0] text-sm">
          {value}
          <span className="text-[#958da1] text-xs ml-0.5">{unit}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-lg border border-[#252535] text-[#958da1] hover:text-[#e8e8f0] hover:border-[#d2bbff]/40 transition-colors flex items-center justify-center text-lg leading-none"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSessions(user.uid, setSessions);
    return () => unsub();
  }, [user]);

  // Timer preferences — read initial values from Zustand store (localStorage-persisted)
  const timerStore = useTimerStore();
  const [pomodoroLen, setPomodoroLen] = useState(timerStore.pomodoroLength);
  const [shortBreak, setShortBreak] = useState(timerStore.shortBreak);
  const [longBreak, setLongBreak] = useState(timerStore.longBreak);

  // Subscribe to Firestore preferences so other-device changes show here immediately
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserPreferences(user.uid, (prefs) => {
      if (!hasTimerPrefs(prefs)) return;
      setPomodoroLen(prefs.pomodoroLength);
      setShortBreak(prefs.shortBreak);
      setLongBreak(prefs.longBreak);
    });
    return () => unsub();
  }, [user]);

  // Appearance — load from localStorage after mount to avoid SSR mismatch
  const [reducedMotion, setReducedMotion] = useState(false);

  // Notification toggles
  const [sessionComplete, setSessionComplete] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);

  // Hydrate prefs from localStorage on the client
  useEffect(() => {
    setReducedMotion(localStorage.getItem("sp-reduced-motion") === "true");
    setSessionComplete(localStorage.getItem("sp-notif-session") !== "false");
    setDailyReminder(localStorage.getItem("sp-notif-daily") !== "false");
  }, []);

  function handleReducedMotion(val: boolean) {
    setReducedMotion(val);
    localStorage.setItem("sp-reduced-motion", String(val));
    document.documentElement.classList.toggle("reduced-motion", val);
  }

  function handleSessionComplete(val: boolean) {
    setSessionComplete(val);
    localStorage.setItem("sp-notif-session", String(val));
  }

  function handleDailyReminder(val: boolean) {
    setDailyReminder(val);
    localStorage.setItem("sp-notif-daily", String(val));
    // Request notification permission when enabling
    if (val && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function applyPreference(focus: number, sb: number, lb: number) {
    setPomodoroLen(focus);
    setShortBreak(sb);
    setLongBreak(lb);
    useTimerStore.getState().setDurations(focus, sb, lb);
    if (user) {
      await saveUserPreferences(user.uid, { pomodoroLength: focus, shortBreak: sb, longBreak: lb });
    }
  }

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const displayEmail = user?.email ?? "";
  const initials = displayName.slice(0, 2).toUpperCase();

  // ── Export helpers ────────────────────────────────────────────────────────
  type ExportRange = "all" | "this-month" | "last-month" | "custom";
  const [exportRange, setExportRange] = useState<ExportRange>("all");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  function getFilteredSessions(): typeof sessions {
    const now = new Date();
    if (exportRange === "all") return sessions;
    if (exportRange === "this-month") {
      const ym = localDateStr(now).slice(0, 7);
      return sessions.filter((s) => s.date.startsWith(ym));
    }
    if (exportRange === "last-month") {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ym = localDateStr(d).slice(0, 7);
      return sessions.filter((s) => s.date.startsWith(ym));
    }
    if (exportRange === "custom") {
      return sessions.filter((s) => (!exportFrom || s.date >= exportFrom) && (!exportTo || s.date <= exportTo));
    }
    return sessions;
  }

  function handleExportCSV() {
    const data = getFilteredSessions();
    const header = ["Date", "Subject", "Session Type", "Duration (min)", "Focus Score", "Start", "End", "Notes"];
    const rows = data.map((s) => [s.date, s.subjectName, s.sessionType ?? "Deep Work", s.durationMinutes, s.focusScore, s.startTime, s.endTime, s.notes ?? ""]);
    download(toCsv([header, ...rows]), "studypulse-sessions.csv", "text/csv");
  }

  function handleExportExcel() {
    const data = getFilteredSessions();
    const header = ["Date","Subject","Session Type","Duration (min)","Focus Score","Start","End","Notes"];
    const rows = data.map((s) => [s.date, s.subjectName, s.sessionType ?? "Deep Work", s.durationMinutes, s.focusScore, s.startTime, s.endTime, s.notes ?? ""]);
    const tableHtml = `<table><tr>${header.map(h => `<th>${h}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
    download("﻿" + tableHtml, "studypulse-sessions.xls", "application/vnd.ms-excel");
  }

  function handleExportJSON() {
    const data = getFilteredSessions();
    download(JSON.stringify(data, null, 2), "studypulse-sessions.json", "application/json");
  }

  async function handleResetConfirmed() {
    if (!user) return;
    setResetting(true);
    try {
      await deleteAllUserData(user.uid);
      // Stop the timer, clear subject selection, and reset to idle/focus
      const ts = useTimerStore.getState();
      ts.setPreset(ts.pomodoroLength); // calls clearTick() + resets to idle
      ts.setSubject("", "Select a Subject");
      setResetDone(true);
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <ConfirmModal
        open={confirmReset}
        title="Reset All Data"
        description="This will permanently delete all your sessions, subjects, and goals. This action cannot be undone."
        confirmLabel={resetting ? "Deleting…" : "Yes, Delete Everything"}
        cancelLabel="Keep My Data"
        destructive
        icon="delete_forever"
        onConfirm={handleResetConfirmed}
        onCancel={() => setConfirmReset(false)}
      />

      <ConfirmModal
        open={resetDone}
        title="Data Cleared"
        description="All your sessions, subjects, and goals have been deleted successfully."
        confirmLabel="OK"
        cancelLabel=""
        icon="check_circle"
        onConfirm={() => setResetDone(false)}
        onCancel={() => setResetDone(false)}
      />
      {/* Subtitle */}
      <p className="text-sm text-[#958da1]">
        Manage your preferences and account
      </p>

      {/* Profile */}
      <div className="glass-card p-6">
        <h2 className="font-space font-semibold text-[#e8e8f0] mb-4">
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#7c3aed]/30 border border-[#d2bbff]/20 flex items-center justify-center flex-shrink-0">
            <span className="font-jetbrains font-bold text-[#d2bbff] text-lg">
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-space font-semibold text-[#e8e8f0]">
              {displayName}
            </p>
            <p className="text-sm text-[#958da1] truncate">{displayEmail}</p>
          </div>
          <button className="px-4 py-2 rounded-lg border border-[#252535] text-sm text-[#c4c4d4] hover:text-[#e8e8f0] hover:border-[#d2bbff]/30 transition-colors">
            Edit Profile
          </button>
        </div>
      </div>

      {/* Timer Preferences */}
      <div className="glass-card p-6">
        <h2 className="font-space font-semibold text-[#e8e8f0] mb-2">
          Timer Preferences
        </h2>
        <p className="text-xs text-[#958da1] mb-4">
          Customize your Pomodoro session lengths
        </p>
        <div className="divide-y divide-[#252535]">
          <Stepper
            label="Pomodoro Length"
            value={pomodoroLen}
            min={5}
            max={60}
            onChange={(v) => applyPreference(v, shortBreak, longBreak)}
          />
          <Stepper
            label="Short Break"
            value={shortBreak}
            min={1}
            max={30}
            onChange={(v) => applyPreference(pomodoroLen, v, longBreak)}
          />
          <Stepper
            label="Long Break"
            value={longBreak}
            min={5}
            max={60}
            onChange={(v) => applyPreference(pomodoroLen, shortBreak, v)}
          />
        </div>
      </div>

      <InstallCard />
      <RemindersCard />
      <CalendarFeedCard />

      {/* Appearance */}
      <div className="glass-card p-6">
        <h2 className="font-space font-semibold text-[#e8e8f0] mb-2">Appearance</h2>
        <div className="divide-y divide-[#252535]">
          {/* Dark Mode — locked until light theme is built */}
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-[#e8e8f0] font-medium">Dark Mode</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-bold uppercase tracking-wide">
                  Always On
                </span>
              </div>
              <p className="text-xs text-[#958da1] mt-0.5">Light mode coming soon</p>
            </div>
            <button
              disabled
              className="relative w-11 h-6 rounded-full bg-secondary cursor-not-allowed opacity-60"
              aria-label="Dark mode (always on)"
            >
              <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#0e0e11] translate-x-5" />
            </button>
          </div>

          <Toggle
            enabled={reducedMotion}
            onToggle={() => handleReducedMotion(!reducedMotion)}
            label="Reduced Motion"
            description="Minimize animations and transitions across the app"
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-6">
        <h2 className="font-space font-semibold text-[#e8e8f0] mb-2">Notifications</h2>
        <div className="divide-y divide-[#252535]">
          <Toggle
            enabled={sessionComplete}
            onToggle={() => handleSessionComplete(!sessionComplete)}
            label="Session Complete"
            description="Get notified when a Pomodoro session ends"
          />
          <Toggle
            enabled={dailyReminder}
            onToggle={() => handleDailyReminder(!dailyReminder)}
            label="Daily Goal Reminder"
            description="Sends a reminder at 9 PM if you haven't studied today"
          />
        </div>
      </div>

      {/* Data */}
      <div className="glass-card p-6">
        <h2 className="font-space font-semibold text-[#e8e8f0] mb-4">Data</h2>
        <div className="space-y-4">

          {/* Export */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm text-[#e8e8f0] font-medium">Export Sessions</p>
              <p className="text-xs text-[#958da1] mt-0.5">
                {getFilteredSessions().length} session{getFilteredSessions().length !== 1 ? "s" : ""} will be exported
              </p>
            </div>

            {/* Date range */}
            <div className="flex flex-wrap gap-2">
              {(["all","this-month","last-month","custom"] as ExportRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setExportRange(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    exportRange === r
                      ? "bg-primary/20 text-[#d2bbff] border-primary/50"
                      : "border-[#252535] text-[#958da1] hover:border-[#d2bbff]/30 hover:text-[#c4c4d4]"
                  }`}
                >
                  {r === "all" ? "All Time" : r === "this-month" ? "This Month" : r === "last-month" ? "Last Month" : "Custom"}
                </button>
              ))}
            </div>

            {exportRange === "custom" && (
              <div className="flex items-center gap-2">
                <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)}
                  className="flex-1 bg-[#0e0e11] border border-[#252535] rounded-lg px-3 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#d2bbff]/40"
                  style={{ colorScheme: "dark" }} />
                <span className="text-[#958da1] text-xs">→</span>
                <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)}
                  className="flex-1 bg-[#0e0e11] border border-[#252535] rounded-lg px-3 py-1.5 text-xs text-[#e8e8f0] focus:outline-none focus:border-[#d2bbff]/40"
                  style={{ colorScheme: "dark" }} />
              </div>
            )}

            {/* Download buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#252535] text-sm text-[#c4c4d4] hover:text-[#e8e8f0] hover:border-[#d2bbff]/30 transition-colors">
                <span className="material-symbols-outlined text-[16px]">download</span> CSV
              </button>
              <button onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#252535] text-sm text-[#c4c4d4] hover:text-[#e8e8f0] hover:border-[#d2bbff]/30 transition-colors">
                <span className="material-symbols-outlined text-[16px]">table_view</span> Excel
              </button>
              <button onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#252535] text-sm text-[#c4c4d4] hover:text-[#e8e8f0] hover:border-[#d2bbff]/30 transition-colors">
                <span className="material-symbols-outlined text-[16px]">data_object</span> JSON
              </button>
            </div>
          </div>

          <div className="border-t border-[#252535] pt-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-400">Reset All Data</p>
              <p className="text-xs text-[#958da1] mt-0.5">
                Permanently delete all sessions, subjects, and goals
              </p>
            </div>
            <button
              onClick={() => setConfirmReset(true)}
              className="px-4 py-2 rounded-lg border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Reset Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
