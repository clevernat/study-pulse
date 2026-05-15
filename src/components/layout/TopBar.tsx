"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import LogSessionModal from "./LogSessionModal";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/subjects": "Subjects",
  "/sessions": "Study Sessions",
  "/timer": "Focus Timer",
  "/goals": "Study Goals",
  "/reports": "Reports & Analytics",
  "/settings": "Settings",
};

export default function TopBar() {
  const pathname = usePathname();
  const cleanPath = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const title = pageTitles[cleanPath] ?? "StudyPulse";

  const { user, logOut } = useAuth();
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).getFullYear().toString()
    : "2024";

  const [showLogModal, setShowLogModal] = useState(false);

  return (
    <>
      {/* Full-width on mobile, offset by sidebar on md+ */}
      <header className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-4 md:px-12 h-16 md:h-20">
        <h2 className="font-grotesk text-[18px] md:text-[22px] font-bold text-primary truncate">{title}</h2>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Avatar + name (name hidden on small screens) */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-[13px] md:text-[16px] select-none flex-shrink-0">
              {initials}
            </div>
            <div className="hidden lg:block">
              <p className="text-[15px] font-bold text-on-surface font-inter leading-tight">{displayName}</p>
              <p className="text-[12px] text-on-surface-variant font-inter">Member since {memberSince}</p>
            </div>
          </div>

          {/* Settings (mobile only — desktop uses sidebar) */}
          <Link
            href="/settings"
            title="Settings"
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </Link>

          {/* Sign out */}
          <button
            onClick={logOut}
            title="Sign out"
            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">logout</span>
          </button>

          {/* Log Session */}
          <button
            onClick={() => setShowLogModal(true)}
            className="bg-primary text-on-primary px-3 md:px-5 py-1.5 md:py-2 rounded-full font-bold font-inter hover:opacity-80 transition-all text-[13px] md:text-[14px] flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span className="hidden sm:inline">Log Session</span>
            <span className="sm:hidden">Log</span>
          </button>
        </div>
      </header>

      {showLogModal && <LogSessionModal onClose={() => setShowLogModal(false)} />}
    </>
  );
}
