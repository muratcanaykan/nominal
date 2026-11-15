// Alertness check: a short reaction-time test modelled on the psychomotor vigilance test (PVT) used to track fatigue
// in spaceflight research (Basner and Dinges, Sleep 2011; Basner et al., Aerospace Medicine and Human Performance 2015).
// A target appears after a random wait; the crew member taps as fast as possible. Standard PVT rules: a response
// slower than 500 ms is a lapse, a tap before the target (or faster than 100 ms) is a false start. The demo uses
// 6 targets instead of the 3-minute version; personal baselines and the rating limits are prototype values.

import type { AstronautId } from './crew';
import type { RoomState } from './room';

export const TRIALS = 6;
/** Random wait before each target. */
export const WAIT_MS: [number, number] = [1800, 4500];
export const LAPSE_MS = 500;
export const FALSE_START_MS = 100;

/** Personal median reaction time when rested (prototype values). */
export const REACTION_BASELINE_MS: Record<AstronautId, number> = { '01': 268, '02': 284, '03': 259, '04': 292 };

export type ReactionRating = 'alert' | 'slower' | 'tired';

export interface ReactionResult {
  at: number;
  /** Reaction times in milliseconds, one per target. */
  times: number[];
  falseStarts: number;
  medianMs: number;
  lapses: number;
  rating: ReactionRating;
}

export const RATING_LABELS: Record<ReactionRating, string> = { alert: 'Alert', slower: 'Slower than usual', tired: 'Signs of fatigue' };

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Scores a finished test against the crew member's own baseline. */
export function scoreReaction(id: AstronautId, times: number[], falseStarts: number, at: number): ReactionResult {
  const medianMs = median(times);
  const lapses = times.filter((t) => t > LAPSE_MS).length;
  const base = REACTION_BASELINE_MS[id];
  const rating: ReactionRating =
    lapses >= 2 || medianMs > base * 1.35 || falseStarts >= 3 ? 'tired' : lapses === 1 || medianMs > base * 1.15 || falseStarts === 2 ? 'slower' : 'alert';
  return { at, times, falseStarts, medianMs, lapses, rating };
}

/** What the result means, joined with last night's sleep when that was short. */
export function reactionAdvice(r: ReactionResult, sleepHours: number | null): string {
  if (r.rating === 'alert') return 'Your reactions are at your usual level.';
  const sleep = sleepHours !== null && sleepHours < 6.5 ? ` You slept ${sleepHours.toFixed(1)} h last night.` : '';
  if (r.rating === 'slower') return `A little slower than usual.${sleep} Take a short break and repeat the test before precise work.`;
  return `Clearly slower than usual.${sleep} Avoid critical tasks such as a spacewalk or robotic arm work until you have rested, and tell the medical officer.`;
}

export const latestReaction = (state: RoomState | null | undefined, id: AstronautId) => state?.reactions?.[id];

/** "284 ms median · 0 lapses · usual 268 ms" */
export const reactionSummary = (r: ReactionResult, id: AstronautId) =>
  `${r.medianMs} ms median · ${r.lapses} ${r.lapses === 1 ? 'lapse' : 'lapses'}${
    r.falseStarts ? ` · ${r.falseStarts} early ${r.falseStarts === 1 ? 'tap' : 'taps'}` : ''
  } · usual ${REACTION_BASELINE_MS[id]} ms`;
