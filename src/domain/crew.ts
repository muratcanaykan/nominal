// Fictional crew and mission profiles used by the simulation.
// Glucose baselines come from real pre-flight measurements of the anonymised Inspiration4 crew (NASA OSDR OSD-575).

import osdr from '../data/osdr-inspiration4.json';

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
  location: string;
  /** Crew Medical Officer — receives level 2+ alerts. */
  cmo?: boolean;
  onEva?: boolean;
  /** Anonymised Inspiration4 crew member whose real measurements anchor this astronaut's baseline. */
  osdrSubject: OsdrSubject;
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
    location: 'Habitat module',
    osdrSubject: 'C002',
    baseline: { heartRate: 66, spo2: 98, systolic: 116, diastolic: 76, bodyTemp: 36.8, glucose: glucoseBaseline('C002'), sleep: 7.4 },
  },
  {
    id: '02',
    name: 'Daniel Okafor',
    callsign: 'OKAFOR',
    role: 'Mission Specialist',
    location: 'Spacewalk · Outside',
    onEva: true,
    osdrSubject: 'C001',
    baseline: { heartRate: 84, spo2: 97, systolic: 122, diastolic: 80, bodyTemp: 37.0, glucose: glucoseBaseline('C001'), sleep: 7.6 },
  },
  {
    id: '03',
    name: 'Elin Lindqvist',
    callsign: 'LINDQVIST',
    role: 'Pilot · Crew Medical Officer',
    location: 'Lab module',
    cmo: true,
    osdrSubject: 'C003',
    baseline: { heartRate: 62, spo2: 98, systolic: 112, diastolic: 72, bodyTemp: 36.7, glucose: glucoseBaseline('C003'), sleep: 7.8 },
  },
  {
    id: '04',
    name: 'Kenji Arai',
    callsign: 'ARAI',
    role: 'Mission Specialist',
    location: 'Airlock',
    osdrSubject: 'C004',
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
