"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
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
      <header className="fixed top-0 right-0 w-[calc(100%-16rem)] z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-[48px] h-20">
        <h2 className="font-grotesk text-[22px] font-bold text-primary">{title}</h2>
        <div className="flex items-center gap-lg">
          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-[16px] select-none">
              {initials}
            </div>
            <div className="hidden lg:block">
              <p className="text-[15px] font-bold text-on-surface font-inter leading-tight">{displayName}</p>
              <p className="text-[12px] text-on-surface-variant font-inter">Member since {memberSince}</p>
            </div>
          </div>
          <button
            onClick={logOut}
            title="Sign out"
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="bg-primary text-on-primary px-lg py-sm rounded-full font-bold font-inter hover:opacity-80 transition-all text-[14px] flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Log Session
          </button>
        </div>
      </header>

      {showLogModal && (
        <LogSessionModal onClose={() => setShowLogModal(false)} />
      )}
    </>
  );
}
