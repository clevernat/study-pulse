"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeDocument } from "@/lib/firebase/firestore";
import { createFeedToken, deleteFeedToken, feedUrls } from "@/lib/firebase/calendarFeed";
import { useCollection } from "@/lib/firebase/useCollection";
import { useTimetable } from "@/lib/firebase/useTimetable";
import { buildIcs, feedEvents } from "@/lib/ics";
import { addDays } from "@/lib/timetable";
import { localDateStr } from "@/lib/dateUtils";
import { downloadText } from "@/lib/csv";
import { inputCls } from "@/components/ui/Field";
import type { ClassItem, Exam, StudyBlock, Subject, Task } from "@/types";

// The live link needs a small server (the calendarFeed function). It is off
// until that server runs; set NEXT_PUBLIC_CALENDAR_FEED=1 in the build then.
const LIVE_FEED = process.env.NEXT_PUBLIC_CALENDAR_FEED === "1";

export default function CalendarFeedCard() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const subjects = useCollection<Subject>("subjects").items;
  const exams = useCollection<Exam>("exams").items;
  const tasks = useCollection<Task>("tasks").items;
  const blocks = useCollection<StudyBlock>("studyBlocks").items;
  const classes = useCollection<ClassItem>("classes").items;
  const { settings: timetable } = useTimetable();
  useEffect(() => (user ? subscribeDocument<{ token: string }>(user.uid, "calendarFeed", "current", (d) => setToken(d?.token ?? null)) : undefined), [user]);
  if (!user) return null;
  const urls = token ? feedUrls(token, window.location.origin) : null;

  function download() {
    const today = localDateStr();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ics = buildIcs(feedEvents({ timeZone, subjects, exams, tasks, blocks, classes, timetable }, addDays(today, -30), addDays(today, 180)), "StudyPulse");
    downloadText(ics, "studypulse.ics", "text/calendar");
  }

  return (
    <section className="glass-card p-6 flex flex-col gap-3" data-testid="calendar-card">
      <h2 className="font-space font-semibold text-[#e8e8f0]">Calendar sync</h2>
      {!LIVE_FEED ? (
        <p data-testid="feed-download-only" className="text-sm text-on-surface-variant">Put your exams, homework, study blocks and classes into Google, Apple or Outlook Calendar: download the .ics file below and import it in your calendar app. It is a copy: download it again after changes. (A live link that updates by itself will come later.)</p>
      ) : (
        <p className="text-sm text-on-surface-variant">Show your exams, homework, study blocks and classes in Google, Apple or Outlook Calendar. The calendar app checks for changes every few hours. It is read-only: changes made in the calendar app do not come back.</p>
      )}
      {!LIVE_FEED ? null : !urls ? (
        <button data-testid="feed-create" onClick={() => createFeedToken(user.uid)} className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm">
          <span className="material-symbols-outlined text-[18px]">link</span>Create my private calendar link
        </button>
      ) : (
        <>
          <div className="flex gap-2">
            <input data-testid="feed-url" readOnly className={`${inputCls} font-jetbrains text-xs`} value={urls.https} onFocus={(e) => e.target.select()} />
            <button data-testid="feed-copy" onClick={async () => { await navigator.clipboard.writeText(urls.https).catch(() => undefined); setCopied(true); }}
              className="px-3 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:text-on-surface">{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="text-xs text-tertiary">Keep this link private: anyone with it can see these calendar items.</p>
          <div className="flex gap-2 flex-wrap text-sm">
            <a href={urls.google} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl border border-outline-variant text-on-surface hover:border-primary">Add to Google Calendar</a>
            <a href={urls.webcal} className="px-3 py-2 rounded-xl border border-outline-variant text-on-surface hover:border-primary">Add to Apple Calendar</a>
            <a href={urls.outlook} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl border border-outline-variant text-on-surface hover:border-primary">Add to Outlook</a>
          </div>
          <div className="flex gap-3 text-xs">
            <button data-testid="feed-reset" onClick={() => confirm("Make a new link? The old link will stop working in every calendar app.") && createFeedToken(user.uid)} className="text-on-surface-variant hover:text-on-surface">Make a new link</button>
            <button onClick={() => confirm("Turn off the calendar link?") && deleteFeedToken(user.uid)} className="text-error">Turn off</button>
          </div>
        </>
      )}
      {LIVE_FEED ? (
        <button data-testid="feed-download" onClick={download} className="self-start text-sm text-primary underline">Download a .ics file instead (one-time copy)</button>
      ) : (
        <button data-testid="feed-download" onClick={download} className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm">
          <span className="material-symbols-outlined text-[18px]">download</span>Download calendar file (.ics)
        </button>
      )}
    </section>
  );
}
