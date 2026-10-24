// Shared form styles so new forms match the existing ones.
export const inputCls =
  "w-full bg-[#0e0e11] border border-outline-variant rounded-xl px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/40";

export const primaryBtnCls =
  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold font-inter text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50";

export const secondaryBtnCls =
  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant hover:text-on-surface transition-all font-inter text-sm font-semibold";

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs text-on-surface-variant font-bold">{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="glass-card p-10 flex flex-col items-center gap-3 text-center">
      <span className="material-symbols-outlined text-4xl text-on-surface-variant">{icon}</span>
      <p className="text-on-surface font-grotesk font-bold">{title}</p>
      {text && <p className="text-sm text-on-surface-variant">{text}</p>}
      {children}
    </div>
  );
}

/** Reminder choices shared by tasks, exams, classes and study blocks. */
export const REMINDER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No reminder" },
  { value: "0", label: "At start time" },
  { value: "10", label: "10 min before" },
  { value: "30", label: "30 min before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];
