// Personal radiation dosimeter (simulated): dose rate now and dose received this mission.
// Base rates by mission location come from published measurements; the spacewalk and solar particle event factors
// are prototype assumptions.
//   - Low Earth orbit: about 0.5 mSv per day, the middle of typical space station crew doses (0.3–0.8 mSv/day).
//   - Deep space (lunar orbit): 1.84 mSv per day, measured in transit to Mars (Zeitlin et al., Science, 2013).
//   - Mars surface: 0.64 mSv per day, measured on the surface (Hassler et al., Science, 2014).
// Career limit: 600 mSv effective dose (NASA-STD-3001 Volume 1).

import { MISSION_DAY_OFFSET_MS, type AstronautId, type ProfileId } from './crew';
import { isEva } from './locations';
import type { RoomState } from './room';

export const DAILY_DOSE_MSV: Record<ProfileId, number> = { leo: 0.5, lunar: 1.84, mars: 0.64 };
export const CAREER_LIMIT_MSV = 600;

/** Less shielding in a spacesuit than inside the vehicle (prototype assumption). */
const EVA_FACTOR = 2;
/** Solar particle event: dose rate inside the vehicle and on a spacewalk (prototype assumptions). */
const SPE_FACTOR_INSIDE = 15;
const SPE_FACTOR_EVA = 40;

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type DoseStatus = 'normal' | 'elevated' | 'high';

export interface Dose {
  /** Dose rate now, in microsieverts per hour. */
  rateUsvH: number;
  status: DoseStatus;
  /** What raises the rate now. */
  reasons: string[];
  /** Dose received this mission, in millisieverts. */
  missionMsv: number;
  /** Share of the career limit used so far. */
  careerShare: number;
}

/**
 * `sepSince`: start of an active solar particle event (NASA DONKI or simulated), or null. Mission dose adds the
 * mission days before the demo at the base rate, the demo time at the base rate, and the extra dose of an active solar
 * particle event.
 */
export function dose(state: RoomState | undefined, id: AstronautId, now: number, sepSince: number | null): Dose {
  const profile = state?.profile ?? 'lunar';
  const baseH = (DAILY_DOSE_MSV[profile] * 1000) / 24;
  const eva = isEva(state, id);
  const spe = sepSince !== null && sepSince <= now;
  let factor = eva ? EVA_FACTOR : 1;
  const reasons: string[] = [];
  if (eva) reasons.push('Spacewalk: less shielding than inside the vehicle');
  if (spe) {
    factor *= eva ? SPE_FACTOR_EVA / EVA_FACTOR : SPE_FACTOR_INSIDE;
    reasons.push('Solar particle event');
  }
  const rateUsvH = baseH * factor;
  const createdAt = state?.createdAt ?? now;
  const before = (MISSION_DAY_OFFSET_MS / DAY) * DAILY_DOSE_MSV[profile];
  const demo = ((now - createdAt) / HOUR) * (baseH / 1000);
  const speExtra = spe ? ((now - Math.max(sepSince!, createdAt)) / HOUR) * ((baseH * (SPE_FACTOR_INSIDE - 1)) / 1000) : 0;
  const missionMsv = before + Math.max(0, demo) + Math.max(0, speExtra);
  return {
    rateUsvH,
    status: spe ? 'high' : eva ? 'elevated' : 'normal',
    reasons,
    missionMsv,
    careerShare: missionMsv / CAREER_LIMIT_MSV,
  };
}
