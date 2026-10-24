export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  memberSince: string;
  streak: number;
  longestStreak: number;
  totalHours: number;
  preferences: UserPreferences;
}

export interface UserPreferences {
  pomodoroLength: number;
  shortBreak: number;
  longBreak: number;
  theme: "dark" | "light";
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  dailyGoalHours: number;
}

export interface Subject {
  id: string;
  uid: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  totalMinutes: number;
  sessionCount: number;
  createdAt: string;
}

export interface Session {
  id: string;
  uid: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  durationMinutes: number;
  focusScore: number;
  pomodoroCount: number;
  notes?: string;
  sessionType?: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface Task {
  id: string;
  uid: string;
  title: string;
  completed: boolean;
  subjectId?: string;
  subjectName?: string;
  dueDate?: string;
  /** "HH:MM" local time; empty = any time that day */
  dueTime?: string;
  priority?: "low" | "medium" | "high";
  estimatedMinutes?: number;
  /** Missing = "task" (older documents) */
  kind?: TaskKind;
  /** Revision tasks can belong to an exam */
  examId?: string;
  reminderMinutesBefore?: number;
  /** When done, a copy is created this many days later (spaced revision) */
  repeatAfterDays?: number;
  createdAt: string;
}

export type TaskKind = "task" | "homework" | "revision";

export interface Topic {
  id: string;
  subjectId: string;
  title: string;
  done: boolean;
  order: number;
  examId?: string;
  createdAt: number;
}

export interface Exam {
  id: string;
  subjectId: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  startTime?: string;
  durationMinutes?: number;
  room?: string;
  seat?: string;
  notes?: string;
  reminderMinutesBefore?: number;
  createdAt: number;
}

export interface Goal {
  id: string;
  uid: string;
  title: string;
  type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  targetHours: number;
  currentHours: number;
  subjectId?: string;
  subjectName?: string;
  deadline: string;
  completed: boolean;
  createdAt: string;
}

export type TimerState = "idle" | "running" | "paused" | "break";

/** Firestore-synced timer state (stored at users/{uid}/timerState/current) */
export interface TimerSyncDoc {
  timerState: "idle" | "running" | "paused";
  mode: "focus" | "short-break" | "long-break";
  startTimestamp: number | null;
  remainingWhenStarted: number;
  totalSeconds: number;
  pomodoroIndex: number;
  totalPomodoros: number;
  pomodoroLength: number;
  shortBreak: number;
  longBreak: number;
  selectedSubjectId: string;
  selectedSubjectName: string;
  updatedAt: number;
  /** Which browser tab/device last wrote — used to skip echoed-back writes */
  deviceId: string;
  /** Which device owns the current focus session and is responsible for saving it */
  sessionOwnerDeviceId?: string;
}

export interface TimerSession {
  subjectId: string;
  subjectName: string;
  pomodoroIndex: number;
  totalPomodoros: number;
  secondsRemaining: number;
  totalSeconds: number;
  state: TimerState;
  mode: "focus" | "short-break" | "long-break";
}

export interface WeeklyData {
  day: string;
  hours: number;
  percentage: number;
}

export interface HeatmapCell {
  date: string;
  minutes: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface SubjectDistribution {
  subjectId: string;
  subjectName: string;
  color: string;
  percentage: number;
  hours: number;
}

/** One weekly time slot of a class. `week` limits it to one week of an A/B (1–4 week) rotation. */
export interface ClassSlot {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  week?: number;
}

export interface ClassItem {
  id: string;
  subjectId: string;
  /** Optional extra name, e.g. "Lab" or "Lecture" */
  title?: string;
  room?: string;
  teacher?: string;
  slots: ClassSlot[];
  reminderMinutesBefore?: number;
  createdAt: number;
}

export interface Holiday {
  name: string;
  start: string; // "YYYY-MM-DD"
  end: string;   // inclusive
}

/** Stored at users/{uid}/preferences/timetable */
export interface TimetableSettings {
  termStart?: string;
  termEnd?: string;
  /** 1 = every week the same; 2 = A/B weeks; up to 4 */
  rotationWeeks: number;
  /** A day in the week that counts as week 1 (A) */
  rotationStartDate?: string;
  holidays: Holiday[];
}
