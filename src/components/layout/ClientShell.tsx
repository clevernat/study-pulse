"use client";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useTimerStore } from "@/store/timerStore";
import { subscribeTimerState, subscribeUserPreferences } from "@/lib/firebase/firestore";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import FloatingTimer from "./FloatingTimer";
import TimerSync from "./TimerSync";
import AmbientController from "./AmbientController";
import CompletionToast from "./CompletionToast";
import ReflectionModal from "@/components/ui/ReflectionModal";
import { formatTime } from "@/store/timerStore";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname === "/login" || pathname === "/login/" || pathname === "/" || pathname === "";
  const initTimer = useTimerStore((s) => s.init);

  // Restart timer interval after page load / refresh if it was running
  useEffect(() => {
    initTimer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore reduced-motion CSS class from localStorage on every page load
  useEffect(() => {
    if (localStorage.getItem("sp-reduced-motion") === "true") {
      document.documentElement.classList.add("reduced-motion");
    }
  }, []);

  // Daily goal reminder — fires a browser notification at 9 PM if enabled
  useEffect(() => {
    if (!user) return;
    const check = () => {
      if (localStorage.getItem("sp-notif-daily") === "false") return;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const now = new Date();
      if (now.getHours() !== 21) return; // Only at 9 PM
      const todayKey = `sp-reminded-${now.toISOString().slice(0, 10)}`;
      if (localStorage.getItem(todayKey)) return; // Already sent today
      localStorage.setItem(todayKey, "true");
      new Notification("StudyPulse — Daily Reminder 📚", {
        body: "Don't forget to study today! Open the app to log a session.",
      });
    };
    check(); // run once on mount in case it's already 9 PM
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  // Browsers throttle/kill setInterval when the screen turns off or the tab goes to
  // the background. Re-run init() on every resume signal so the interval is revived
  // and remaining time is recalculated from the wall clock.
  useEffect(() => {
    const resume = () => initTimer();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") initTimer();
    };
    // visibilitychange covers mobile screen-off and tab switching
    document.addEventListener("visibilitychange", handleVisibility);
    // window focus covers desktop OS screen-lock (doesn't always fire visibilitychange)
    window.addEventListener("focus", resume);
    // pageshow covers browser back/forward cache restores
    window.addEventListener("pageshow", resume);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Always-on cross-device sync ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // 1. When another device clears all data, timerState/current is deleted.
    //    Subscription fires with null → stop the timer on this device too.
    const unsubTimer = subscribeTimerState(user.uid, (remote) => {
      if (remote !== null) return; // non-null handled by timer page
      const ts = useTimerStore.getState();
      if (ts.state !== "idle") {
        ts.setPreset(ts.pomodoroLength);
        ts.setSubject("", "Select a Focus Area");
      }
    });

    // 2. Sync timer preferences from Firestore → Zustand store.
    //    When settings change on any device, all devices get updated values.
    const unsubPrefs = subscribeUserPreferences(user.uid, (prefs) => {
      if (!prefs) return;
      const ts = useTimerStore.getState();
      if (
        prefs.pomodoroLength === ts.pomodoroLength &&
        prefs.shortBreak === ts.shortBreak &&
        prefs.longBreak === ts.longBreak
      ) return; // no change

      if (ts.state === "idle") {
        // Safe to apply — timer not running
        ts.setDurations(prefs.pomodoroLength, prefs.shortBreak, prefs.longBreak);
      } else {
        // Timer running/paused — update values without resetting (take effect after current session)
        useTimerStore.setState({
          pomodoroLength: prefs.pomodoroLength,
          shortBreak: prefs.shortBreak,
          longBreak: prefs.longBreak,
        });
      }
    });

    return () => { unsubTimer(); unsubPrefs(); };
  }, [user]);

  // Live tab title: "🎯 03:45 — StudyPulse" when running, "⏸ 03:45 — StudyPulse" when paused
  useEffect(() => {
    if (isPublicPage) return;
    const update = () => {
      const { state, mode, secondsRemaining } = useTimerStore.getState();
      if (state === "idle") {
        document.title = "StudyPulse";
        return;
      }
      const emoji = state === "running"
        ? (mode === "focus" ? "🎯" : "☕")
        : "⏸";
      document.title = `${emoji} ${formatTime(secondsRemaining)} — StudyPulse`;
    };
    update();
    const id = setInterval(update, 1000);
    return () => {
      clearInterval(id);
      document.title = "StudyPulse";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicPage]);

  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      router.push("/login");
    }
  }, [user, loading, isPublicPage, router]);

  useEffect(() => {
    if (!loading && user && (pathname === "/" || pathname === "")) {
      router.push("/dashboard");
    }
  }, [user, loading, pathname, router]);

  if (isPublicPage) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      {/* Content: offset by sidebar on md+, full-width on mobile */}
      <div className="flex-1 md:ml-64 min-w-0">
        <TopBar />
        {/* pt for topbar, pb-20 on mobile for bottom nav */}
        <main className="pt-20 pb-24 px-4 md:pt-28 md:pb-12 md:px-12 min-h-screen">
          {children}
        </main>
      </div>
      <FloatingTimer />
      <TimerSync />
      <AmbientController />
      <CompletionToast />
      <ReflectionModal />
    </div>
  );
}
