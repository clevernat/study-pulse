"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, SETTINGS, matches, sectionFor, testId, type NavSection } from "./nav";

// Phone bar: the 4 sections, with the timer as the big button in the middle.
const TIMER = { href: "/timer", label: "Timer", icon: "timer" };

export default function Sidebar() {
  const pathname = usePathname();
  const current = sectionFor(pathname)?.key;
  const onTimer = matches(pathname, TIMER.href);

  const sideLink = (s: NavSection) => {
    const active = current === s.key;
    return (
      <Link
        key={s.key}
        href={s.href}
        data-testid={`nav-${s.key}`}
        aria-current={active ? "page" : undefined}
        className={active ? "nav-item-active" : "nav-item"}
      >
        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{s.icon}</span>
        <span className="text-[15px] font-inter">{s.label}</span>
      </Link>
    );
  };

  const [left, right] = [SECTIONS.slice(0, 2), SECTIONS.slice(2)];
  const barLink = (s: NavSection) => {
    // On the timer page the middle button is active, not "Study".
    const active = current === s.key && !onTimer;
    return (
      <Link
        key={s.key}
        href={s.href}
        data-testid={testId("bottom-nav", s.href)}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl transition-colors ${
          active ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{s.icon}</span>
        <span className="text-[11px] font-inter font-medium">{s.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex h-screen w-60 fixed left-0 top-0 flex-col border-r border-outline-variant bg-surface py-7 px-3 z-50">
        <Link href="/today" className="mb-8 px-3 block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="font-grotesk text-[24px] font-bold tracking-tight text-on-surface leading-none">
            Study<span className="text-primary">Pulse</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="flex-1 space-y-1">
          {SECTIONS.map(sideLink)}
        </nav>

        <div className="space-y-3">
          <Link
            href="/timer"
            className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary-container py-2.5 rounded-xl font-semibold font-inter hover:brightness-110 active:scale-[0.98] transition text-[14px]"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
            Start studying
          </Link>
          {sideLink(SETTINGS)}
        </div>
      </aside>

      {/* ── Phone bottom bar ────────────────────────────────────── */}
      <nav aria-label="Primary" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur border-t border-outline-variant flex items-center justify-around px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
        {left.map(barLink)}
        <Link
          href={TIMER.href}
          data-testid={testId("bottom-nav", TIMER.href)}
          aria-label="Timer"
          aria-current={onTimer ? "page" : undefined}
          className="flex flex-1 justify-center py-1"
        >
          <span className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            onTimer ? "bg-primary text-on-primary" : "bg-primary-container text-on-primary-container"
          }`}>
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>{TIMER.icon}</span>
          </span>
        </Link>
        {right.map(barLink)}
      </nav>
    </>
  );
}
