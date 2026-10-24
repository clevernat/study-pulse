"use client";
import { useState } from "react";
import { useCollection } from "@/lib/firebase/useCollection";
import { useHabitContext } from "@/lib/firebase/useHabitContext";
import { localDateStr } from "@/lib/dateUtils";
import HabitModal from "@/components/planner/HabitModal";
import HabitRow from "@/components/planner/HabitRow";
import { EmptyState, primaryBtnCls } from "@/components/ui/Field";
import type { Habit } from "@/types";

export default function HabitsPage() {
  const { items: habits, uid } = useCollection<Habit>("habits");
  const ctx = useHabitContext();
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const today = localDateStr();
  const active = habits.filter((h) => !h.archived).sort((a, b) => a.createdAt - b.createdAt);
  const archived = habits.filter((h) => h.archived);

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant">{active.length} habit{active.length === 1 ? "" : "s"}</p>
        <button data-testid="habit-new" onClick={() => setEditing("new")} className={primaryBtnCls}><span className="material-symbols-outlined text-[18px]">add</span>New habit</button>
      </div>
      {active.length === 0 ? (
        <EmptyState icon="local_fire_department" title="No habits yet" text="Small things you want to do often: review cards, read 10 pages, study 60 minutes." />
      ) : active.map((h) => <HabitRow key={h.id} uid={uid} habit={h} today={today} ctx={ctx} onEdit={() => setEditing(h)} />)}
      {archived.length > 0 && (
        <>
          <button onClick={() => setShowArchived((v) => !v)} className="self-start text-sm text-on-surface-variant hover:text-on-surface">
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && archived.map((h) => <div key={h.id} className="opacity-60"><HabitRow uid={uid} habit={h} today={today} ctx={ctx} onEdit={() => setEditing(h)} /></div>)}
        </>
      )}
      {editing && <HabitModal uid={uid} habit={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
