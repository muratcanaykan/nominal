// Health indicators, their prototype thresholds and the guidance shown on the watch.
// Thresholds are prototype values for a hackathon demo, NOT clinically validated.

export type Level = 0 | 1 | 2 | 3;
export type Status = Level | 'nodata';

export const LEVEL_NAMES: Record<Level, string> = {
  0: 'Nominal',
  1: 'Caution',
  2: 'Warning',
  3: 'Critical',
};

export type HazardId = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'hostile';

// NASA Human Research Program — five hazards of human spaceflight.
export const HAZARDS: Record<HazardId, { label: string; short: string }> = {
  radiation: { label: 'Space radiation', short: 'Radiation' },
  isolation: { label: 'Isolation and confinement', short: 'Isolation' },
  distance: { label: 'Distance from Earth', short: 'Distance' },
  gravity: { label: 'Gravity fields', short: 'Gravity' },
  hostile: { label: 'Hostile and closed environments', short: 'Environment' },
};

export type VitalId = 'heartRate' | 'spo2' | 'bloodPressure' | 'bodyTemp' | 'glucose' | 'sleep' | 'mood';

export type VitalSource = 'watch' | 'patch' | 'cgm' | 'self-report' | 'derived';

/** Nested ranges: nominal ⊂ caution ⊂ warning. Outside `warning` is critical (capped by maxLevel). */
export interface Thresholds {
  nominal: [number, number];
  caution: [number, number];
  warning: [number, number];
}

export interface VitalDef {
  id: VitalId;
  label: string;
  short: string;
  unit: string;
  decimals: number;
  source: VitalSource;
  thresholds: Thresholds;
  maxLevel: Level;
  hazards: HazardId[];
  info: {
    what: string;
    why: string;
    /** What the astronaut should do at each level. */
    actions: Record<Level, string>;
  };
  references: string[];
}

export const VITALS: Record<VitalId, VitalDef> = {
  heartRate: {
    id: 'heartRate',
    label: 'Heart rate',
    short: 'HR',
    unit: 'bpm',
    decimals: 0,
    source: 'watch',
    thresholds: { nominal: [50, 100], caution: [45, 120], warning: [40, 150] },
    maxLevel: 3,
    hazards: ['gravity', 'hostile'],
    info: {
      what: 'Heartbeats per minute, measured continuously at the wrist.',
      why: 'In weightlessness about two litres of body fluid shift toward the head and the heart deconditions. Exertion during a spacewalk raises heart rate.',
      actions: {
        0: 'No action needed.',
        1: 'Pause for a minute, slow your breathing and drink water. On a spacewalk, lower your work pace.',
        2: 'Stop your current task and rest. Your crew medical officer has been notified.',
        3: 'Stop all activity now. Your crew and flight surgeons have been notified and help is coming.',
      },
    },
    references: [
      'American Heart Association — normal resting heart rate 60–100 bpm (heart.org).',
    ],
  },
  spo2: {
    id: 'spo2',
    label: 'Blood oxygen',
    short: 'SpO2',
    unit: '%',
    decimals: 0,
    source: 'watch',
    thresholds: { nominal: [95, 100], caution: [92, 100], warning: [88, 100] },
    maxLevel: 3,
    hazards: ['hostile'],
    info: {
      what: 'How much of your blood is carrying oxygen (SpO₂), measured optically at the wrist.',
      why: 'Problems with cabin or suit atmosphere, such as a leak or CO₂ build-up, show up early as falling oxygen saturation.',
      actions: {
        0: 'No action needed.',
        1: 'Breathe slowly and deeply. Check the oxygen reading of your suit or cabin.',
        2: 'Stop exertion and check your oxygen supply. Your crew medical officer has been notified.',
        3: 'Move to a safe area and use the emergency oxygen supply. Crew and flight surgeons have been notified.',
      },
    },
    references: ['Normal pulse oximetry range 95–100%; below 90% is considered low (Mayo Clinic, "Hypoxemia").'],
  },
  bloodPressure: {
    id: 'bloodPressure',
    label: 'Blood pressure',
    short: 'BP',
    unit: 'mmHg',
    decimals: 0,
    source: 'watch',
    // Level is driven by systolic pressure; diastolic is shown alongside.
    thresholds: { nominal: [90, 129], caution: [85, 139], warning: [80, 179] },
    maxLevel: 3,
    hazards: ['gravity'],
    info: {
      what: 'Systolic / diastolic blood pressure, estimated by the wrist sensor.',
      why: 'Fluid shift and cardiovascular deconditioning in weightlessness change blood pressure, especially when returning to gravity.',
      actions: {
        0: 'No action needed.',
        1: 'Sit or anchor yourself, rest for five minutes and measure again.',
        2: 'Rest and avoid exertion. Your crew medical officer has been notified.',
        3: 'Stop all activity and stay still. Your crew and flight surgeons have been notified.',
      },
    },
    references: ['American Heart Association — "Understanding Blood Pressure Readings" (heart.org).'],
  },
  bodyTemp: {
    id: 'bodyTemp',
    label: 'Body temperature',
    short: 'TEMP',
    unit: '°C',
    decimals: 1,
    source: 'patch',
    thresholds: { nominal: [36.1, 37.4], caution: [35.5, 37.9], warning: [35.0, 39.4] },
    maxLevel: 3,
    hazards: ['hostile'],
    info: {
      what: 'Core body temperature from a skin patch sensor.',
      why: 'Core body temperature rises during long missions, heat is harder to shed inside a suit, and a closed cabin helps infections spread.',
      actions: {
        0: 'No action needed.',
        1: 'Drink water and lower your activity. In a suit, check your cooling setting.',
        2: 'Rest, hydrate and measure again in 15 minutes. Your crew medical officer has been notified.',
        3: 'Stop all activity. Your crew and flight surgeons have been notified.',
      },
    },
    references: [
      'Fever: 38.0 °C or higher; hypothermia: below 35 °C (Mayo Clinic).',
      'Stahn A.C. et al., "Increased core body temperature in astronauts during long-duration space missions", Scientific Reports 7, 16180 (2017).',
    ],
  },
  glucose: {
    id: 'glucose',
    label: 'Blood glucose',
    short: 'GLU',
    unit: 'mg/dL',
    decimals: 0,
    source: 'cgm',
    thresholds: { nominal: [70, 180], caution: [54, 250], warning: [40, 350] },
    maxLevel: 3,
    hazards: ['gravity', 'hostile'],
    info: {
      what: 'Blood glucose from a continuous glucose monitor (CGM) patch, updated every few minutes.',
      why: 'Spaceflight can reduce insulin sensitivity, and meals are easy to delay on busy mission days.',
      actions: {
        0: 'No action needed.',
        1: 'Confirm with a fingerstick test. If low, take fast-acting carbohydrate. If high, drink water and log your last meal.',
        2: 'Confirm with a fingerstick test now. Your crew medical officer has been notified.',
        3: 'Take fast-acting carbohydrate if low and stay with a crewmate. Crew and flight surgeons have been notified.',
      },
    },
    references: [
      'American Diabetes Association — hypoglycaemia level 1 below 70 mg/dL, level 2 below 54 mg/dL.',
      'Battelino T. et al., "Clinical Targets for Continuous Glucose Monitoring Data Interpretation", Diabetes Care 42(8), 2019.',
    ],
  },
  sleep: {
    id: 'sleep',
    label: 'Sleep',
    short: 'SLEEP',
    unit: 'h',
    decimals: 1,
    source: 'derived',
    thresholds: { nominal: [7, 24], caution: [6, 24], warning: [0, 24] },
    maxLevel: 2,
    hazards: ['isolation', 'hostile'],
    info: {
      what: 'Hours slept in your last sleep period, estimated from wrist motion and heart rate.',
      why: 'Frequent sunrises, noise, light and workload disrupt the body clock in space.',
      actions: {
        0: 'No action needed.',
        1: 'Protect your next sleep period: dim the lights and stop screen work an hour before.',
        2: 'Your crew medical officer has been notified and may adjust your schedule.',
        3: '',
      },
    },
    references: ['Watson N.F. et al., "Recommended Amount of Sleep for a Healthy Adult", Sleep 38(6), 2015 — 7 hours or more.'],
  },
  mood: {
    id: 'mood',
    label: 'Mood',
    short: 'MOOD',
    unit: '/5',
    decimals: 0,
    source: 'self-report',
    thresholds: { nominal: [3, 5], caution: [2, 5], warning: [1, 5] },
    maxLevel: 2,
    hazards: ['isolation', 'distance'],
    info: {
      what: 'Your own rating from the last mood check-in (1 = very low, 5 = very good).',
      why: 'Isolation, confinement and distance from home affect behavioural health on long missions.',
      actions: {
        0: 'No action needed.',
        1: 'Take a short break, message someone at home or talk to a crewmate.',
        2: 'Your crew medical officer will check in with you privately.',
        3: '',
      },
    },
    references: ['NASA Human Research Program — Risks of Human Spaceflight (behavioural conditions).'],
  },
};

export const VITAL_IDS = Object.keys(VITALS) as VitalId[];

/** When two indicators share the highest level, this order decides which one the watch shows first. */
export const VITAL_PRIORITY: VitalId[] = ['spo2', 'heartRate', 'bloodPressure', 'bodyTemp', 'glucose', 'mood', 'sleep'];

const within = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;

export function levelFor(id: VitalId, value: number): Level {
  const def = VITALS[id];
  const t = def.thresholds;
  let level: Level;
  if (within(value, t.nominal)) level = 0;
  else if (within(value, t.caution)) level = 1;
  else if (within(value, t.warning)) level = 2;
  else level = 3;
  return Math.min(level, def.maxLevel) as Level;
}

export function formatValue(id: VitalId, value: number): string {
  return value.toFixed(VITALS[id].decimals);
}

/** Who is told at each level — the team's escalation model. */
export interface Routing {
  watch: boolean;
  vibration: 'none' | 'light' | 'strong' | 'continuous';
  cmo: boolean;
  cabin: boolean;
  earth: boolean;
}

export function routingFor(level: Level): Routing {
  switch (level) {
    case 0:
      return { watch: false, vibration: 'none', cmo: false, cabin: false, earth: false };
    case 1:
      return { watch: true, vibration: 'light', cmo: false, cabin: false, earth: false };
    case 2:
      return { watch: true, vibration: 'strong', cmo: true, cabin: false, earth: false };
    case 3:
      return { watch: true, vibration: 'continuous', cmo: true, cabin: true, earth: true };
  }
}
