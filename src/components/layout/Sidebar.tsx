"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface NavItem { href: string; label: string; icon: string }

// Single source of truth for navigation (desktop sidebar + phone "More" sheet).
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "Plan",
    items: [
      { href: "/today", label: "Today", icon: "today" },
      { href: "/calendar", label: "Calendar", icon: "calendar_month" },
      { href: "/tasks", label: "Tasks", icon: "task_alt" },
      { href: "/exams", label: "Exams", icon: "event_upcoming" },
      { href: "/timetable", label: "Timetable", icon: "calendar_view_week" },
      { href: "/habits", label: "Habits", icon: "local_fire_department" },
    ],
  },
  {
    title: "Study",
    items: [
      { href: "/timer", label: "Timer", icon: "timer" },
      { href: "/subjects", label: "Subjects", icon: "category" },
      { href: "/sessions", label: "Sessions", icon: "history" },
      { href: "/goals", label: "Goals", icon: "track_changes" },
      { href: "/reports", label: "Reports", icon: "bar_chart" },
    ],
  },
  {
    title: "",
    items: [{ href: "/settings", label: "Settings", icon: "settings" }],
  },
];

// Phone bottom bar: 4 main pages + "More" (opens every page).
const bottomNavItems: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "dashboard" },
  { href: "/today", label: "Today", icon: "today" },
  { href: "/timer", label: "Timer", icon: "timer" },
  { href: "/calendar", label: "Calendar", icon: "calendar_month" },
];

function isActive(pathname: string, href: string) {
  const clean = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return clean === href || clean.startsWith(href + "/") || (href === "/dashboard" && (clean === "/" || clean === ""));
}

function testId(href: string) {
  return `nav${href.replace(/\//g, "-")}`;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logOut } = useAuth();
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet after navigating.
  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 flex-col border-r border-outline-variant bg-surface py-8 px-4 z-50">
        {/* Brand */}
        <div className="mb-6 px-2">
          <h1 className="font-grotesk text-[28px] font-bold tracking-tighter text-primary leading-none">
            StudyPulse
          </h1>
          <p className="text-[13px] text-on-surface-variant mt-1 font-inter">Study and plan</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "pt-3" : ""}>
              {group.title && (
                <p className="px-4 pb-1 text-[11px] uppercase tracking-widest text-on-surface-variant/60 font-inter">{group.title}</p>
              )}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={testId(item.href)}
                  className={isActive(pathname, item.href) ? "nav-item-active" : "nav-item"}
                >
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                  <span className="text-[15px] font-inter">{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="mt-auto pt-6 space-y-3">
          <Link
            href="/timer"
            className="w-full block text-center bg-primary-container text-on-primary-container py-3 rounded-xl font-bold font-inter hover:opacity-90 active:scale-95 transition-all text-[15px]"
          >
            Start Studying
          </Link>
          {user && (
            <div className="flex items-center gap-3 py-2 px-2">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-[13px] select-none flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-on-surface font-inter truncate leading-tight">{displayName}</p>
                <p className="text-[11px] text-on-surface-variant font-inter truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile "More" sheet ─────────────────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="All pages">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div
            data-testid="more-sheet"
            className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto bg-[#12121a] border-t border-[#252535] rounded-t-2xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant" />
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi} className="mb-2">
                {group.title && (
                  <p className="px-2 pb-1 text-[11px] uppercase tracking-widest text-on-surface-variant/60 font-inter">{group.title}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-testid={`more-${testId(item.href)}`}
                      className={`flex flex-col items-center gap-1 rounded-xl py-3 text-center ${
                        isActive(pathname, item.href) ? "bg-primary/15 text-primary" : "bg-surface-container text-on-surface"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                      <span className="text-[12px] font-inter">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={logOut}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-error bg-error/10 font-inter text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ───────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-outline-variant flex items-center justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] h-auto min-h-[64px]">
        {bottomNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          const isTimer = item.href === "/timer";
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`bottom-${testId(item.href)}`}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl transition-all ${
                isTimer
                  ? "relative"
                  : active
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {isTimer ? (
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  active ? "bg-primary text-on-primary" : "bg-primary-container text-on-primary-container"
                }`}>
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {item.icon}
                  </span>
                </div>
              ) : (
                <>
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[10px] font-inter font-medium">{item.label}</span>
                </>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          data-testid="bottom-more"
          aria-label="All pages"
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
          <span className="text-[10px] font-inter font-medium">More</span>
        </button>
      </nav>
    </>
  );
}
