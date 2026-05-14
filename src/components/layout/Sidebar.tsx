"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/subjects",  label: "Subjects",  icon: "subject" },
  { href: "/sessions",  label: "Sessions",  icon: "history" },
  { href: "/timer",     label: "Timer",     icon: "timer" },
  { href: "/goals",     label: "Goals",     icon: "track_changes" },
  { href: "/reports",   label: "Reports",   icon: "bar_chart" },
  { href: "/settings",  label: "Settings",  icon: "settings" },
];

// Bottom nav shows 5 primary items on mobile
const bottomNavItems = [
  { href: "/dashboard", label: "Home",     icon: "dashboard" },
  { href: "/sessions",  label: "Sessions", icon: "history" },
  { href: "/timer",     label: "Timer",    icon: "timer" },
  { href: "/goals",     label: "Goals",    icon: "track_changes" },
  { href: "/settings",  label: "Settings", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  const clean = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return clean === href || (href === "/dashboard" && (clean === "/" || clean === ""));
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 flex-col border-r border-outline-variant bg-surface py-8 px-4 z-50">
        {/* Brand */}
        <div className="mb-10 px-2">
          <h1 className="font-grotesk text-[28px] font-bold tracking-tighter text-primary leading-none">
            StudyPulse
          </h1>
          <p className="text-[13px] text-on-surface-variant mt-1 font-inter">Academic Elite</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? "nav-item-active" : "nav-item"}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="text-[15px] font-inter">{item.label}</span>
            </Link>
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

      {/* ── Mobile bottom nav ───────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-outline-variant flex items-center justify-around px-2 h-16">
        {bottomNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          const isTimer = item.href === "/timer";
          return (
            <Link
              key={item.href}
              href={item.href}
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
      </nav>
    </>
  );
}
