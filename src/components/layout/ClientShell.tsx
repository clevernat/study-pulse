"use client";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useTimerStore } from "@/store/timerStore";
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
        <main className="pt-20 px-4 py-6 md:p-12 pb-24 md:pb-12 min-h-screen">
          {children}
        </main>
      </div>
      <FloatingTimer />
    </div>
  );
}
