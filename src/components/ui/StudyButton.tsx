"use client";
import Link from "next/link";
import { useTimerStore, formatTime } from "@/store/timerStore";

const base = "inline-flex items-center gap-1.5 rounded-xl font-bold hover:opacity-90 whitespace-nowrap";
const sizes = { md: "px-3.5 py-2 text-sm", sm: "px-2 py-1 text-xs" } as const;
const icon = (name: string, small: boolean) => (
  <span aria-hidden="true" className={`material-symbols-outlined ${small ? "text-[16px]" : "text-[18px]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>{name}</span>
);

/**
 * "Start studying" for a subject (and topic) that follows the real timer:
 * running on it → Pause with the time left, paused on it → Resume,
 * running on something else → shows what is running, idle → opens the Timer.
 */
export default function StudyButton({ subject, topic, testId, size = "md", label = "Start studying" }: {
  subject: { id: string; name: string };
  topic?: { id: string; title: string };
  testId?: string;
  size?: "md" | "sm";
  label?: string;
}) {
  const state = useTimerStore((s) => s.state);
  const mode = useTimerStore((s) => s.mode);
  const left = useTimerStore((s) => s.secondsRemaining);
  const subjectId = useTimerStore((s) => s.selectedSubjectId);
  const subjectName = useTimerStore((s) => s.selectedSubjectName);
  const topicId = useTimerStore((s) => s.selectedTopicId);
  const pause = useTimerStore((s) => s.pause);
  const start = useTimerStore((s) => s.start);
  const small = size === "sm";
  const cls = `${base} ${sizes[size]}`;

  const busy = state === "running" || state === "paused";
  const mine = subjectId === subject.id && (!topic || topicId === topic.id);
  const what = mode === "focus" ? "left" : "break";

  if (busy && mine) {
    const running = state === "running";
    return (
      <button type="button" data-testid={testId} data-timer={state} onClick={() => (running ? pause() : start())}
        aria-label={`${running ? "Pause" : "Resume"} timer, ${formatTime(left)} ${what}`}
        className={`${cls} ${running ? "bg-secondary/15 text-secondary border border-secondary/40" : "bg-tertiary/15 text-tertiary border border-tertiary/40"}`}>
        {icon(running ? "pause" : "play_arrow", small)}
        {running ? "Pause" : "Resume"}
        <span className="font-jetbrains font-semibold tabular-nums">{formatTime(left)}</span>
      </button>
    );
  }
  if (busy) {
    return (
      <Link href="/timer" data-testid={testId} data-timer="other" className={`${cls} border border-outline-variant text-on-surface-variant`}>
        {icon("timer", small)}<span className="truncate max-w-[10rem]">Timer on {subjectName}</span>
      </Link>
    );
  }
  const href = `/timer?subjectId=${encodeURIComponent(subject.id)}&subjectName=${encodeURIComponent(subject.name)}` +
    (topic ? `&topicId=${encodeURIComponent(topic.id)}&topicTitle=${encodeURIComponent(topic.title)}` : "");
  return (
    <Link href={href} data-testid={testId} data-timer="idle" aria-label={topic ? `${label}: ${topic.title}` : undefined}
      className={`${cls} ${small ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-primary-container text-on-primary-container"}`}>
      {icon("play_arrow", small)}{label}
    </Link>
  );
}
