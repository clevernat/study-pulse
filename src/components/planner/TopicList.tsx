"use client";
import { useState } from "react";
import { addItem, updateItem, deleteItem } from "@/lib/firebase/firestore";
import { inputCls } from "@/components/ui/Field";
import { topicProgress } from "@/lib/exams";
import type { Exam, Topic } from "@/types";

interface Props { uid: string; subjectId: string; topics: Topic[]; exams: Exam[]; barColor: string }

/** Topics of one subject: add, check off, link to an exam, delete. */
export default function TopicList({ uid, subjectId, topics, exams, barColor }: Props) {
  const [title, setTitle] = useState("");
  const list = topics.filter((t) => t.subjectId === subjectId).sort((a, b) => a.order - b.order);
  const prog = topicProgress(topics, subjectId);
  const subjectExams = exams.filter((e) => e.subjectId === subjectId);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const lines = title.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setTitle("");
    const start = list.length ? Math.max(...list.map((t) => t.order)) + 1 : 0;
    await Promise.all(lines.map((line, i) =>
      addItem<Topic>(uid, "topics", { subjectId, title: line.slice(0, 200), done: false, order: start + i, createdAt: Date.now() })));
  }

  return (
    <div className="glass-card p-5 flex flex-col gap-4" data-testid="topic-list">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-grotesk font-bold text-lg text-on-surface">Topics</h2>
        <span data-testid="topic-progress" className="text-sm font-jetbrains text-on-surface-variant">{prog.done}/{prog.total} · {prog.pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#1a1a24] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, background: barColor }} /></div>

      <form onSubmit={add} className="flex gap-2">
        <input data-testid="topic-input" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a topic, e.g. Cell division" maxLength={200} />
        <button data-testid="topic-add" type="submit" className="px-4 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm" aria-label="Add topic">
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No topics yet. Add the chapters or units you need to learn, then check them off.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant/40">
          {list.map((t) => (
            <li key={t.id} data-testid="topic-item" className="flex items-center gap-3 py-2">
              <button
                data-testid="topic-check"
                onClick={() => updateItem<Topic>(uid, "topics", t.id, { done: !t.done })}
                aria-label={t.done ? `Uncheck ${t.title}` : `Check ${t.title}`}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${t.done ? "bg-primary border-primary" : "border-outline-variant hover:border-primary"}`}
              >
                {t.done && <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>}
              </button>
              <span className={`flex-1 min-w-0 text-sm ${t.done ? "line-through text-on-surface-variant" : "text-on-surface"}`}>{t.title}</span>
              {subjectExams.length > 0 && (
                <select
                  aria-label="Exam for this topic"
                  value={t.examId ?? ""}
                  onChange={(e) => updateItem<Topic>(uid, "topics", t.id, { examId: e.target.value || undefined })}
                  className="max-w-[40%] bg-transparent border border-outline-variant/60 rounded-lg px-2 py-1 text-[11px] text-on-surface-variant"
                >
                  <option value="">No exam</option>
                  {subjectExams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              )}
              <button onClick={() => deleteItem(uid, "topics", t.id)} aria-label={`Delete ${t.title}`} className="text-on-surface-variant/40 hover:text-error p-1">
                <span className="material-symbols-outlined text-[18px]">delete_outline</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
