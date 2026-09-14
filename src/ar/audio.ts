/** Sintetizador minimalista (sin assets) para los FX del juego */
type Kind = "capture" | "star" | "penalty" | "miss" | "count" | "start" | "over" | "blip";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setAudioEnabled(v: boolean) {
  enabled = v;
  if (master) master.gain.value = v ? 0.5 : 0;
}

export function isAudioEnabled() {
  return enabled;
}

export function unlockAudio() {
  ac();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
  const c = ac();
  if (!c || !master || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol: number, delay = 0) {
  const c = ac();
  if (!c || !master || !enabled) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

export function sfx(kind: Kind) {
  switch (kind) {
    case "capture":
      tone(660, 0.1, "square", 0.16);
      tone(990, 0.14, "triangle", 0.13, 0.06);
      noise(0.12, 0.08);
      break;
    case "star":
      tone(880, 0.09, "square", 0.15);
      tone(1174, 0.09, "square", 0.14, 0.07);
      tone(1568, 0.16, "triangle", 0.14, 0.14);
      break;
    case "penalty":
      tone(180, 0.28, "sawtooth", 0.2, 0, 60);
      noise(0.25, 0.14);
      break;
    case "miss":
      tone(300, 0.12, "sine", 0.09, 0, 160);
      break;
    case "count":
      tone(520, 0.09, "square", 0.12);
      break;
    case "start":
      tone(523, 0.1, "square", 0.14);
      tone(659, 0.1, "square", 0.14, 0.09);
      tone(880, 0.2, "triangle", 0.16, 0.18);
      break;
    case "over":
      tone(440, 0.18, "triangle", 0.16);
      tone(330, 0.2, "triangle", 0.15, 0.16);
      tone(220, 0.4, "sine", 0.16, 0.32);
      break;
    case "blip":
      tone(1400, 0.04, "square", 0.05);
      break;
  }
}

export function vibrate(ms: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* noop */
  }
}
