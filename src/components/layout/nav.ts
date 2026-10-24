// Single source of truth for navigation: 4 sections (sidebar, phone bar) and
// the pages inside each (tabs at the top of the page). URLs never change.
export interface NavPage { href: string; label: string }
export interface NavSection { key: string; label: string; icon: string; href: string; pages: NavPage[] }

export const SECTIONS: NavSection[] = [
  { key: "today", label: "Today", icon: "today", href: "/today", pages: [{ href: "/today", label: "Today" }] },
  {
    key: "plan", label: "Plan", icon: "calendar_month", href: "/calendar",
    pages: [
      { href: "/calendar", label: "Calendar" },
      { href: "/tasks", label: "Tasks" },
      { href: "/exams", label: "Exams" },
      { href: "/timetable", label: "Timetable" },
      { href: "/habits", label: "Habits" },
    ],
  },
  {
    key: "study", label: "Study", icon: "style", href: "/flashcards",
    pages: [
      { href: "/flashcards", label: "Flashcards" },
      { href: "/timer", label: "Timer" },
      { href: "/subjects", label: "Subjects" },
    ],
  },
  {
    key: "progress", label: "Progress", icon: "monitoring", href: "/dashboard",
    pages: [
      { href: "/dashboard", label: "Overview" },
      { href: "/reports", label: "Reports" },
      { href: "/sessions", label: "Sessions" },
      { href: "/goals", label: "Goals" },
    ],
  },
];

export const SETTINGS: NavSection = {
  key: "settings", label: "Settings", icon: "settings", href: "/settings", pages: [{ href: "/settings", label: "Settings" }],
};

const clean = (pathname: string) => (pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname);

/** True when `pathname` is `href` or a page below it (/flashcards/deck is under /flashcards). */
export function matches(pathname: string, href: string): boolean {
  const p = clean(pathname);
  return p === href || p.startsWith(href + "/");
}

export function sectionFor(pathname: string): NavSection | undefined {
  return [...SECTIONS, SETTINGS].find((s) => s.pages.some((pg) => matches(pathname, pg.href)));
}

export function pageFor(pathname: string): NavPage | undefined {
  return sectionFor(pathname)?.pages.find((pg) => matches(pathname, pg.href));
}

export const testId = (prefix: string, href: string) => `${prefix}${href.replace(/\//g, "-")}`;
