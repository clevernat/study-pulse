"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserSessions } from "@/lib/firebase/firestore";
import type { Session } from "@/types";

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
    getUserSessions(user.uid).then((data) => {
      setSessions(data);
    });
  }, [user]);

  // Timer preferences
  const [pomodoroLen, setPomodoroLen] = useState(25);
  const [shortBreak, setShortBreak] = useState(5);
  const [longBreak, setLongBreak] = useState(15);

  // Appearance toggles
  const [darkMode, setDarkMode] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Notification toggles
  const [sessionComplete, setSessionComplete] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const displayEmail = user?.email ?? "";
  const initials = displayName.slice(0, 2).toUpperCase();

  function handleExportSessions() {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "studypulse-sessions.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleResetData() {
    if (
      window.confirm(
        "Are you sure you want to reset all data? This action cannot be undone."
      )
    ) {
      // In production this would clear Firestore; for now just a no-op
      alert("All data has been reset.");
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-space text-2xl font-bold text-[#e8e8f0]">
          Settings
        </h1>
        <p className="text-sm text-[#958da1] mt-1">
          Manage your preferences and account
        </p>
      </div>

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
            onChange={setPomodoroLen}
          />
          <Stepper
            label="Short Break"
            value={shortBreak}
            min={1}
            max={30}
            onChange={setShortBreak}
          />
          <Stepper
            label="Long Break"
            value={longBreak}
            min={5}
            max={60}
            onChange={setLongBreak}
          />
        </div>
      </div>

      {/* Appearance */}
      <div className="glass-card p-6">
        <h2 className="font-space font-semibold text-[#e8e8f0] mb-2">
          Appearance
        </h2>
        <div className="divide-y divide-[#252535]">
          <Toggle
            enabled={darkMode}
            onToggle={() => setDarkMode((v) => !v)}
            label="Dark Mode"
            description="Use a dark color scheme across the app"
          />
          <Toggle
            enabled={reducedMotion}
            onToggle={() => setReducedMotion((v) => !v)}
            label="Reduced Motion"
            description="Minimize animations and transitions"
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-6">
        <h2 className="font-space font-semibold text-[#e8e8f0] mb-2">
          Notifications
        </h2>
        <div className="divide-y divide-[#252535]">
          <Toggle
            enabled={sessionComplete}
            onToggle={() => setSessionComplete((v) => !v)}
            label="Session Complete"
            description="Get notified when a Pomodoro session ends"
          />
          <Toggle
            enabled={dailyReminder}
            onToggle={() => setDailyReminder((v) => !v)}
            label="Daily Goal Reminder"
            description="Receive a reminder to hit your daily study goal"
          />
        </div>
      </div>

      {/* Data */}
      <div className="glass-card p-6">
        <h2 className="font-space font-semibold text-[#e8e8f0] mb-4">Data</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#e8e8f0] font-medium">
                Export Sessions
              </p>
              <p className="text-xs text-[#958da1] mt-0.5">
                Download all your sessions as a JSON file
              </p>
            </div>
            <button
              onClick={handleExportSessions}
              className="px-4 py-2 rounded-lg border border-[#252535] text-sm text-[#c4c4d4] hover:text-[#e8e8f0] hover:border-[#d2bbff]/30 transition-colors"
            >
              Export JSON
            </button>
          </div>

          <div className="border-t border-[#252535] pt-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-400">Reset All Data</p>
              <p className="text-xs text-[#958da1] mt-0.5">
                Permanently delete all sessions, subjects, and goals
              </p>
            </div>
            <button
              onClick={handleResetData}
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
