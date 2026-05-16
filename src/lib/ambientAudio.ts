// Procedural ambient sound engine — pure Web Audio, no audio files.
// One AudioContext shared across all tracks. Each track owns a chain of nodes
// terminating at its own GainNode → master GainNode → destination.
// Volume changes are smooth; play/stop tears down / rebuilds the source nodes.

import type { TrackId } from "@/store/ambientStore";

interface TrackHandle {
  gain: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  // For tracks that schedule periodic events (fireplace crackles)
  intervalId?: ReturnType<typeof setInterval>;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const handles = new Map<TrackId, TrackHandle>();

function getCtx(): AudioContext {
  if (!ctx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
  }
  // Browsers suspend the context until a user gesture; resume on demand.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

// ── Noise buffer generators (cached per ctx lifetime) ────────────────────────

let cachedWhite: AudioBuffer | null = null;
let cachedPink: AudioBuffer | null = null;
let cachedBrown: AudioBuffer | null = null;

function makeWhiteBuffer(c: AudioContext): AudioBuffer {
  if (cachedWhite) return cachedWhite;
  const len = c.sampleRate * 2; // 2 seconds, looped
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  cachedWhite = buf;
  return buf;
}

function makePinkBuffer(c: AudioContext): AudioBuffer {
  if (cachedPink) return cachedPink;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // Paul Kellet's pink-noise approximation
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  cachedPink = buf;
  return buf;
}

function makeBrownBuffer(c: AudioContext): AudioBuffer {
  if (cachedBrown) return cachedBrown;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    data[i] = last * 3.5;
  }
  cachedBrown = buf;
  return buf;
}

function makeLoopSource(c: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

// ── Per-track builders ───────────────────────────────────────────────────────

function buildPlainNoise(c: AudioContext, kind: "white" | "pink" | "brown"): TrackHandle {
  const buf = kind === "white" ? makeWhiteBuffer(c) : kind === "pink" ? makePinkBuffer(c) : makeBrownBuffer(c);
  const src = makeLoopSource(c, buf);
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(gain);
  src.start();
  return { gain, nodes: [], sources: [src] };
}

function buildRain(c: AudioContext): TrackHandle {
  // Pink noise → high-shelf boost (treble = pitter-patter) → slow random AM.
  const src = makeLoopSource(c, makePinkBuffer(c));
  const shelf = c.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 1200;
  shelf.gain.value = 6;
  const amp = c.createGain();
  amp.gain.value = 1;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(shelf).connect(amp).connect(gain);

  // Light random AM via LFO buffer
  const lfo = c.createBufferSource();
  const lfoLen = c.sampleRate * 4;
  const lfoBuf = c.createBuffer(1, lfoLen, c.sampleRate);
  const lfoData = lfoBuf.getChannelData(0);
  for (let i = 0; i < lfoLen; i++) {
    lfoData[i] = 0.85 + Math.random() * 0.3; // 0.85..1.15
  }
  lfo.buffer = lfoBuf;
  lfo.loop = true;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain).connect(amp.gain);
  lfo.start();

  src.start();
  return { gain, nodes: [shelf, amp, lfoGain], sources: [src, lfo] };
}

function buildOcean(c: AudioContext): TrackHandle {
  // Brown noise → band-pass with slow LFO sweep = wave wash.
  const src = makeLoopSource(c, makeBrownBuffer(c));
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 400;
  bp.Q.value = 0.7;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(bp).connect(gain);

  // LFO at ~0.1 Hz sweeping freq between 200 and 800
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.1;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(bp.frequency);
  lfo.start();

  src.start();
  return { gain, nodes: [bp, lfoGain], sources: [src, lfo] };
}

function buildWind(c: AudioContext): TrackHandle {
  // Pink noise → band-pass ~400 Hz with broader LFO sweep.
  const src = makeLoopSource(c, makePinkBuffer(c));
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 500;
  bp.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(bp).connect(gain);

  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.25;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 250;
  lfo.connect(lfoGain).connect(bp.frequency);
  lfo.start();

  src.start();
  return { gain, nodes: [bp, lfoGain], sources: [src, lfo] };
}

function buildFireplace(c: AudioContext): TrackHandle {
  // Brown noise low rumble + scheduled crackles.
  const src = makeLoopSource(c, makeBrownBuffer(c));
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 300;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(lp).connect(gain);
  src.start();

  // Crackles: short filtered-noise bursts at random intervals
  const intervalId = setInterval(() => {
    if (!ctx) return;
    const now = ctx.currentTime;
    const burst = c.createBufferSource();
    const bLen = Math.floor(c.sampleRate * 0.04);
    const bBuf = c.createBuffer(1, bLen, c.sampleRate);
    const bData = bBuf.getChannelData(0);
    for (let i = 0; i < bLen; i++) bData[i] = (Math.random() * 2 - 1) * (1 - i / bLen);
    burst.buffer = bBuf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2000 + Math.random() * 2000;
    bp.Q.value = 1.5;
    const bGain = c.createGain();
    bGain.gain.value = 0.4 + Math.random() * 0.3;
    burst.connect(bp).connect(bGain).connect(gain);
    burst.start(now);
    burst.stop(now + 0.05);
  }, 350);

  return { gain, nodes: [lp], sources: [src], intervalId };
}

// ── Public API ───────────────────────────────────────────────────────────────

export function startTrack(id: TrackId, volume: number, masterVolume: number) {
  if (typeof window === "undefined") return;
  if (handles.has(id)) return; // already playing
  const c = getCtx();
  if (!masterGain) return;

  let h: TrackHandle;
  switch (id) {
    case "rain":      h = buildRain(c); break;
    case "ocean":     h = buildOcean(c); break;
    case "wind":      h = buildWind(c); break;
    case "fireplace": h = buildFireplace(c); break;
    case "white":     h = buildPlainNoise(c, "white"); break;
    case "pink":      h = buildPlainNoise(c, "pink"); break;
    case "brown":     h = buildPlainNoise(c, "brown"); break;
  }

  h.gain.connect(masterGain);
  masterGain.gain.value = masterVolume;
  // Smooth fade-in
  h.gain.gain.setValueAtTime(0, c.currentTime);
  h.gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.3);
  handles.set(id, h);
}

export function stopTrack(id: TrackId) {
  const h = handles.get(id);
  if (!h || !ctx) return;
  const t = ctx.currentTime;
  h.gain.gain.cancelScheduledValues(t);
  h.gain.gain.setValueAtTime(h.gain.gain.value, t);
  h.gain.gain.linearRampToValueAtTime(0, t + 0.2);
  setTimeout(() => {
    h.sources.forEach((s) => {
      try { s.stop(); } catch { /* already stopped */ }
    });
    if (h.intervalId) clearInterval(h.intervalId);
    try { h.gain.disconnect(); } catch { /* ignore */ }
    handles.delete(id);
  }, 250);
}

export function setTrackVolume(id: TrackId, volume: number) {
  const h = handles.get(id);
  if (!h || !ctx) return;
  const t = ctx.currentTime;
  h.gain.gain.cancelScheduledValues(t);
  h.gain.gain.setValueAtTime(h.gain.gain.value, t);
  h.gain.gain.linearRampToValueAtTime(volume, t + 0.05);
}

export function setMasterVolume(v: number) {
  if (!masterGain || !ctx) return;
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(v, t + 0.05);
}

export function isPlaying(id: TrackId): boolean {
  return handles.has(id);
}
