// Nutrition: daily energy and nutrient targets, the meal log and rule-based suggestions for the next meal from the
// ISS standard menu. The rules are prototype values for the demo, not dietary or medical advice; a diet for a health
// condition only applies once the medical officer has approved it.

import { ISS_MENU, FOOD_BY_ID, MEAL_KIND_LABELS, type Food, type MealKind } from '../data/issMenu';
import { CREW_BY_ID, MISSION_DAY_OFFSET_MS, type Astronaut, type AstronautId } from './crew';
import { locationOf } from './locations';
import type { RoomState } from './room';
import type { Snapshot } from './sim';

const DAY_MS = 24 * 3600 * 1000;

// ---- energy and targets ----------------------------------------------------------------------------------

type Body = Astronaut['body'];

/**
 * Basal energy (Harris-Benedict), as in NASA's STEMonstrations nutrition guide and NASA's Shuttle food fact sheet:
 * weight in kg, height in cm, age in years.
 */
export function basalEnergy(b: Body): number {
  return b.sex === 'male'
    ? 66.47 + 13.75 * b.weightKg + 5.003 * b.heightCm - 6.775 * b.age
    : 655.1 + 9.563 * b.weightKg + 1.85 * b.heightCm - 4.676 * b.age;
}

/** "Moderate exercise" factor from the same guide; crew members exercise about two hours a day. */
export const ACTIVITY_FACTOR = 1.55;
/** NASA: an extra 200 kcal (837 kJ) for every spacewalk hour. */
export const EVA_KCAL_PER_HOUR = 200;
/** Planned length of a spacewalk day in the demo (prototype assumption; spacewalks often last about 6.5 hours). */
export const EVA_PLANNED_H = 6.5;

/** Body mass index, kg/m². Shown for context only: the energy need comes from the formula above. */
export const bmi = (b: Body) => b.weightKg / (b.heightCm / 100) ** 2;

export interface Targets {
  kcal: number;
  /** Grams, at least. */
  protein: number;
  /** Milligrams, at least. */
  calcium: number;
  /** Grams, at least. */
  fiber: number;
  /** Milligrams, at most. */
  sodiumMax: number;
  /** Grams, at most. */
  satFatMax: number;
  basal: number;
  /** In the suit today (airlock or outside), so a spacewalk's extra energy is added. */
  evaDay: boolean;
  evaKcal: number;
}

/**
 * Daily targets. Energy: basal × activity, plus the spacewalk allowance (NASA JSC-67378). Protein 0.8 g per kg (the
 * Recommended Dietary Allowance); calcium 1,000 mg, fibre 14 g per 1,000 kcal, sodium under 2,300 mg and saturated
 * fat under 10 % of energy (Dietary Guidelines for Americans 2020–2025).
 */
export function targets(state: RoomState | null | undefined, id: AstronautId): Targets {
  const body = CREW_BY_ID[id].body;
  const basal = basalEnergy(body);
  const location = locationOf(state, id);
  const evaDay = location === 'eva' || location === 'airlock';
  const evaKcal = evaDay ? EVA_KCAL_PER_HOUR * EVA_PLANNED_H : 0;
  const kcal = Math.round(basal * ACTIVITY_FACTOR + evaKcal);
  return {
    kcal,
    protein: Math.round(0.8 * body.weightKg),
    calcium: 1000,
    fiber: Math.round((14 * kcal) / 1000),
    sodiumMax: 2300,
    satFatMax: Math.round((0.1 * kcal) / 9),
    basal: Math.round(basal),
    evaDay,
    evaKcal,
  };
}

// ---- meal log ------------------------------------------------------------------------------------------

const missionElapsed = (state: RoomState | null | undefined, now: number) => Math.max(0, now - (state?.createdAt ?? now) + MISSION_DAY_OFFSET_MS);

/** Hour of the mission day (0–24, fractional). */
export const missionHour = (state: RoomState | null | undefined, now: number) => (missionElapsed(state, now) % DAY_MS) / 3600000;

/** When the current mission day started. */
export const dayStart = (state: RoomState | null | undefined, now: number) => now - (missionElapsed(state, now) % DAY_MS);

export interface MealEntry {
  key: string;
  food: Food;
  at: number;
}

/** Foods logged since the start of the mission day, oldest first. */
export function mealsToday(state: RoomState | null | undefined, id: AstronautId, now: number): MealEntry[] {
  const start = dayStart(state, now);
  return Object.entries(state?.meals?.[id] ?? {})
    .filter(([, m]) => m.at >= start && m.at <= now && FOOD_BY_ID[m.food])
    .map(([key, m]) => ({ key, food: FOOD_BY_ID[m.food], at: m.at }))
    .sort((a, b) => a.at - b.at);
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  satFat: number;
  sodium: number;
  calcium: number;
  fiber: number;
}

export function totals(foods: Food[]): Totals {
  const t: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, satFat: 0, sodium: 0, calcium: 0, fiber: 0 };
  for (const f of foods) for (const k of Object.keys(t) as (keyof Totals)[]) t[k] += f[k];
  return t;
}

// ---- meal times ------------------------------------------------------------------------------------------

export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const SLOT_LABELS: Record<Slot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

/** Which meal the mission clock is at. */
export function slotAt(hour: number): Slot {
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'snack';
}

const SLOT_KINDS: Record<Slot, MealKind[]> = {
  breakfast: ['breakfast', 'fruit', 'drink'],
  lunch: ['main', 'side', 'soup', 'fruit'],
  dinner: ['main', 'side', 'soup', 'dessert'],
  snack: ['snack', 'fruit', 'drink'],
};

// ---- diets for health conditions -------------------------------------------------------------------------

export type DietId = 'lowSodium' | 'lowSugar' | 'fluids';
export const DIET_IDS: DietId[] = ['lowSodium', 'lowSugar', 'fluids'];

export const DIETS: Record<DietId, { label: string; why: string; effect: string }> = {
  lowSodium: {
    label: 'Low sodium',
    why: 'blood pressure is high',
    effect: 'Salty foods are left out and foods under 140 mg sodium come first.',
  },
  lowSugar: {
    label: 'Lower sugar',
    why: 'glucose is high',
    effect: 'Sweet drinks, fruit and desserts are left out; protein and fibre come first.',
  },
  fluids: {
    label: 'Extra fluids',
    why: 'body temperature is high',
    effect: 'Drinks and soups come first. Keep drinking water through the day.',
  },
};

/** Diets the live readings point to. The medical officer decides whether to approve them. */
export function suggestedDiets(s: Snapshot): DietId[] {
  if (!s.connected) return [];
  const out: DietId[] = [];
  if (s.readings.bloodPressure.value > 129) out.push('lowSodium');
  if (s.readings.glucose.value > 180) out.push('lowSugar');
  if (s.readings.bodyTemp.value > 37.4) out.push('fluids');
  return out;
}

/** Diets the medical officer has approved. */
export const activeDiets = (state: RoomState | null | undefined, id: AstronautId): DietId[] =>
  DIET_IDS.filter((d) => state?.diets?.[id]?.[d]);

/** Glucose below 70 mg/dL: fast-acting carbohydrate comes before any meal plan. */
export const glucoseLow = (s: Snapshot) => s.connected && s.readings.glucose.value < 70;

// ---- suggestions -----------------------------------------------------------------------------------------

export interface Suggestion {
  food: Food;
  /** Why this food, in a few words. */
  reason: string;
  tags: string[];
}

export interface Plan {
  slot: Slot;
  /** Glucose is low: the suggestions are fast-acting carbohydrate. */
  fastCarbs: boolean;
  suggestions: Suggestion[];
}

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n * 10) / 10));
const netCarbs = (f: Food) => Math.max(0, f.carbs - f.fiber);

/** About 15 g of fast-acting carbohydrate for low glucose (the American Diabetes Association's "15-15 rule"). */
function fastCarbOptions(count: number): Suggestion[] {
  return ISS_MENU.filter((f) => (f.kind === 'drink' || f.kind === 'fruit') && f.fat < 1 && f.carbs >= 10 && f.carbs <= 30)
    .sort((a, b) => (a.kind === b.kind ? Math.abs(netCarbs(a) - 15) - Math.abs(netCarbs(b) - 15) : a.kind === 'drink' ? -1 : 1))
    .slice(0, count)
    .map((food) => ({ food, reason: `${fmt(food.carbs)} g fast-acting carbohydrate`, tags: ['Recheck in 15 min'] }));
}

/**
 * The next foods to eat: what fills the day's biggest gaps (protein, calcium, fibre, energy) without going over the
 * sodium and saturated fat limits, for the meal the mission clock is at, following any approved diet.
 */
export function plan(state: RoomState | null | undefined, id: AstronautId, now: number, s: Snapshot, count = 3): Plan {
  const slot = slotAt(missionHour(state, now));
  if (glucoseLow(s)) return { slot, fastCarbs: true, suggestions: fastCarbOptions(count) };

  const t = targets(state, id);
  const meals = mealsToday(state, id, now);
  const eaten = totals(meals.map((m) => m.food));
  const eatenIds = new Set(meals.map((m) => m.food.id));
  const diets = new Set(activeDiets(state, id));
  const gap = (target: number, have: number) => Math.max(0, target - have);

  const scored = ISS_MENU.filter((f) => SLOT_KINDS[slot].includes(f.kind))
    .filter((f) => !(diets.has('lowSodium') && f.sodium > 400))
    .filter((f) => !(diets.has('lowSugar') && ['dessert', 'drink', 'fruit'].includes(f.kind) && netCarbs(f) > 15))
    .map((food) => {
      const parts = [
        { key: 'protein', score: (1.0 * Math.min(food.protein, gap(t.protein, eaten.protein))) / t.protein },
        { key: 'calcium', score: (0.7 * Math.min(food.calcium, gap(t.calcium, eaten.calcium))) / t.calcium },
        { key: 'fiber', score: (0.7 * Math.min(food.fiber, gap(t.fiber, eaten.fiber))) / t.fiber },
        { key: 'kcal', score: (0.5 * Math.min(food.kcal, gap(t.kcal, eaten.kcal))) / t.kcal },
      ];
      let score = parts.reduce((sum, p) => sum + p.score, 0);
      score -= ((diets.has('lowSodium') ? 2 : 0.6) * food.sodium) / t.sodiumMax;
      if (eaten.sodium + food.sodium > t.sodiumMax) score -= 1;
      score -= (0.4 * food.satFat) / t.satFatMax;
      if (eaten.kcal + food.kcal > t.kcal * 1.05) score -= 0.5;
      if (diets.has('fluids') && (food.kind === 'drink' || food.kind === 'soup')) score += 0.4;
      if (eatenIds.has(food.id)) score -= 0.4;
      const best = parts.reduce((a, b) => (b.score > a.score ? b : a));
      return { food, score, best: best.score > 0 ? best.key : null };
    })
    .sort((a, b) => b.score - a.score);

  // One food per kind first (a main, a side, a soup…), then the next best.
  const picked: typeof scored = [];
  for (const c of scored) if (picked.length < count && !picked.some((p) => p.food.kind === c.food.kind)) picked.push(c);
  for (const c of scored) if (picked.length < count && !picked.includes(c)) picked.push(c);

  const reasonFor = (food: Food, key: string | null) => {
    switch (key) {
      case 'protein':
        return `${fmt(food.protein)} g protein toward your ${t.protein} g`;
      case 'calcium':
        return `${fmt(food.calcium)} mg calcium toward your ${fmt(t.calcium)} mg`;
      case 'fiber':
        return `${fmt(food.fiber)} g fibre toward your ${t.fiber} g`;
      case 'kcal':
        return `${fmt(food.kcal)} kcal toward your ${fmt(t.kcal)} kcal`;
      default:
        return 'A light option: your targets for today are met';
    }
  };

  return {
    slot,
    fastCarbs: false,
    suggestions: picked.map(({ food, best }) => {
      const tags: string[] = [MEAL_KIND_LABELS[food.kind].replace(/s$/, '')];
      if (food.sodium <= 140) tags.push('Low sodium');
      if (diets.has('fluids') && (food.kind === 'drink' || food.kind === 'soup')) tags.push('Fluids');
      return { food, reason: reasonFor(food, best), tags };
    }),
  };
}
