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
  /** Share of the planned focus time actually studied, 0–100 (100 = finished the Pomodoro) */
  focusScore: number;
  pomodoroCount: number;
  notes?: string;
  sessionType?: string;
  /** Planned study block this session belongs to */
  blockId?: string;
  /** Flashcard review sessions: deck and number of answers */
  deckId?: string;
  reviewCount?: number;
  /** Topic of the subject studied (optional) */
  topicId?: string;
  topicTitle?: string;
  /** "How focused were you?" 1–5, answered after the session (missing = not rated) */
  focusRating?: number;
  /** Times the "I got distracted" button was pressed during the focus */
  distractions?: number;
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
  selectedTopicId?: string;
  selectedTopicTitle?: string;
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

/** A planned piece of study time on the calendar. */
export interface StudyBlock {
  id: string;
  title: string;
  subjectId?: string;
  taskId?: string;
  deckId?: string;
  date: string;  // "YYYY-MM-DD"
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  /** Marked done by hand */
  done?: boolean;
  /** Sessions saved while this block was active, and their minutes */
  sessionIds?: string[];
  minutesDone?: number;
  reminderMinutesBefore?: number;
  createdAt: number;
}

export type HabitSchedule = { type: "daily" } | { type: "weekly"; timesPerWeek: number };

export interface Habit {
  id: string;
  title: string;
  icon: string;
  color: string;
  schedule: HabitSchedule;
  /** Amount needed per day, e.g. 1 (just do it), 20 (cards), 60 (minutes) */
  target: number;
  unit?: string;
  /** Checked automatically from app data instead of by hand */
  autoSource?: "studyMinutes" | "cardsReviewed";
  /** "HH:MM" daily reminder */
  reminderTime?: string;
  archived?: boolean;
  /** "YYYY-MM-DD" → amount done that day (manual habits) */
  log: Record<string, number>;
  createdAt: number;
}

/** A practice test, quiz or exam score for a subject (users/{uid}/results). */
export interface TestResult {
  id: string;
  subjectId: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  score: number;
  maxScore: number;
  createdAt: number;
}

// ── Flashcards ───────────────────────────────────────────────────────────────

export interface Deck {
  id: string;
  name: string;
  subjectId: string;
  /** New cards shown per day (default 20) */
  newPerDay: number;
  /** Reviews shown per day (default 200) */
  reviewsPerDay: number;
  /** Wanted chance to remember a card when it comes back (default 0.9) */
  retention: number;
  createdAt: number;
}

export type NoteType = "basic" | "basicReverse" | "cloze";

export interface Note {
  id: string;
  deckId: string;
  subjectId: string;
  type: NoteType;
  /** HTML. basic: front/back. cloze: text/extra. */
  fields: { front?: string; back?: string; text?: string; extra?: string };
  tags: string[];
  source?: "csv" | "apkg";
  createdAt: number;
}

/** Scheduling state of one card (FSRS). Times are milliseconds. */
export interface Card {
  id: string;
  noteId: string;
  deckId: string;
  /** basic: 0; reverse card: 1; cloze: the cloze number (1, 2, …) */
  ord: number;
  due: number;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  /** 0 new, 1 learning, 2 review, 3 relearning */
  state: number;
  last_review: number | null;
  suspended: boolean;
  /** Hidden until this day ("YYYY-MM-DD", exclusive) */
  buriedUntil: string | null;
  createdAt: number;
}

export interface ReviewLogDoc {
  id: string;
  cardId: string;
  noteId: string;
  deckId: string;
  /** 1 Again, 2 Hard, 3 Good, 4 Easy */
  rating: number;
  /** Card state before the answer */
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  /** When the answer was given (ms) */
  review: number;
  /** Time spent on the card (ms) */
  durationMs: number;
}

/** One day of flashcard work (users/{uid}/reviewDays/{YYYY-MM-DD}), so stats and habits do not read every review. */
export interface ReviewDay {
  id: string;
  /** Answers given */
  count: number;
  /** Time spent (ms) */
  ms: number;
  /** "Again" answers */
  again: number;
  /** First answer of the day on cards in review: remembered / total */
  retPass: number;
  retTotal: number;
}
