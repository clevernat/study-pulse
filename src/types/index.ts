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
  color: "primary" | "secondary" | "tertiary";
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
  subjectColor: "primary" | "secondary" | "tertiary";
  durationMinutes: number;
  focusScore: number;
  pomodoroCount: number;
  notes?: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface Goal {
  id: string;
  uid: string;
  title: string;
  type: "daily" | "weekly" | "monthly";
  targetHours: number;
  currentHours: number;
  subjectId?: string;
  subjectName?: string;
  deadline: string;
  completed: boolean;
  createdAt: string;
}

export type TimerState = "idle" | "running" | "paused" | "break";

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
