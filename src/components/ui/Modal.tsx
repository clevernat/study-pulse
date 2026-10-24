"use client";
import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testId?: string;
  wide?: boolean;
}

/** Dark panel modal used by the planner and flashcard forms. Closes on Escape and backdrop click. */
export default function Modal({ title, onClose, children, testId, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-[#12121a] border border-[#252535] rounded-t-2xl sm:rounded-2xl w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92vh] flex flex-col shadow-2xl`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="font-grotesk font-bold text-xl text-on-surface">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
