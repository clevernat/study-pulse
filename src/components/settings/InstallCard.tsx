"use client";
import { useEffect, useState } from "react";
import { isInstalled, isIos } from "@/lib/pwa";

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** "Install the app" help: a button on Chrome/Edge/Android, steps on iPhone/iPad and Safari. */
export default function InstallCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isInstalled());
    setIos(isIos());
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  return (
    <section className="glass-card p-6 flex flex-col gap-3" data-testid="install-card">
      <h2 className="font-space font-semibold text-[#e8e8f0]">Install the app</h2>
      {installed ? (
        <p data-testid="install-status" className="text-sm text-secondary">StudyPulse is installed on this device.</p>
      ) : prompt ? (
        <>
          <p className="text-sm text-on-surface-variant">Add StudyPulse to this device. It opens in its own window and works offline.</p>
          <button data-testid="install-button" onClick={async () => { await prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === "accepted") setInstalled(true); setPrompt(null); }}
            className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm">
            <span className="material-symbols-outlined text-[18px]">install_desktop</span>Install StudyPulse
          </button>
        </>
      ) : ios ? (
        <ol data-testid="install-steps" className="text-sm text-on-surface-variant list-decimal pl-5 space-y-1">
          <li>Open this site in <b className="text-on-surface">Safari</b>.</li>
          <li>Tap the <b className="text-on-surface">Share</b> button (square with an arrow).</li>
          <li>Tap <b className="text-on-surface">Add to Home Screen</b>, then <b className="text-on-surface">Add</b>.</li>
          <li>Open StudyPulse from the new icon. Reminders on iPhone only work from this icon.</li>
        </ol>
      ) : (
        <ul data-testid="install-steps" className="text-sm text-on-surface-variant list-disc pl-5 space-y-1">
          <li><b className="text-on-surface">Chrome or Edge (laptop):</b> click the install icon at the right end of the address bar.</li>
          <li><b className="text-on-surface">Safari (Mac):</b> File → Add to Dock.</li>
          <li><b className="text-on-surface">Android:</b> browser menu ⋮ → Install app.</li>
        </ul>
      )}
    </section>
  );
}
