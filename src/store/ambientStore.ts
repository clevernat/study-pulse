"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type TrackId = "rain" | "ocean" | "wind" | "fireplace" | "pink" | "brown" | "white";

export const TRACK_META: Record<TrackId, { label: string; icon: string }> = {
  rain:      { label: "Rain",         icon: "rainy" },
  ocean:     { label: "Ocean",        icon: "waves" },
  wind:      { label: "Wind",         icon: "air" },
  fireplace: { label: "Fireplace",    icon: "fireplace" },
  pink:      { label: "Pink noise",   icon: "graphic_eq" },
  brown:     { label: "Brown noise",  icon: "equalizer" },
  white:     { label: "White noise",  icon: "blur_on" },
};

interface TrackState {
  playing: boolean;
  volume: number; // 0..1
}

interface AmbientStore {
  masterVolume: number; // 0..1
  tracks: Record<TrackId, TrackState>;
  setMasterVolume: (v: number) => void;
  setTrackVolume: (id: TrackId, v: number) => void;
  toggleTrack: (id: TrackId) => void;
  stopAll: () => void;
}

function defaultTracks(): Record<TrackId, TrackState> {
  return {
    rain:      { playing: false, volume: 0.6 },
    ocean:     { playing: false, volume: 0.6 },
    wind:      { playing: false, volume: 0.5 },
    fireplace: { playing: false, volume: 0.6 },
    pink:      { playing: false, volume: 0.4 },
    brown:     { playing: false, volume: 0.4 },
    white:     { playing: false, volume: 0.3 },
  };
}

export const useAmbientStore = create<AmbientStore>()(
  persist(
    (set, get) => ({
      masterVolume: 0.7,
      tracks: defaultTracks(),
      setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(1, v)) }),
      setTrackVolume: (id, v) => {
        const t = get().tracks;
        set({ tracks: { ...t, [id]: { ...t[id], volume: Math.max(0, Math.min(1, v)) } } });
      },
      toggleTrack: (id) => {
        const t = get().tracks;
        set({ tracks: { ...t, [id]: { ...t[id], playing: !t[id].playing } } });
      },
      stopAll: () => {
        const t = get().tracks;
        const next: Record<TrackId, TrackState> = { ...t };
        (Object.keys(next) as TrackId[]).forEach((k) => {
          next[k] = { ...next[k], playing: false };
        });
        set({ tracks: next });
      },
    }),
    {
      name: "studypulse-ambient",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
    }
  )
);
