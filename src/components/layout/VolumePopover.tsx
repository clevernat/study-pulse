"use client";

import { useAmbientStore } from "@/store/ambientStore";

export default function VolumePopover({ onClose }: { onClose: () => void }) {
  const masterVolume = useAmbientStore((s) => s.masterVolume);
  const setMasterVolume = useAmbientStore((s) => s.setMasterVolume);
  const pct = Math.round(masterVolume * 100);

  return (
    <div className="fixed left-4 right-4 top-[72px] z-50 sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[260px] glass-card p-4 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-grotesk font-bold text-sm text-on-surface">Master volume</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMasterVolume(masterVolume === 0 ? 0.7 : 0)}
          className="text-on-surface-variant hover:text-primary transition-colors flex-shrink-0"
          aria-label={masterVolume === 0 ? "Unmute" : "Mute"}
        >
          <span className="material-symbols-outlined text-[22px]">
            {masterVolume === 0 ? "volume_off" : masterVolume < 0.5 ? "volume_down" : "volume_up"}
          </span>
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="font-jetbrains text-xs text-on-surface w-9 text-right">{pct}%</span>
      </div>

      <p className="text-[11px] text-on-surface-variant mt-3 leading-relaxed">
        Controls relaxation sounds and timer chime volume.
      </p>
    </div>
  );
}
