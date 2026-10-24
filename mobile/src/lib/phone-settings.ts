import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Settings that belong to this phone only (kept on the device). */
interface PhoneSettings {
  remindersOn: boolean;
  timerAlertsOn: boolean;
  /** "HH:MM" daily plan notification, "" = off */
  dailySummaryTime: string;
  set: (patch: Partial<Omit<PhoneSettings, "set">>) => void;
}

export const usePhoneSettings = create<PhoneSettings>()(
  persist(
    (set) => ({ remindersOn: false, timerAlertsOn: true, dailySummaryTime: "", set: (patch) => set(patch) }),
    {
      name: "studypulse-phone-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ remindersOn, timerAlertsOn, dailySummaryTime }) => ({ remindersOn, timerAlertsOn, dailySummaryTime }),
    },
  ),
);
