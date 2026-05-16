"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useAmbientStore } from "@/store/ambientStore";
import LogSessionModal from "./LogSessionModal";
import SoundsPopover from "./SoundsPopover";
import VolumePopover from "./VolumePopover";
import TasksPopover from "./TasksPopover";

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

type Popover = "sounds" | "volume" | "tasks" | null;

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
  const [popover, setPopover] = useState<Popover>(null);

  const masterVolume = useAmbientStore((s) => s.masterVolume);
  const playingCount = useAmbientStore((s) =>
    Object.values(s.tracks).filter((t) => t.playing).length
  );

  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    }
    if (popover !== null) {
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }
  }, [popover]);

  const toggle = (p: Popover) => setPopover((cur) => (cur === p ? null : p));

  const volumeIcon =
    masterVolume === 0 ? "volume_off" : masterVolume < 0.5 ? "volume_down" : "volume_up";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-4 md:px-12 h-16 md:h-20">
        <h2 className="font-grotesk text-[18px] md:text-[22px] font-bold text-primary truncate">{title}</h2>

        <div ref={toolbarRef} className="flex items-center gap-2 md:gap-3 relative">
          {/* Sounds */}
          <div className="relative">
            <button
              onClick={() => toggle("sounds")}
              title="Relaxation sounds"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
                popover === "sounds" || playingCount > 0
                  ? "bg-primary/15 text-primary border border-primary/40"
                  : "text-on-surface-variant hover:text-primary hover:bg-primary/10 border border-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">music_note</span>
              {playingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-secondary text-[9px] font-bold text-background flex items-center justify-center">
                  {playingCount}
                </span>
              )}
            </button>
            {popover === "sounds" && <SoundsPopover onClose={() => setPopover(null)} />}
          </div>

          {/* Volume */}
          <div className="relative">
            <button
              onClick={() => toggle("volume")}
              title="Master volume"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
                popover === "volume"
                  ? "bg-primary/15 text-primary border border-primary/40"
                  : "text-on-surface-variant hover:text-primary hover:bg-primary/10 border border-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{volumeIcon}</span>
            </button>
            {popover === "volume" && <VolumePopover onClose={() => setPopover(null)} />}
          </div>

          {/* Tasks */}
          <div className="relative">
            <button
              onClick={() => toggle("tasks")}
              title="Tasks"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
                popover === "tasks"
                  ? "bg-primary/15 text-primary border border-primary/40"
                  : "text-on-surface-variant hover:text-primary hover:bg-primary/10 border border-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">checklist</span>
            </button>
            {popover === "tasks" && <TasksPopover onClose={() => setPopover(null)} />}
          </div>

          <div className="w-px h-6 bg-outline-variant mx-1 hidden sm:block" />

          {/* Avatar + name */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-[13px] md:text-[16px] select-none flex-shrink-0">
              {initials}
            </div>
            <div className="hidden lg:block">
              <p className="text-[15px] font-bold text-on-surface font-inter leading-tight">{displayName}</p>
              <p className="text-[12px] text-on-surface-variant font-inter">Member since {memberSince}</p>
            </div>
          </div>

          {/* Settings (mobile only) */}
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
