"use client";

import { useAmbientStore, TRACK_META, type TrackId } from "@/store/ambientStore";

export default function SoundsPopover({ onClose }: { onClose: () => void }) {
  const tracks = useAmbientStore((s) => s.tracks);
  const toggleTrack = useAmbientStore((s) => s.toggleTrack);
  const setTrackVolume = useAmbientStore((s) => s.setTrackVolume);
  const stopAll = useAmbientStore((s) => s.stopAll);
  const masterVolume = useAmbientStore((s) => s.masterVolume);
  const setMasterVolume = useAmbientStore((s) => s.setMasterVolume);

  const anyPlaying = Object.values(tracks).some((t) => t.playing);

  return (
    <div className="fixed left-4 right-4 top-[72px] z-50 max-h-[calc(100vh-88px)] overflow-y-auto sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:max-h-none sm:overflow-visible sm:w-[320px] glass-card p-4 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-grotesk font-bold text-sm text-on-surface">Relaxation sounds</h3>
        <div className="flex items-center gap-2">
          {anyPlaying && (
            <button
              type="button"
              onClick={stopAll}
              className="text-[11px] text-on-surface-variant hover:text-error transition-colors"
            >
              Stop all
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {(Object.keys(TRACK_META) as TrackId[]).map((id) => {
          const meta = TRACK_META[id];
          const t = tracks[id];
          return (
            <div
              key={id}
              className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                t.playing ? "border-primary/40 bg-primary/5" : "border-outline-variant"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleTrack(id)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                  t.playing
                    ? "bg-primary-container text-on-primary-container"
                    : "border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary"
                }`}
                aria-label={t.playing ? `Stop ${meta.label}` : `Play ${meta.label}`}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {t.playing ? "pause" : "play_arrow"}
                </span>
              </button>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-inter font-semibold text-on-surface">{meta.label}</div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={t.volume}
                  onChange={(e) => setTrackVolume(id, parseFloat(e.target.value))}
                  className="w-full accent-primary mt-1"
                  disabled={!t.playing}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Master volume: sounds and the timer chime */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-outline-variant">
        <button
          type="button"
          onClick={() => setMasterVolume(masterVolume === 0 ? 0.7 : 0)}
          className="text-on-surface-variant hover:text-primary transition-colors flex-shrink-0"
          aria-label={masterVolume === 0 ? "Unmute" : "Mute"}
        >
          <span className="material-symbols-outlined text-[20px]">
            {masterVolume === 0 ? "volume_off" : masterVolume < 0.5 ? "volume_down" : "volume_up"}
          </span>
        </button>
        <input
          type="range" min={0} max={1} step={0.01} value={masterVolume}
          onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
          className="flex-1 accent-primary"
          aria-label="Master volume (sounds and timer chime)"
        />
        <span className="font-jetbrains text-xs text-on-surface-variant w-9 text-right tabular-nums">{Math.round(masterVolume * 100)}%</span>
      </div>
    </div>
  );
}
