"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCollection } from "@/lib/firebase/useCollection";
import { useTimetable } from "@/lib/firebase/useTimetable";
import { buildEvents, weekDates, monthGrid, layoutDay, hourRange, minutesToHHMM, type CalEvent, type EventKind } from "@/lib/calendar";
import { addDays, toMinutes } from "@/lib/timetable";
import { localDateStr } from "@/lib/dateUtils";
import { getColor } from "@/lib/colorPalette";
import BlockModal from "@/components/planner/BlockModal";
import ExamModal from "@/components/planner/ExamModal";
import { secondaryBtnCls } from "@/components/ui/Field";
import type { ClassItem, Exam, Session, StudyBlock, Subject, Task } from "@/types";

type View = "day" | "week" | "month";
const HOUR_PX = 48;
const KINDS: { kind: EventKind; label: string; icon: string }[] = [
  { kind: "block", label: "Study blocks", icon: "edit_calendar" },
  { kind: "class", label: "Classes", icon: "calendar_view_week" },
  { kind: "exam", label: "Exams", icon: "event_upcoming" },
  { kind: "task", label: "Tasks", icon: "task_alt" },
  { kind: "session", label: "Done sessions", icon: "history" },
];
const KIND_ICON = Object.fromEntries(KINDS.map((k) => [k.kind, k.icon])) as Record<EventKind, string>;

function dayLabel(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, opts);
}

function EventChip({ e, subjects, onOpen, compact }: { e: CalEvent; subjects: Subject[]; onOpen: (e: CalEvent) => void; compact?: boolean }) {
  const subject = subjects.find((s) => s.id === e.subjectId);
  const c = getColor(subject?.color ?? "violet");
  // Classes are named by their subject ("Biology · Lecture"), not just "Class".
  const label = e.kind === "class" ? [subject?.name, e.title !== "Class" ? e.title : ""].filter(Boolean).join(" · ") || e.title : e.title;
  const style = e.kind === "exam"
    ? { background: "rgba(255,180,171,0.12)", borderColor: "#ffb4ab" }
    : e.kind === "block" ? { background: "rgba(124,58,237,0.18)", borderColor: c.dot }
    : { background: c.bg, borderColor: c.dot };
  return (
    <button
      data-testid={`cal-event-${e.kind}`}
      onClick={(ev) => { ev.stopPropagation(); onOpen(e); }}
      title={`${label}${e.start ? ` ${e.start}–${e.end}` : ""}`}
      className={`w-full text-left rounded-md border-l-2 px-1.5 ${compact ? "py-0.5" : "py-1"} text-[11px] leading-tight overflow-hidden ${e.done ? "opacity-50" : ""} ${e.kind === "task" ? "border-dashed" : ""}`}
      style={style}
    >
      <span className="flex items-center gap-1 text-on-surface">
        <span className="material-symbols-outlined text-[12px]">{e.done && e.kind !== "session" ? "check_circle" : KIND_ICON[e.kind]}</span>
        <span className="truncate font-semibold">{label}</span>
      </span>
      {!compact && e.start && <span className="block font-jetbrains text-on-surface-variant">{e.start}–{e.end}</span>}
    </button>
  );
}

function TimeGrid({ days, events, subjects, today, onOpen, onSlot }: {
  days: string[]; events: CalEvent[]; subjects: Subject[]; today: string;
  onOpen: (e: CalEvent) => void; onSlot: (date: string, hour: number) => void;
}) {
  const [first, last] = hourRange(events);
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass-card overflow-x-auto" data-testid="cal-timegrid">
      <div style={{ minWidth: days.length > 1 ? 640 : undefined }}>
        {/* Header + all-day row */}
        <div className="grid border-b border-outline-variant/50" style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => {
            const allDay = events.filter((e) => e.date === d && !e.start);
            return (
              <div key={d} className="px-1 py-2 border-l border-outline-variant/30 flex flex-col gap-1 min-w-0">
                <p className={`text-[11px] uppercase tracking-widest text-center ${d === today ? "text-primary font-bold" : "text-on-surface-variant"}`}>
                  {dayLabel(d, { weekday: "short" })} {Number(d.slice(8))}
                </p>
                {allDay.map((e) => <EventChip key={e.key} e={e} subjects={subjects} onOpen={onOpen} compact />)}
              </div>
            );
          })}
        </div>
        {/* Hours */}
        <div className="grid relative" style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }} className="text-[10px] text-on-surface-variant font-jetbrains text-right pr-1.5 relative -top-1.5">{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="relative border-l border-outline-variant/30" data-testid="cal-day-column" data-date={d}>
              {hours.map((h) => (
                <button
                  key={h}
                  data-testid="cal-slot"
                  data-hour={h}
                  aria-label={`Plan study time ${dayLabel(d, { weekday: "long" })} ${h}:00`}
                  onClick={() => onSlot(d, h)}
                  style={{ height: HOUR_PX }}
                  className="block w-full border-t border-outline-variant/20 hover:bg-primary/5"
                />
              ))}
              {d === today && nowMin !== null && nowMin >= first * 60 && nowMin <= last * 60 && (
                <div className="absolute left-0 right-0 border-t-2 border-error pointer-events-none" style={{ top: ((nowMin - first * 60) / 60) * HOUR_PX }} />
              )}
              {layoutDay(events.filter((e) => e.date === d)).map(({ event: e, column, columns }) => {
                const top = ((toMinutes(e.start!) - first * 60) / 60) * HOUR_PX;
                const height = Math.max(20, ((toMinutes(e.end!) - toMinutes(e.start!)) / 60) * HOUR_PX - 2);
                return (
                  <div key={e.key} className="absolute px-0.5" style={{ top, height, left: `${(column / columns) * 100}%`, width: `${100 / columns}%` }}>
                    <div className="h-full [&>button]:h-full"><EventChip e={e} subjects={subjects} onOpen={onOpen} compact={height < 40} /></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthView({ anchor, events, subjects, today, onOpen, onDay }: {
  anchor: string; events: CalEvent[]; subjects: Subject[]; today: string; onOpen: (e: CalEvent) => void; onDay: (d: string) => void;
}) {
  const days = monthGrid(anchor);
  const month = anchor.slice(0, 7);
  return (
    <div className="glass-card p-2" data-testid="cal-month">
      <div className="grid grid-cols-7 text-[11px] uppercase tracking-widest text-on-surface-variant text-center pb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-outline-variant/20">
        {days.map((d) => {
          const list = events.filter((e) => e.date === d);
          return (
            <div key={d} role="button" tabIndex={0} data-testid="cal-month-day" data-date={d}
              onClick={() => onDay(d)} onKeyDown={(e) => e.key === "Enter" && onDay(d)}
              className={`bg-[#12121a] min-h-[64px] sm:min-h-[96px] p-1 flex flex-col gap-0.5 cursor-pointer hover:bg-surface-container ${d.slice(0, 7) !== month ? "opacity-40" : ""}`}>
              <span className={`text-[11px] font-jetbrains self-end px-1 rounded ${d === today ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}>{Number(d.slice(8))}</span>
              <div className="hidden sm:flex flex-col gap-0.5">
                {list.slice(0, 3).map((e) => <EventChip key={e.key} e={e} subjects={subjects} onOpen={onOpen} compact />)}
                {list.length > 3 && <span className="text-[10px] text-on-surface-variant px-1">+{list.length - 3} more</span>}
              </div>
              {/* Phone: dots only */}
              <div className="flex sm:hidden flex-wrap gap-0.5 px-0.5">
                {list.slice(0, 6).map((e) => (
                  <span key={e.key} className="w-1.5 h-1.5 rounded-full" style={{ background: e.kind === "exam" ? "#ffb4ab" : getColor(subjects.find((s) => s.id === e.subjectId)?.color ?? "violet").dot }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const { items: subjects, uid } = useCollection<Subject>("subjects");
  const { items: classes } = useCollection<ClassItem>("classes");
  const { items: exams } = useCollection<Exam>("exams");
  const { items: tasks } = useCollection<Task>("tasks");
  const { items: blocks } = useCollection<StudyBlock>("studyBlocks");
  const { items: sessions } = useCollection<Session>("sessions");
  const { settings: timetable } = useTimetable();
  const today = localDateStr();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today);
  const [hidden, setHidden] = useState<Set<EventKind>>(new Set());
  const [blockEdit, setBlockEdit] = useState<{ block?: StudyBlock; initial?: { date: string; start: string; end: string } } | null>(null);
  const [examEdit, setExamEdit] = useState<Exam | null>(null);

  // Phones start in day view.
  useEffect(() => { if (window.innerWidth < 640) setView("day"); }, []);

  const days = view === "day" ? [anchor] : view === "week" ? weekDates(anchor) : monthGrid(anchor);
  const events = useMemo(
    () => buildEvents({ classes, timetable, exams, tasks, blocks, sessions }, days[0], days[days.length - 1]).filter((e) => !hidden.has(e.kind)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, timetable, exams, tasks, blocks, sessions, hidden, days[0], days[days.length - 1]]
  );

  const step = (dir: number) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, dir * 7));
    else {
      const d = new Date(anchor.slice(0, 8) + "15T12:00:00");
      d.setMonth(d.getMonth() + dir);
      setAnchor(localDateStr(d));
    }
  };

  const title = view === "month"
    ? dayLabel(anchor, { month: "long", year: "numeric" })
    : view === "week"
    ? `${dayLabel(days[0], { day: "numeric", month: "short" })} – ${dayLabel(days[6], { day: "numeric", month: "short", year: "numeric" })}`
    : dayLabel(anchor, { weekday: "long", day: "numeric", month: "long" });

  function open(e: CalEvent) {
    if (e.kind === "block") setBlockEdit({ block: blocks.find((b) => b.id === e.refId) });
    else if (e.kind === "exam") setExamEdit(exams.find((x) => x.id === e.refId) ?? null);
    else if (e.kind === "task") router.push("/tasks");
    else if (e.kind === "class") router.push("/timetable");
    else router.push("/sessions");
  }

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <button aria-label="Previous" data-testid="cal-prev" onClick={() => step(-1)} className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
        <button data-testid="cal-today" onClick={() => setAnchor(today)} className={secondaryBtnCls}>Today</button>
        <button aria-label="Next" data-testid="cal-next" onClick={() => step(1)} className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
        <h2 data-testid="cal-title" className="font-grotesk font-bold text-on-surface text-lg ml-1 mr-auto">{title}</h2>
        <div className="flex rounded-xl border border-outline-variant overflow-hidden" role="tablist" aria-label="Calendar view">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} data-testid={`cal-view-${v}`} onClick={() => setView(v)}
              className={`px-3 py-2 text-sm capitalize ${view === v ? "bg-primary/20 text-primary" : "text-on-surface-variant hover:text-on-surface"}`}>
              {v}
            </button>
          ))}
        </div>
        <button data-testid="cal-new-block" onClick={() => setBlockEdit({ initial: { date: anchor, start: "16:00", end: "17:00" } })}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm">
          <span className="material-symbols-outlined text-[18px]">add</span><span className="hidden sm:inline">Plan study</span>
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {KINDS.map((k) => (
          <button key={k.kind} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(k.kind)) n.delete(k.kind); else n.add(k.kind); return n; })}
            aria-pressed={!hidden.has(k.kind)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border ${hidden.has(k.kind) ? "border-outline-variant text-on-surface-variant/50 line-through" : "border-primary/40 text-on-surface"}`}>
            <span className="material-symbols-outlined text-[13px]">{k.icon}</span>{k.label}
          </button>
        ))}
      </div>

      {view === "month" ? (
        <MonthView anchor={anchor} events={events} subjects={subjects} today={today} onOpen={open} onDay={(d) => { setAnchor(d); setView("day"); }} />
      ) : (
        <TimeGrid days={days} events={events} subjects={subjects} today={today} onOpen={open}
          onSlot={(date, hour) => setBlockEdit({ initial: { date, start: minutesToHHMM(hour * 60), end: minutesToHHMM(Math.min(23 * 60 + 59, hour * 60 + 60)) } })} />
      )}

      {blockEdit && (
        <BlockModal uid={uid} subjects={subjects} tasks={tasks} block={blockEdit.block} initial={blockEdit.initial} onClose={() => setBlockEdit(null)} />
      )}
      {examEdit && <ExamModal uid={uid} subjects={subjects} exam={examEdit} onClose={() => setExamEdit(null)} />}
    </div>
  );
}
