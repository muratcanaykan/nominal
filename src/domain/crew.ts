// Fictional crew and mission profiles used by the simulation.
// Glucose baselines come from real pre-flight measurements of the anonymised Inspiration4 crew (NASA OSDR OSD-575).

import osdr from '../data/osdr-inspiration4.json';
import type { LocationId } from './locations';

export type OsdrSubject = keyof typeof osdr.subjects;

/**
 * Prototype assumption: continuous (CGM) readings across a day, meals included, sit above fasting lab values.
 * The simulated glucose baseline is the pre-flight fasting mean plus this offset.
 */
export const CGM_OFFSET_FROM_FASTING = 15;

const glucoseBaseline = (subject: OsdrSubject) => Math.round(osdr.subjects[subject].preflightMean + CGM_OFFSET_FROM_FASTING);

export type AstronautId = '01' | '02' | '03' | '04';

export interface Astronaut {
  id: AstronautId;
  name: string;
  callsign: string;
  role: string;
  /** Where the crew member is when the demo starts (the demo can move them; see locations.ts). */
  home: LocationId;
  /** Crew Medical Officer — receives level 2+ alerts and sees every crew member's details. */
  cmo?: boolean;
  /** Commander — sees each crew member's duty status, never health values. */
  commander?: boolean;
  /** Anonymised Inspiration4 crew member whose real measurements anchor this astronaut's baseline. */
  osdrSubject: OsdrSubject;
  /** Simulated body data for the energy estimate (see nutrition.ts). Sex selects the formula's coefficients. */
  body: { age: number; sex: 'female' | 'male'; heightCm: number; weightKg: number };
  baseline: {
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
    bodyTemp: number;
    glucose: number;
    sleep: number;
  };
}

export const CREW: Astronaut[] = [
  {
    id: '01',
    name: 'Mara Kaya',
    callsign: 'KAYA',
    role: 'Commander',
    home: 'habitat',
    commander: true,
    osdrSubject: 'C002',
    body: { age: 44, sex: 'female', heightCm: 168, weightKg: 62 },
    baseline: { heartRate: 66, spo2: 98, systolic: 116, diastolic: 76, bodyTemp: 36.8, glucose: glucoseBaseline('C002'), sleep: 7.4 },
  },
  {
    id: '02',
    name: 'Daniel Okafor',
    callsign: 'OKAFOR',
    role: 'Mission Specialist',
    home: 'eva',
    osdrSubject: 'C001',
    body: { age: 38, sex: 'male', heightCm: 182, weightKg: 84 },
    baseline: { heartRate: 84, spo2: 97, systolic: 122, diastolic: 80, bodyTemp: 37.0, glucose: glucoseBaseline('C001'), sleep: 7.6 },
  },
  {
    id: '03',
    name: 'Elin Lindqvist',
    callsign: 'LINDQVIST',
    role: 'Pilot · Crew Medical Officer',
    home: 'lab',
    cmo: true,
    osdrSubject: 'C003',
    body: { age: 41, sex: 'female', heightCm: 172, weightKg: 66 },
    baseline: { heartRate: 62, spo2: 98, systolic: 112, diastolic: 72, bodyTemp: 36.7, glucose: glucoseBaseline('C003'), sleep: 7.8 },
  },
  {
    id: '04',
    name: 'Kenji Arai',
    callsign: 'ARAI',
    role: 'Mission Specialist',
    home: 'airlock',
    osdrSubject: 'C004',
    body: { age: 35, sex: 'male', heightCm: 175, weightKg: 72 },
    baseline: { heartRate: 72, spo2: 98, systolic: 118, diastolic: 78, bodyTemp: 36.9, glucose: glucoseBaseline('C004'), sleep: 7.5 },
  },
];

export const OSDR_GLUCOSE = osdr;

export const CREW_BY_ID = Object.fromEntries(CREW.map((a) => [a.id, a])) as Record<AstronautId, Astronaut>;

export type ProfileId = 'leo' | 'lunar' | 'mars';

export interface MissionProfile {
  id: ProfileId;
  label: string;
  /** One-way signal delay to Earth in milliseconds. */
  earthDelayMs: number;
}

export const PROFILES: Record<ProfileId, MissionProfile> = {
  leo: { id: 'leo', label: 'Low Earth orbit station', earthDelayMs: 500 },
  lunar: { id: 'lunar', label: 'Lunar orbit outpost', earthDelayMs: 1300 },
  // Mars one-way delay varies between about 4 and 24 minutes; 12 minutes is used for the demo.
  mars: { id: 'mars', label: 'Mars surface base', earthDelayMs: 12 * 60 * 1000 },
};

/** The demo opens on mission day 12. */
export const MISSION_DAY_OFFSET_MS = (11 * 24 + 6) * 3600 * 1000 + 17 * 60 * 1000;
