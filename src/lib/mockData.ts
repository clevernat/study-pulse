import type { Subject, Session, Goal, WeeklyData, HeatmapCell, User } from "@/types";

export const mockUser: User = {
  uid: "mock-uid-1",
  displayName: "Alex Rivera",
  email: "alex.rivera@email.com",
  memberSince: "2023-09-01",
  streak: 12,
  longestStreak: 28,
  totalHours: 342,
  preferences: {
    pomodoroLength: 25,
    shortBreak: 5,
    longBreak: 15,
    theme: "dark",
    soundEnabled: true,
    notificationsEnabled: true,
    dailyGoalHours: 4,
  },
};

export const mockSubjects: Subject[] = [
  { id: "s1", uid: "mock-uid-1", name: "Calculus II", icon: "functions", color: "primary", category: "STEM", totalMinutes: 510, sessionCount: 8, createdAt: "2024-09-01" },
  { id: "s2", uid: "mock-uid-1", name: "Python Advanced", icon: "code", color: "secondary", category: "CS", totalMinutes: 732, sessionCount: 12, createdAt: "2024-09-01" },
  { id: "s3", uid: "mock-uid-1", name: "IELTS Prep", icon: "language", color: "tertiary", category: "LANG", totalMinutes: 246, sessionCount: 5, createdAt: "2024-09-15" },
  { id: "s4", uid: "mock-uid-1", name: "Modern History", icon: "history_edu", color: "primary", category: "HUMN", totalMinutes: 420, sessionCount: 7, createdAt: "2024-09-20" },
  { id: "s5", uid: "mock-uid-1", name: "Thermodynamics", icon: "thermostat", color: "secondary", category: "STEM", totalMinutes: 360, sessionCount: 6, createdAt: "2024-10-01" },
  { id: "s6", uid: "mock-uid-1", name: "Linear Algebra", icon: "grid_on", color: "tertiary", category: "MATH", totalMinutes: 285, sessionCount: 5, createdAt: "2024-10-05" },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const mockSessions: Session[] = [
  { id: "ss1", uid: "mock-uid-1", subjectId: "s1", subjectName: "Calculus II", subjectColor: "primary", durationMinutes: 105, focusScore: 92, pomodoroCount: 2, date: daysAgo(0), startTime: "09:00", endTime: "10:45" },
  { id: "ss2", uid: "mock-uid-1", subjectId: "s2", subjectName: "Python Advanced", subjectColor: "secondary", durationMinutes: 150, focusScore: 98, pomodoroCount: 3, date: daysAgo(0), startTime: "11:00", endTime: "13:30" },
  { id: "ss3", uid: "mock-uid-1", subjectId: "s3", subjectName: "IELTS Prep", subjectColor: "tertiary", durationMinutes: 50, focusScore: 84, pomodoroCount: 1, date: daysAgo(1), startTime: "14:00", endTime: "14:50" },
  { id: "ss4", uid: "mock-uid-1", subjectId: "s1", subjectName: "Calculus II", subjectColor: "primary", durationMinutes: 75, focusScore: 88, pomodoroCount: 2, date: daysAgo(1), startTime: "16:00", endTime: "17:15" },
  { id: "ss5", uid: "mock-uid-1", subjectId: "s4", subjectName: "Modern History", subjectColor: "primary", durationMinutes: 180, focusScore: 95, pomodoroCount: 4, date: daysAgo(3), startTime: "10:00", endTime: "13:00" },
  { id: "ss6", uid: "mock-uid-1", subjectId: "s5", subjectName: "Thermodynamics", subjectColor: "secondary", durationMinutes: 120, focusScore: 90, pomodoroCount: 2, date: daysAgo(3), startTime: "15:00", endTime: "17:00" },
  { id: "ss7", uid: "mock-uid-1", subjectId: "s2", subjectName: "Python Advanced", subjectColor: "secondary", durationMinutes: 90, focusScore: 96, pomodoroCount: 2, date: daysAgo(5), startTime: "09:30", endTime: "11:00" },
  { id: "ss8", uid: "mock-uid-1", subjectId: "s6", subjectName: "Linear Algebra", subjectColor: "tertiary", durationMinutes: 60, focusScore: 79, pomodoroCount: 1, date: daysAgo(6), startTime: "13:00", endTime: "14:00" },
];

export const mockGoals: Goal[] = [
  { id: "g1", uid: "mock-uid-1", title: "Daily Study Goal", type: "daily", targetHours: 4, currentHours: 3.2, deadline: "2024-10-24", completed: false, createdAt: "2024-10-01" },
  { id: "g2", uid: "mock-uid-1", title: "Weekly Python Mastery", type: "weekly", targetHours: 10, currentHours: 7.5, subjectId: "s2", subjectName: "Python Advanced", deadline: "2024-10-27", completed: false, createdAt: "2024-10-20" },
  { id: "g3", uid: "mock-uid-1", title: "Calculus Deep Dive", type: "weekly", targetHours: 8, currentHours: 8, subjectId: "s1", subjectName: "Calculus II", deadline: "2024-10-27", completed: true, createdAt: "2024-10-20" },
  { id: "g4", uid: "mock-uid-1", title: "Monthly IELTS Prep", type: "monthly", targetHours: 20, currentHours: 9.8, subjectId: "s3", subjectName: "IELTS Prep", deadline: "2024-10-31", completed: false, createdAt: "2024-10-01" },
  { id: "g5", uid: "mock-uid-1", title: "Weekly Reading Hours", type: "weekly", targetHours: 5, currentHours: 5, deadline: "2024-10-27", completed: true, createdAt: "2024-10-20" },
];

export const mockWeeklyData: WeeklyData[] = [
  { day: "Mon", hours: 3.5, percentage: 70 },
  { day: "Tue", hours: 4.2, percentage: 85 },
  { day: "Wed", hours: 2.0, percentage: 40 },
  { day: "Thu", hours: 4.8, percentage: 95 },
  { day: "Fri", hours: 3.0, percentage: 60 },
  { day: "Sat", hours: 1.0, percentage: 20 },
  { day: "Sun", hours: 1.5, percentage: 30 },
];

export function generateHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const rand = Math.random();
    const minutes = rand < 0.2 ? 0 : Math.floor(rand * 240);
    const intensity = minutes === 0 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : minutes < 180 ? 3 : 4;
    cells.push({
      date: d.toISOString().split("T")[0],
      minutes,
      intensity: intensity as 0 | 1 | 2 | 3 | 4,
    });
  }
  return cells;
}

export function computeStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  const uniqueDates = Array.from(new Set(sessions.map((s) => s.date))).sort().reverse();
  let streak = 0;
  const today = new Date("2024-10-24");
  for (let i = 0; i < uniqueDates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];
    if (uniqueDates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
