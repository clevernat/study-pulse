"use client";
import { create } from "zustand";
import type { Subject, Session, Goal, User } from "@/types";
import { mockUser, mockSubjects, mockSessions, mockGoals } from "@/lib/mockData";

interface AppStore {
  user: User;
  subjects: Subject[];
  sessions: Session[];
  goals: Goal[];
  isLoading: boolean;

  setUser: (user: User) => void;
  setSubjects: (subjects: Subject[]) => void;
  setSessions: (sessions: Session[]) => void;
  setGoals: (goals: Goal[]) => void;
  addSession: (session: Session) => void;
  addSubject: (subject: Subject) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  getSubjectById: (id: string) => Subject | undefined;
  getWeeklyHours: () => number;
  getDailyAverage: () => number;
}

export const useAppStore = create<AppStore>((set, get) => ({
  user: mockUser,
  subjects: mockSubjects,
  sessions: mockSessions,
  goals: mockGoals,
  isLoading: false,

  setUser: (user) => set({ user }),
  setSubjects: (subjects) => set({ subjects }),
  setSessions: (sessions) => set({ sessions }),
  setGoals: (goals) => set({ goals }),

  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),

  addSubject: (subject) =>
    set((state) => ({ subjects: [...state.subjects, subject] })),

  updateGoal: (id, updates) =>
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),

  getSubjectById: (id) => get().subjects.find((s) => s.id === id),

  getWeeklyHours: () => {
    const { sessions } = get();
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessions
      .filter((s) => new Date(s.date) >= weekAgo)
      .reduce((sum, s) => sum + s.durationMinutes / 60, 0);
  },

  getDailyAverage: () => {
    const { sessions } = get();
    const uniqueDays = new Set(sessions.map((s) => s.date)).size;
    if (uniqueDays === 0) return 0;
    const totalHours = sessions.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
    return totalHours / uniqueDays;
  },
}));
