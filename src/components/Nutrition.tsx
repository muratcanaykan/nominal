// Nutrition on the tablet: today's intake against the crew member's targets, the next foods to eat from the ISS menu
// and the meal log. The medical officer's view gets a one-line summary and the diet approvals.

import { useState } from 'react';
import { FOOD_TYPE_LABELS, ISS_MENU, MEAL_KIND_LABELS, type Food, type MealKind } from '../data/issMenu';
import { CREW_BY_ID, MISSION_DAY_OFFSET_MS, type AstronautId } from '../domain/crew';
import {
  activeDiets,
  ACTIVITY_FACTOR,
  bmi,
  DIET_IDS,
  DIETS,
  EVA_KCAL_PER_HOUR,
  EVA_PLANNED_H,
  mealsToday,
  plan,
  SLOT_LABELS,
  suggestedDiets,
  targets,
  totals,
  type DietId,
  type Slot,
} from '../domain/nutrition';
import type { RoomState } from '../domain/room';
import { missionClock, type Snapshot } from '../domain/sim';
import { useStore } from '../lib/useRoom';

const n = (v: number) => Math.round(v).toLocaleString('en-US');
const KINDS = Object.keys(MEAL_KIND_LABELS) as MealKind[];
/** The menu opens at the section that fits the time of day. */
const MENU_START: Record<Slot, MealKind> = { breakfast: 'breakfast', lunch: 'main', dinner: 'main', snack: 'snack' };

function Bar({ label, value, target, unit, limit }: { label: string; value: number; target: number; unit: string; limit?: boolean }) {
  const over = limit && value > target;
  return (
    <div className={`nut-bar${over ? ' is-over' : ''}${limit ? ' is-limit' : ''}`}>
      <span className="nut-bar__label">{label}</span>
      <span className="nut-bar__value">
        {n(value)} / {n(target)} {unit}
        {limit && <small> max</small>}
      </span>
      <span className="nut-bar__track" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.min(1, value / target)})` }} />
      </span>
    </div>
  );
}

function FoodFacts({ f }: { f: Food }) {
  return (
    <span className="nut-food__facts">
      {n(f.kcal)} kcal · {Math.round(f.protein)} g protein · {n(f.sodium)} mg sodium
    </span>
  );
}

export function NutritionPanel({ id, state, now, s }: { id: AstronautId; state: RoomState | undefined; now: number; s: Snapshot }) {
  const store = useStore();
  const body = CREW_BY_ID[id].body;
  const t = targets(state, id);
  const meals = mealsToday(state, id, now);
  const eaten = totals(meals.map((m) => m.food));
  const next = plan(state, id, now, s);
  const [kind, setKind] = useState<MealKind>(() => MENU_START[next.slot]);
  const diets = activeDiets(state, id);
  const waiting = suggestedDiets(s).filter((d) => !diets.includes(d));

  return (
    <section className="nut" aria-labelledby={`nut-title-${id}`}>
      <header className="nut__head">
        <h3 id={`nut-title-${id}`}>Nutrition · today</h3>
        <span className="nut__chip">{SLOT_LABELS[next.slot]} time</span>
      </header>

      {next.fastCarbs && (
        <p className="nut__alert">
          <strong>Glucose is low.</strong> Take about 15 g of fast-acting carbohydrate now and recheck glucose in 15 minutes.
        </p>
      )}
      {diets.map((d) => (
        <p key={d} className="nut__diet">
          <strong>{DIETS[d].label}</strong> · approved by the medical officer. {DIETS[d].effect}
        </p>
      ))}
      {waiting.length > 0 && (
        <p className="nut__note">
          Suggested to the medical officer: {waiting.map((d) => `${DIETS[d].label.toLowerCase()} (${DIETS[d].why})`).join(', ')}. Your
          suggestions change once it is approved.
        </p>
      )}

      <div className="nut__bars">
        <Bar label="Energy" value={eaten.kcal} target={t.kcal} unit="kcal" />
        <Bar label="Protein" value={eaten.protein} target={t.protein} unit="g" />
        <Bar label="Calcium" value={eaten.calcium} target={t.calcium} unit="mg" />
        <Bar label="Fibre" value={eaten.fiber} target={t.fiber} unit="g" />
        <Bar label="Sodium" value={eaten.sodium} target={t.sodiumMax} unit="mg" limit />
        <Bar label="Saturated fat" value={eaten.satFat} target={t.satFatMax} unit="g" limit />
      </div>

      <div className="nut__next">
        <h4>{next.fastCarbs ? 'Fast-acting carbohydrate' : `Suggested next · ${SLOT_LABELS[next.slot].toLowerCase()}`}</h4>
        <ul className="nut-list">
          {next.suggestions.map(({ food, reason, tags }) => (
            <li key={food.id} className="nut-food nut-food--pick">
              <div className="nut-food__text">
                <strong>{food.name}</strong>
                <span className="nut-food__reason">{reason}</span>
                <span className="nut-food__tags">
                  {tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                  <FoodFacts f={food} />
                </span>
              </div>
              <button className="btn-ghost" onClick={() => store.logMeal(id, food.id)}>
                I ate this
              </button>
            </li>
          ))}
        </ul>
      </div>

      <details className="nut__menu">
        <summary>Log something else from the ISS menu</summary>
        <div className="nut-kinds" role="tablist" aria-label="Menu section">
          {KINDS.map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'is-on' : ''} onClick={() => setKind(k)}>
              {MEAL_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <ul className="nut-list nut-list--menu">
          {ISS_MENU.filter((f) => f.kind === kind).map((f) => (
            <li key={f.id} className="nut-food">
              <div className="nut-food__text">
                <strong>{f.name}</strong>
                <span className="nut-food__tags">
                  <span>{FOOD_TYPE_LABELS[f.type]}</span>
                  <FoodFacts f={f} />
                </span>
              </div>
              <button className="btn-ghost" onClick={() => store.logMeal(id, f.id)}>
                Log
              </button>
            </li>
          ))}
        </ul>
      </details>

      <div className="nut__log">
        <h4>Logged today</h4>
        {meals.length === 0 ? (
          <p className="nut__empty">Nothing logged yet today.</p>
        ) : (
          <ul className="nut-list">
            {meals
              .slice()
              .reverse()
              .map((m) => (
                <li key={m.key} className="nut-food nut-food--logged">
                  <span className="nut-food__time">{missionClock(state, m.at, MISSION_DAY_OFFSET_MS).slice(4, 9)}</span>
                  <div className="nut-food__text">
                    <strong>{m.food.name}</strong>
                    <FoodFacts f={m.food} />
                  </div>
                  <button className="btn-ghost" aria-label={`Remove ${m.food.name}`} onClick={() => store.removeMeal(id, m.key)}>
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <details className="nut__how">
        <summary>How your targets are worked out</summary>
        <p>
          {body.heightCm} cm · {body.weightKg} kg · BMI {bmi(body).toFixed(1)} (simulated body data). BMI only describes weight for
          height; energy needs come from a formula that also uses age and sex.
        </p>
        <p>
          Basal energy {n(t.basal)} kcal (Harris-Benedict, as in NASA's nutrition guide) × {ACTIVITY_FACTOR} for daily exercise
          {t.evaDay
            ? ` + ${n(t.evaKcal)} kcal for today's spacewalk (NASA adds ${EVA_KCAL_PER_HOUR} kcal per spacewalk hour; ${EVA_PLANNED_H} h planned)`
            : ''}{' '}
          = {n(t.kcal)} kcal.
        </p>
        <p>
          Protein 0.8 g per kg (the Recommended Dietary Allowance). Calcium 1,000 mg, fibre 14 g per 1,000 kcal, sodium under 2,300
          mg and saturated fat under 10 % of energy follow the Dietary Guidelines for Americans. Suggestions fill the biggest gaps first and keep within the limits.
          Prototype rules, not dietary advice.
        </p>
      </details>
      <p className="nut__src">Foods and values: NASA's International Space Station standard menu nutrition data.</p>
    </section>
  );
}

/** Medical officer: today's intake in one line and the diets to approve. */
export function DietControls({ id, state, now, s, by }: { id: AstronautId; state: RoomState | undefined; now: number; s: Snapshot; by: AstronautId }) {
  const store = useStore();
  const t = targets(state, id);
  const meals = mealsToday(state, id, now);
  const eaten = totals(meals.map((m) => m.food));
  const active = activeDiets(state, id);
  const suggested = suggestedDiets(s);
  const toggle = (d: DietId) => store.setDiet(id, d, !active.includes(d), by);
  return (
    <div className="nut-cmo">
      <p className="nut-cmo__line">
        <strong>Nutrition today</strong> · {n(eaten.kcal)} / {n(t.kcal)} kcal · protein {Math.round(eaten.protein)} / {t.protein} g · sodium{' '}
        {n(eaten.sodium)} / {n(t.sodiumMax)} mg · {meals.length} logged
      </p>
      <div className="nut-cmo__diets" role="group" aria-label={`Diet for ${CREW_BY_ID[id].name}`}>
        <span>Diet</span>
        {DIET_IDS.map((d) => {
          const on = active.includes(d);
          const hint = suggested.includes(d) && !on;
          return (
            <button key={d} aria-pressed={on} className={`diet-chip${on ? ' is-on' : ''}${hint ? ' is-suggested' : ''}`} onClick={() => toggle(d)}>
              {on ? '✓ ' : ''}
              {DIETS[d].label}
              {hint && <small> · suggested: {DIETS[d].why}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
