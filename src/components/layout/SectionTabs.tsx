"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { matches, sectionFor, testId } from "./nav";

/** Tabs for the pages of the current section (e.g. Plan: Calendar, Tasks, Exams…). */
export default function SectionTabs() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  // Card review is a focus mode: no tabs there.
  if (!section || section.pages.length < 2 || matches(pathname, "/flashcards/review")) return null;
  return (
    <nav aria-label={`${section.label} pages`} className="-mx-4 md:mx-0 mb-6 md:mb-8 overflow-x-auto overscroll-x-contain">
      <ul className="flex gap-1 px-4 md:px-0 border-b border-outline-variant min-w-max">
        {section.pages.map((p) => {
          const active = matches(pathname, p.href);
          return (
            <li key={p.href}>
              <Link
                href={p.href}
                data-testid={testId("tab", p.href)}
                aria-current={active ? "page" : undefined}
                className={`relative block px-3 md:px-4 py-2.5 text-[14px] font-inter font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-lg ${
                  active ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {p.label}
                {active && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
