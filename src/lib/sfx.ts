// Tiny WebAudio synth — no audio assets. Browsers gate audio behind the first
// user gesture (click/keydown; wheel does not count), so we resume the
// context on any of those and fail silently until then.

let ctx: AudioContext | null = null;
let enabled = localStorage.getItem('sfx') !== 'off';

export function sfxEnabled(): boolean {
  return enabled;
}

export function setSfxEnabled(on: boolean): void {
  enabled = on;
  localStorage.setItem('sfx', on ? 'on' : 'off');
  if (on) ensureContext();
}

function ensureContext(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx.state === 'running' ? ctx : null;
  } catch {
    return null;
  }
}

// Warm the context up on the first real gesture so later wheel-triggered
// sounds are allowed to play.
if (typeof window !== 'undefined') {
  const warm = () => ensureContext();
  window.addEventListener('pointerdown', warm, { passive: true });
  window.addEventListener('keydown', warm);
}

function tone(
  freq: number,
  delay: number,
  dur: number,
  type: OscillatorType = 'sine',
  gain = 0.1,
): void {
  const c = ensureContext();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + delay;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Skill pickup: a short bright ding. */
export function sfxPickup(): void {
  if (!enabled) return;
  tone(880, 0, 0.16, 'sine', 0.09);
  tone(1318.5, 0.03, 0.2, 'sine', 0.06);
}

/** Celebrate milestone: a small rising chime arpeggio. */
export function sfxCelebrate(): void {
  if (!enabled) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, i * 0.085, 0.32, 'triangle', 0.08),
  );
}
