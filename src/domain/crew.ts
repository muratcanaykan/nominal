// Fictional crew and mission profiles used by the simulation.

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
    baseline: { heartRate: 66, spo2: 98, systolic: 116, diastolic: 76, bodyTemp: 36.8, glucose: 104, sleep: 7.4 },
  },
  {
    id: '02',
    name: 'Daniel Okafor',
    callsign: 'OKAFOR',
    role: 'Mission Specialist',
    location: 'Spacewalk · Outside',
    onEva: true,
    baseline: { heartRate: 84, spo2: 97, systolic: 122, diastolic: 80, bodyTemp: 37.0, glucose: 96, sleep: 7.6 },
  },
  {
    id: '03',
    name: 'Elin Lindqvist',
    callsign: 'LINDQVIST',
    role: 'Pilot · Crew Medical Officer',
    location: 'Lab module',
    cmo: true,
    baseline: { heartRate: 62, spo2: 98, systolic: 112, diastolic: 72, bodyTemp: 36.7, glucose: 112, sleep: 7.8 },
  },
  {
    id: '04',
    name: 'Kenji Arai',
    callsign: 'ARAI',
    role: 'Mission Specialist',
    location: 'Airlock',
    baseline: { heartRate: 72, spo2: 98, systolic: 118, diastolic: 78, bodyTemp: 36.9, glucose: 98, sleep: 7.5 },
  },
];

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
