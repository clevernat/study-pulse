"use client";

import { useEffect } from "react";
import { useAmbientStore, type TrackId } from "@/store/ambientStore";
import {
  startTrack,
  stopTrack,
  setTrackVolume,
  setMasterVolume,
  isPlaying,
} from "@/lib/ambientAudio";

// Bridges the Zustand store to the imperative ambient audio engine.
// Mounted once inside ClientShell. Subscribes to the store and reconciles
// the engine's playing tracks / volumes to match the store on every change.
export default function AmbientController() {
  const masterVolume = useAmbientStore((s) => s.masterVolume);
  const tracks = useAmbientStore((s) => s.tracks);

  // Reconcile track playback + per-track volume
  useEffect(() => {
    (Object.entries(tracks) as [TrackId, { playing: boolean; volume: number }][]).forEach(
      ([id, t]) => {
        const live = isPlaying(id);
        if (t.playing && !live) {
          startTrack(id, t.volume, masterVolume);
        } else if (!t.playing && live) {
          stopTrack(id);
        } else if (t.playing && live) {
          setTrackVolume(id, t.volume);
        }
      }
    );
  }, [tracks, masterVolume]);

  // Apply master volume to engine
  useEffect(() => {
    setMasterVolume(masterVolume);
  }, [masterVolume]);

  return null;
}
