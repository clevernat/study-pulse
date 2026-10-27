"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { addItem } from "@/lib/firebase/firestore";
import type { Topic } from "@/types";

const NEW_TOPIC = "__new_topic";
const field = "bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm w-full focus:outline-none focus:border-primary";

/** Topic of a subject: pick one, or type a new one right here (it is saved under the subject). */
export default function TopicSelect({ subjectId, topics, value, onChange, testId = "topic", className = "" }: {
  subjectId: string; topics: Topic[]; value: string; onChange: (topic: Topic | null) => void; testId?: string; className?: string;
}) {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const list = topics.filter((t) => t.subjectId === subjectId).sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);
  if (!subjectId) return null;

  async function add() {
    const t = title.trim().slice(0, 200);
    if (!t || !user) return;
    const topic: Omit<Topic, "id"> = { subjectId, title: t, done: false, order: list.length ? Math.max(...list.map((x) => x.order)) + 1 : 0, createdAt: Date.now() };
    const id = await addItem<Topic>(user.uid, "topics", topic);
    setTitle("");
    setAdding(false);
    onChange({ id, ...topic });
  }

  const input = (
    <div className="flex gap-2">
      <input data-testid={`${testId}-new-input`} aria-label="New topic" autoFocus={list.length > 0} value={title} maxLength={200}
        placeholder="What are you studying? e.g. Subnetting"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape" && list.length) setAdding(false); }}
        className={`${field} flex-1 min-w-0`} />
      <button type="button" data-testid={`${testId}-new-add`} onClick={add} disabled={!title.trim()}
        className="px-3.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-bold disabled:opacity-50">Add</button>
    </div>
  );

  if (list.length === 0) return <div className={className}>{input}</div>;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <select
        data-testid={testId}
        aria-label="Topic"
        value={list.some((t) => t.id === value) ? value : ""}
        onChange={(e) => { if (e.target.value === NEW_TOPIC) { setAdding(true); return; } onChange(list.find((t) => t.id === e.target.value) ?? null); }}
        className={field}
      >
        <option value="">No specific topic</option>
        {list.map((t) => <option key={t.id} value={t.id}>{t.done ? `✓ ${t.title}` : t.title}</option>)}
        <option value={NEW_TOPIC}>+ New topic…</option>
      </select>
      {adding && input}
    </div>
  );
}
