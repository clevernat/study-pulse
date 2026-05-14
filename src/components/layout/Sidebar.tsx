"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/subjects", label: "Subjects", icon: "subject" },
  { href: "/sessions", label: "Sessions", icon: "history" },
  { href: "/timer", label: "Timer", icon: "timer" },
  { href: "/goals", label: "Goals", icon: "track_changes" },
  { href: "/reports", label: "Reports", icon: "bar_chart" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 flex flex-col border-r border-outline-variant bg-surface py-lg px-md z-50">
      {/* Brand */}
      <div className="mb-[40px]">
        <h1 className="font-grotesk text-[28px] font-bold tracking-tighter text-primary leading-none">
          StudyPulse
        </h1>
        <p className="text-[13px] text-on-surface-variant mt-1 font-inter">Academic Elite</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const cleanPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
          const isActive = cleanPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "nav-item-active" : "nav-item"}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="text-[15px] font-inter">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* CTA + User */}
      <div className="mt-auto pt-lg space-y-md">
        <Link
          href="/timer"
          className="w-full block text-center bg-primary-container text-on-primary-container py-md rounded-xl font-bold font-inter hover:opacity-90 active:scale-95 transition-all text-[15px]"
        >
          Start Studying
        </Link>
        {user && (
          <div className="flex items-center gap-md py-sm px-md">
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
  );
}
