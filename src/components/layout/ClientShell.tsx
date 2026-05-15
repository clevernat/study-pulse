"use client";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useTimerStore } from "@/store/timerStore";
import { subscribeTimerState, subscribeUserPreferences } from "@/lib/firebase/firestore";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import FloatingTimer from "./FloatingTimer";

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

  // Browsers throttle/kill setInterval in background tabs.
  // Re-run init() whenever the tab becomes visible so the interval is revived
  // and the remaining time is recalculated from the wall clock.
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        initTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
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
        ts.setSubject("", "Select a Subject");
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
        <main className="pt-16 pb-24 px-4 md:pt-20 md:pb-12 md:px-12 min-h-screen">
          {children}
        </main>
      </div>
      <FloatingTimer />
    </div>
  );
}
