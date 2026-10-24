"use client";
import { useEffect, useState } from "react";
import { useCollection } from "@/lib/firebase/useCollection";
import { useTimetable } from "@/lib/firebase/useTimetable";
import { classOccurrences, mondayOf, addDays, rotationWeekFor, WEEKDAYS, WEEK_LETTERS, holidayOn } from "@/lib/timetable";
import { localDateStr } from "@/lib/dateUtils";
import { getColor } from "@/lib/colorPalette";
import ClassModal from "@/components/planner/ClassModal";
import { Field, inputCls, primaryBtnCls, secondaryBtnCls, EmptyState } from "@/components/ui/Field";
import type { ClassItem, Subject, TimetableSettings } from "@/types";

function TermSettings({ settings, save }: { settings: TimetableSettings; save: (s: TimetableSettings) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  // Take new data from the server (other device, first load) only while the user is not editing.
  const key = settingsKey(settings);
  useEffect(() => {
    if (!dirty) setDraft(settings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dirty]);
  const [hName, setHName] = useState("");
  const [hStart, setHStart] = useState("");
  const [hEnd, setHEnd] = useState("");
  const set = (patch: Partial<TimetableSettings>) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); setSaved(false); };

  return (
    <div className="glass-card p-5 flex flex-col gap-4" data-testid="term-settings">
      <h2 className="font-grotesk font-bold text-lg text-on-surface">Term and weeks</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Term starts"><input type="date" className={inputCls} style={{ colorScheme: "dark" }} value={draft.termStart ?? ""} onChange={(e) => set({ termStart: e.target.value || undefined })} /></Field>
        <Field label="Term ends"><input type="date" className={inputCls} style={{ colorScheme: "dark" }} value={draft.termEnd ?? ""} onChange={(e) => set({ termEnd: e.target.value || undefined })} /></Field>
        <Field label="Week cycle">
          <select data-testid="rotation-weeks" className={inputCls} value={draft.rotationWeeks} onChange={(e) => set({ rotationWeeks: Number(e.target.value) })}>
            <option value={1}>Same every week</option>
            <option value={2}>2 weeks (A/B)</option>
            <option value={3}>3 weeks (A/B/C)</option>
            <option value={4}>4 weeks (A–D)</option>
          </select>
        </Field>
        {draft.rotationWeeks > 1 && (
          <Field label="A day in week A">
            <input data-testid="rotation-start" type="date" className={inputCls} style={{ colorScheme: "dark" }} value={draft.rotationStartDate ?? ""} onChange={(e) => set({ rotationStartDate: e.target.value || undefined })} />
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-on-surface-variant font-bold">Holidays (no classes)</span>
        {draft.holidays.map((h, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-on-surface">
            <span className="material-symbols-outlined text-[16px] text-tertiary">beach_access</span>
            <span className="flex-1">{h.name} · {h.start} → {h.end}</span>
            <button aria-label={`Remove ${h.name}`} onClick={() => set({ holidays: draft.holidays.filter((_, j) => j !== i) })} className="text-on-surface-variant/50 hover:text-error">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input data-testid="holiday-name" className={`${inputCls} !w-auto flex-1 min-w-[120px]`} placeholder="Name, e.g. Autumn break" value={hName} onChange={(e) => setHName(e.target.value)} />
          <input data-testid="holiday-start" aria-label="Holiday start" type="date" className={`${inputCls} !w-auto`} style={{ colorScheme: "dark" }} value={hStart} onChange={(e) => setHStart(e.target.value)} />
          <input data-testid="holiday-end" aria-label="Holiday end" type="date" className={`${inputCls} !w-auto`} style={{ colorScheme: "dark" }} value={hEnd} onChange={(e) => setHEnd(e.target.value)} />
          <button data-testid="holiday-add" type="button" className={secondaryBtnCls} disabled={!hName.trim() || !hStart}
            onClick={() => { set({ holidays: [...draft.holidays, { name: hName.trim(), start: hStart, end: hEnd && hEnd >= hStart ? hEnd : hStart }] }); setHName(""); setHStart(""); setHEnd(""); }}>
            Add
          </button>
        </div>
      </div>
      <button data-testid="term-save" className={`${primaryBtnCls} self-end`} onClick={async () => { await save(draft); setDirty(false); setSaved(true); }}>
        {saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}

// Stable identity of the saved settings (JSON.stringify is not stable: the
// server can return the fields in a different order).
function settingsKey(s: TimetableSettings): string {
  return [s.termStart, s.termEnd, s.rotationWeeks, s.rotationStartDate, ...s.holidays.map((h) => `${h.name}|${h.start}|${h.end}`)].join(";");
}

export default function TimetablePage() {
  const { items: classes, uid } = useCollection<ClassItem>("classes");
  const { items: subjects } = useCollection<Subject>("subjects");
  const { settings, save } = useTimetable();
  const [editing, setEditing] = useState<ClassItem | "new" | null>(null);
  const [weekStart, setWeekStart] = useState(mondayOf(localDateStr()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const occ = classOccurrences(classes, settings, days[0], days[6]);
  const week = rotationWeekFor(weekStart, settings);
  const today = localDateStr();

  return (
    <div className="max-w-5xl flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))} className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
          <button onClick={() => setWeekStart(mondayOf(today))} className={`${secondaryBtnCls} whitespace-nowrap`}>This week</button>
          <button aria-label="Next week" data-testid="tt-next" onClick={() => setWeekStart(addDays(weekStart, 7))} className={secondaryBtnCls}><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
          <span data-testid="tt-week-label" className="text-sm text-on-surface-variant ml-1 whitespace-nowrap">
            {new Date(weekStart + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            {settings.rotationWeeks > 1 && <> · <b className="text-primary">Week {WEEK_LETTERS[week - 1]}</b></>}
          </span>
        </div>
        <button data-testid="class-new" onClick={() => setEditing("new")} className={primaryBtnCls}>
          <span className="material-symbols-outlined text-[18px]">add</span>New class
        </button>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon="calendar_view_week" title="No classes yet" text={subjects.length === 0 ? "Add a subject first, then add its class times." : "Add your classes once. They repeat every week (or every A/B week)."} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2" data-testid="tt-week">
          {days.map((d) => {
            const list = occ.filter((o) => o.date === d);
            const holiday = holidayOn(d, settings.holidays);
            return (
              <div key={d} data-testid="tt-day" className={`rounded-xl border p-2 flex flex-col gap-2 md:min-h-[80px] ${d === today ? "border-primary/60" : "border-outline-variant/50"}`}>
                <p className="text-[11px] text-on-surface-variant">
                  {WEEKDAYS[new Date(d + "T12:00:00").getDay()].slice(0, 3)} {Number(d.slice(8))}
                </p>
                {holiday && <p className="text-[11px] text-tertiary">{holiday.name}</p>}
                {!holiday && list.length === 0 && <p className="md:hidden text-[11px] text-on-surface-variant/50">No classes</p>}
                {list.map((o, i) => {
                  const sub = subjects.find((s) => s.id === o.subjectId);
                  const c = getColor(sub?.color ?? "violet");
                  const cls = classes.find((x) => x.id === o.classId);
                  return (
                    <button key={i} data-testid="tt-class" onClick={() => cls && setEditing(cls)}
                      className="text-left rounded-lg px-2 py-1.5 text-[12px] border" style={{ background: c.bg, borderColor: `${c.dot}66` }}>
                      <span className="block font-jetbrains text-[11px] text-on-surface-variant">{o.start}–{o.end}</span>
                      <span className="block font-semibold text-on-surface truncate">{sub?.name ?? "Class"}{o.title ? ` · ${o.title}` : ""}</span>
                      {o.room && <span className="block text-on-surface-variant truncate">Room {o.room}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <TermSettings settings={settings} save={save} />

      {editing && (
        <ClassModal uid={uid} subjects={subjects} rotationWeeks={settings.rotationWeeks} item={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
