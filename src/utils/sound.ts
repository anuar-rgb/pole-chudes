import type { MediaUrl, SoundKey } from '@/types/game';

/**
 * Синтезированные звуки по умолчанию (Web Audio API) — работают без файлов.
 * Тема может подменить любой звук своим файлом (Theme.sounds).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

export function setMasterVolume(v: number) {
  const a = audio();
  if (a) a.out.gain.value = Math.max(0, Math.min(1, v));
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + start;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
/** Щелчок штырька о стрелку: короткий отфильтрованный шум + «тук» */
function tick(intensity = 1) {
  const a = audio();
  if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.ctx.createBuffer(1, Math.floor(a.ctx.sampleRate * 0.03), a.ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
  }
  const t0 = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200 + Math.random() * 600;
  bp.Q.value = 1.2;
  const g = a.ctx.createGain();
  g.gain.value = 0.5 * intensity;
  src.connect(bp).connect(g).connect(a.out);
  src.start(t0);
  tone(900, 0, 0.025, 'triangle', 0.08 * intensity);
}

const SYNTH: Record<SoundKey, (intensity?: number) => void> = {
  spinTick: tick,
  correct: () => {
    tone(660, 0, 0.12, 'triangle', 0.25);
    tone(880, 0.08, 0.12, 'triangle', 0.25);
    tone(1320, 0.16, 0.22, 'triangle', 0.22);
  },
  wrong: () => {
    tone(220, 0, 0.18, 'sawtooth', 0.15);
    tone(160, 0.16, 0.3, 'sawtooth', 0.15);
  },
  bankrupt: () => {
    tone(440, 0, 0.9, 'sawtooth', 0.18, 70);
    tone(330, 0.05, 0.9, 'square', 0.06, 55);
  },
  win: () => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, i === 5 ? 0.6 : 0.16, 'triangle', 0.25));
  },
  turn: () => tone(520, 0, 0.15, 'sine', 0.2, 780),
};

const fileCache = new Map<string, HTMLAudioElement>();

export function playSound(key: SoundKey, overrides?: Partial<Record<SoundKey, MediaUrl>>, intensity = 1) {
  const url = overrides?.[key];
  if (url) {
    let el = fileCache.get(url);
    if (!el) {
      el = new Audio(url);
      fileCache.set(url, el);
    }
    // клонируем, чтобы частые щелчки могли накладываться
    const inst = el.cloneNode(true) as HTMLAudioElement;
    inst.volume = Math.min(1, (master?.gain.value ?? 0.6) * intensity);
    void inst.play().catch(() => {});
    return;
  }
  SYNTH[key](intensity);
}
