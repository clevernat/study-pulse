// The progress summary each member's app writes to progress/{uid}, and the
// plain-language signals (what someone does well, what needs a look) that the
// admin page and the member's own dashboard show. Pure functions, no Firestore.
import type { Exam, Goal, Progress, Session, Subject, TestResult, Topic } from "@/types";
import { addDays, mondayOf } from "./timetable";
import { averageRating, goalHours, weeklyReview } from "./insights";

export interface ProgressInput {
  name: string;
  email: string;
  sessions: Session[];
  subjects: Subject[];
  goals: Goal[];
  exams: Exam[];
  results: TestResult[];
  topics: Topic[];
  target: { daily: number; weekly: number };
}

const DAY_MS = 86_400_000;
export const YEAR_DAYS = 371;

/** Minutes on `date` from a summary's year (0 for days it does not cover). */
export function yearMinutes(p: Pick<Progress, "year" | "today">, date: string): number {
  const back = Math.round((Date.parse(p.today) - Date.parse(date)) / DAY_MS);
  return back < 0 ? 0 : p.year?.[YEAR_DAYS - 1 - back] ?? 0;
}
const minutes = (list: Session[]) => list.reduce((n, s) => n + s.durationMinutes, 0);

export function buildProgress(input: ProgressInput, today: string, now: number): Omit<Progress, "id"> {
  const { sessions, subjects } = input;
  const review = weeklyReview(sessions, subjects, mondayOf(today), today);
  const perDay: Record<string, number> = {};
  for (const s of sessions) perDay[s.date] = (perDay[s.date] ?? 0) + s.durationMinutes;
  const days = Array.from({ length: 14 }, (_, i) => perDay[addDays(today, i - 13)] ?? 0);
  const year = Array.from({ length: YEAR_DAYS }, (_, i) => perDay[addDays(today, i - YEAR_DAYS + 1)] ?? 0);
  const monthAgo = addDays(today, -30);
  const upcoming = input.exams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const pcts = input.results.filter((r) => r.maxScore > 0).map((r) => (r.score / r.maxScore) * 100);
  return {
    name: input.name,
    email: input.email,
    updatedAt: now,
    today,
    totalMinutes: minutes(sessions),
    sessionCount: sessions.length,
    days,
    year,
    thisWeek: review.thisWeek,
    lastWeek: review.lastWeek,
    streak: review.streak,
    longestStreak: review.longestStreak,
    rating: averageRating(sessions.filter((s) => s.date >= monthAgo)),
    distractionsPerHour: review.distractionsPerHour,
    subjects: subjects
      .map((sub) => {
        const list = sessions.filter((s) => s.subjectId === sub.id);
        return { name: sub.name, color: sub.color, minutes: minutes(list), weekMinutes: review.subjects.find((r) => r.subjectId === sub.id)?.thisWeek ?? 0, ...(sub.weeklyTargetMinutes ? { weeklyTarget: sub.weeklyTargetMinutes } : {}) };
      })
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6),
    goals: { active: input.goals.filter((g) => !g.completed && goalHours(g, sessions) < g.targetHours).length, done: input.goals.filter((g) => g.completed || goalHours(g, sessions) >= g.targetHours).length },
    nextExam: upcoming[0] ? { title: upcoming[0].title, date: upcoming[0].date } : null,
    results: pcts.length ? { count: pcts.length, avgPct: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) } : null,
    topics: { done: input.topics.filter((t) => t.done).length, total: input.topics.length },
    bestTime: review.bestTime ? { part: review.bestTime.part, weekday: review.bestTime.weekday } : null,
    target: input.target,
  };
}

/** A member's 14 days lined up to end on `today` (days after their last update count as 0). */
export function alignedDays(p: Pick<Progress, "days" | "today">, today: string): number[] {
  const lag = Math.round((Date.parse(today) - Date.parse(p.today)) / DAY_MS);
  return Array.from({ length: 14 }, (_, i) => p.days[i + lag] ?? 0);
}

export interface Signal { kind: "good" | "watch" | "info"; icon: string; text: string }

/** What someone does well ("good"), what needs a look ("watch") and plain facts ("info"), best first. */
export function signals(p: Omit<Progress, "id">, now: number): Signal[] {
  const out: Signal[] = [];
  const idleDays = Math.floor((now - p.updatedAt) / DAY_MS);
  const last7 = p.days.slice(-7).reduce((a, b) => a + b, 0);

  if (p.streak >= 3) out.push({ kind: "good", icon: "local_fire_department", text: `${p.streak}-day streak` });
  if (p.lastWeek > 0 && p.thisWeek > p.lastWeek) out.push({ kind: "good", icon: "trending_up", text: `Up ${Math.round(((p.thisWeek - p.lastWeek) / p.lastWeek) * 100)}% on last week` });
  if (p.rating !== null && p.rating >= 4) out.push({ kind: "good", icon: "psychology", text: `Strong focus (${p.rating}/5)` });
  if (p.results && p.results.avgPct >= 75) out.push({ kind: "good", icon: "grade", text: `Scores average ${p.results.avgPct}%` });
  if (p.topics.total >= 3 && p.topics.done / p.topics.total >= 0.5) out.push({ kind: "good", icon: "task_alt", text: `Covered ${Math.round((p.topics.done / p.topics.total) * 100)}% of topics` });
  if (p.goals.done > 0) out.push({ kind: "good", icon: "flag", text: `${p.goals.done} goal${p.goals.done === 1 ? "" : "s"} reached` });

  if (idleDays >= 7) out.push({ kind: "watch", icon: "schedule", text: `Has not opened StudyPulse for ${idleDays} days` });
  else if (p.sessionCount > 0 && last7 === 0) out.push({ kind: "watch", icon: "hourglass_empty", text: "No study in the last 7 days" });
  if (p.lastWeek > 0 && p.thisWeek < p.lastWeek / 2 && last7 > 0) out.push({ kind: "watch", icon: "trending_down", text: `Down ${Math.round(((p.lastWeek - p.thisWeek) / p.lastWeek) * 100)}% on last week` });
  if (p.rating !== null && p.rating < 3) out.push({ kind: "watch", icon: "blur_on", text: `Low focus (${p.rating}/5)` });
  if (p.results && p.results.avgPct < 50) out.push({ kind: "watch", icon: "report", text: `Scores average ${p.results.avgPct}%` });

  if (p.subjects[0]?.minutes) out.push({ kind: "info", icon: "school", text: `Most time: ${p.subjects[0].name}` });
  if (p.bestTime) out.push({ kind: "info", icon: "wb_twilight", text: `Works best: ${p.bestTime.part.toLowerCase()}, ${p.bestTime.weekday}s` });
  return out;
}
