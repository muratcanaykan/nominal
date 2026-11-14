// Alert sound for critical crew alerts: three short tones made with Web Audio (no audio files). Browsers only allow
// sound after the person has interacted with the page, so the audio starts on the first click or key press.

let ctx: AudioContext | null = null;
let armed = false;

function unlock() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/** Prepares the audio on the page's first interaction. Safe to call many times. */
export function armAlarm() {
  if (armed) return;
  armed = true;
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

/** Three falling two-tone beeps, about one second. Silent until the page has been interacted with. */
export function playAlarm() {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const at = t0 + i * 0.3;
    for (const [freq, start, len] of [
      [988, 0, 0.12],
      [740, 0.13, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, at + start);
      gain.gain.linearRampToValueAtTime(0.16, at + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, at + start + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at + start);
      osc.stop(at + start + len + 0.02);
    }
  }
}

const SOUND_KEY = 'nominal:sound';

export function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable */
  }
}
