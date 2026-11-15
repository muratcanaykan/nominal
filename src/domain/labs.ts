// Lab panel: blood test results before launch and after landing, from real measurements of an anonymised commercial
// spaceflight crew (NASA OSDR OSD-575, Comprehensive Metabolic Panel), mapped to the simulated crew. Lab panels are
// periodic blood tests, not live readings. Explanations draw on the NASA Human Research Program risks (fluid shifts,
// renal stone formation, muscle and nutrition); they are background, not a diagnosis.

import osdr from '../data/osdr-inspiration4.json';
import type { OsdrSubject } from './crew';

export interface LabDef {
  key: string;
  label: string;
  decimals: number;
  /** Why the value matters in spaceflight. */
  why: string;
}

export const LABS: LabDef[] = [
  { key: 'SODIUM', label: 'Sodium', decimals: 0, why: 'Body fluid shifts toward the head in weightlessness, and the body sheds water and salt in the first days.' },
  { key: 'POTASSIUM', label: 'Potassium', decimals: 1, why: 'Shifts with fluid balance and with muscle changes when muscles are unloaded.' },
  { key: 'CHLORIDE', label: 'Chloride', decimals: 0, why: "Moves with sodium and the body's water balance." },
  { key: 'CARBON DIOXIDE', label: 'Bicarbonate (CO₂)', decimals: 0, why: 'Acid–base balance of the blood; breathing and cabin air affect it.' },
  { key: 'UREA NITROGEN (BUN)', label: 'Urea nitrogen', decimals: 0, why: 'Rises with dehydration and with protein breakdown.' },
  { key: 'CREATININE', label: 'Creatinine', decimals: 2, why: 'Kidney function and hydration; spaceflight raises the risk of kidney stones.' },
  { key: 'CALCIUM', label: 'Calcium', decimals: 1, why: 'Kept in a narrow range in the blood; spaceflight changes how the body handles calcium.' },
  { key: 'ALBUMIN', label: 'Albumin', decimals: 1, why: 'The main blood protein; changes with hydration and nutrition.' },
  { key: 'ALKALINE PHOSPHATASE', label: 'Alkaline phosphatase', decimals: 0, why: 'An enzyme mainly from the liver and bone.' },
  { key: 'ALT', label: 'ALT (liver)', decimals: 0, why: 'A liver enzyme; diet, exercise and medicines affect it.' },
];

export const LAB_TIMEPOINTS = ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194'] as const;
const PREFLIGHT = ['L-92', 'L-44', 'L-3'];

export type LabFlag = 'low' | 'high' | null;

export interface LabRow {
  def: LabDef;
  units: string;
  /** Reference range of the lab; the upper limit can be missing. */
  range: [number | null, number | null];
  /** Mean of the three pre-flight tests. */
  before: number;
  /** The day after landing. */
  after: number | null;
  /** Every test in time order (null where missing). */
  series: (number | null)[];
  /** Day-after-landing value outside the reference range. */
  flag: LabFlag;
}

interface RawLab {
  units: string;
  range: (number | null)[];
  values: Record<string, number>;
}

const flagOf = (v: number | null, [lo, hi]: [number | null, number | null]): LabFlag =>
  v === null ? null : lo !== null && v < lo ? 'low' : hi !== null && v > hi ? 'high' : null;

export function labRows(subject: OsdrSubject): LabRow[] {
  const labs = (osdr.subjects[subject] as { labs?: Record<string, RawLab> }).labs ?? {};
  return LABS.flatMap((def) => {
    const raw = labs[def.key];
    if (!raw) return [];
    const pre = PREFLIGHT.map((t) => raw.values[t]).filter((v): v is number => v !== undefined);
    if (!pre.length) return [];
    const range: [number | null, number | null] = [raw.range[0] ?? null, raw.range[1] ?? null];
    const after = raw.values['R+1'] ?? null;
    return [
      {
        def,
        units: raw.units,
        range,
        before: pre.reduce((a, b) => a + b, 0) / pre.length,
        after,
        series: LAB_TIMEPOINTS.map((t) => raw.values[t] ?? null),
        flag: flagOf(after, range),
      },
    ];
  });
}
