"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAmbientStore } from "@/store/ambientStore";
import LogSessionModal from "./LogSessionModal";
import SoundsPopover from "./SoundsPopover";
import TasksPopover from "./TasksPopover";
import { sectionFor } from "./nav";

type Popover = "sounds" | "tasks" | "account" | null;

const iconBtn = (open: boolean) =>
  `relative w-9 h-9 flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
    open ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
  }`;

export default function TopBar() {
  const pathname = usePathname();
  // The page itself is named by the tabs below; the bar names the section.
  const title = sectionFor(pathname)?.label ?? "StudyPulse";

  const { user, logOut, isAdmin } = useAuth();
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const [showLogModal, setShowLogModal] = useState(false);
  const [popover, setPopover] = useState<Popover>(null);
  const playingCount = useAmbientStore((s) => Object.values(s.tracks).filter((t) => t.playing).length);

  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (popover === null) return;
    const onClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPopover(null); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClickOutside); document.removeEventListener("keydown", onKey); };
  }, [popover]);
  useEffect(() => setPopover(null), [pathname]);

  // Offline badge (changes are kept and sent when the connection is back)
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const toggle = (p: Popover) => setPopover((cur) => (cur === p ? null : p));

  return (
    <>
      <header className="fixed top-0 left-0 right-0 md:left-60 z-40 bg-surface/90 backdrop-blur-md border-b border-outline-variant flex justify-between items-center gap-3 px-4 md:px-10 h-14 md:h-16">
        <h2 data-testid="page-title" className="font-grotesk text-[18px] md:text-[20px] font-semibold tracking-tight text-on-surface truncate min-w-0">{title}</h2>

        <div ref={toolbarRef} className="flex items-center gap-1 md:gap-2 relative">
          {!online && (
            <span data-testid="offline-badge" title="You are offline. Changes are saved on this device and sent when you are back online."
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-tertiary/15 text-tertiary text-[11px] font-semibold">
              <span className="material-symbols-outlined text-[14px]">cloud_off</span><span className="hidden sm:inline">Offline</span>
            </span>
          )}

          <div className="relative">
            <button onClick={() => toggle("sounds")} title="Relaxation sounds" aria-label="Relaxation sounds and volume"
              aria-expanded={popover === "sounds"} className={iconBtn(popover === "sounds" || playingCount > 0)}>
              <span className="material-symbols-outlined text-[20px]">headphones</span>
              {playingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-secondary text-[10px] font-bold text-background flex items-center justify-center">{playingCount}</span>
              )}
            </button>
            {popover === "sounds" && <SoundsPopover onClose={() => setPopover(null)} />}
          </div>

          <div className="relative">
            <button onClick={() => toggle("tasks")} title="Tasks" aria-label="Quick tasks" aria-expanded={popover === "tasks"} className={iconBtn(popover === "tasks")}>
              <span className="material-symbols-outlined text-[20px]">checklist</span>
            </button>
            {popover === "tasks" && <TasksPopover onClose={() => setPopover(null)} />}
          </div>

          <button
            onClick={() => setShowLogModal(true)}
            className="ml-1 bg-primary text-on-primary px-3 md:px-4 h-9 rounded-full font-semibold font-inter hover:brightness-110 active:scale-[0.98] transition text-[13px] md:text-[14px] flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span className="hidden sm:inline">Log session</span>
            <span className="sm:hidden">Log</span>
          </button>

          {/* Account: name, settings, sign out */}
          <div className="relative ml-1">
            <button onClick={() => toggle("account")} data-testid="account-menu" aria-label="Account menu" aria-haspopup="menu"
              aria-expanded={popover === "account"}
              className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container font-semibold text-[13px] flex items-center justify-center select-none hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {initials}
            </button>
            {popover === "account" && (
              <div role="menu" className="absolute right-0 top-[calc(100%+8px)] w-64 glass-card p-2 shadow-[0_8px_40px_rgba(0,0,0,0.5)] z-50">
                <div className="px-3 py-2 mb-1 border-b border-outline-variant">
                  <p className="text-[14px] font-semibold text-on-surface truncate">{displayName}</p>
                  <p className="text-[12px] text-on-surface-variant truncate">{user?.email}</p>
                </div>
                {isAdmin && (
                  <Link role="menuitem" href="/admin" data-testid="account-admin"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-on-surface hover:bg-surface-container-high">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">admin_panel_settings</span>Admin
                  </Link>
                )}
                <Link role="menuitem" href="/settings" data-testid="account-settings"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-on-surface hover:bg-surface-container-high">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">settings</span>Settings
                </Link>
                <button role="menuitem" onClick={logOut} data-testid="account-signout"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-on-surface hover:bg-surface-container-high">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">logout</span>Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showLogModal && <LogSessionModal onClose={() => setShowLogModal(false)} />}
    </>
  );
}
