import { create } from "zustand";

interface ReflectionStore {
  show: boolean;
  sessionId: string | null;
  subjectName: string;
  open: (sessionId: string, subjectName: string) => void;
  close: () => void;
}

export const useReflectionStore = create<ReflectionStore>((set) => ({
  show: false,
  sessionId: null,
  subjectName: "",
  open: (sessionId, subjectName) => set({ show: true, sessionId, subjectName }),
  close: () => set({ show: false, sessionId: null, subjectName: "" }),
}));
