import type { Topic } from "@/types";

/** Optional topic of a subject (topics come from Subjects → Topics and exams). */
export default function TopicSelect({ subjectId, topics, value, onChange, testId, className = "" }: {
  subjectId: string; topics: Topic[]; value: string; onChange: (topic: Topic | null) => void; testId?: string; className?: string;
}) {
  const list = topics.filter((t) => t.subjectId === subjectId).sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order);
  if (!subjectId) return null;
  if (list.length === 0) {
    return (
      <p className={`text-xs text-on-surface-variant ${className}`}>
        No topics for this subject yet. <a href={`/subjects/view?id=${subjectId}`} className="text-primary underline underline-offset-2">Add topics</a> to track time per topic.
      </p>
    );
  }
  return (
    <select
      data-testid={testId}
      aria-label="Topic"
      value={list.some((t) => t.id === value) ? value : ""}
      onChange={(e) => onChange(list.find((t) => t.id === e.target.value) ?? null)}
      className={`bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm w-full focus:outline-none focus:border-primary ${className}`}
    >
      <option value="">No specific topic</option>
      {list.map((t) => <option key={t.id} value={t.id}>{t.done ? `✓ ${t.title}` : t.title}</option>)}
    </select>
  );
}
