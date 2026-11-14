// What the crew should do when a crew alert shows on the cabin screen: a short summary and a shared checklist that
// responders tick off on the cabin screen. The steps are prototype examples written for this demo, not medical
// procedures. They name actions only, never health values.

import { CREW_BY_ID, PROFILES, type AstronautId } from './crew';
import { isEva, locationLabel } from './locations';
import type { RoomState } from './room';
import type { CrewAlert } from './sim';
import type { VitalId } from './vitals';

type Key = VitalId | 'help';

const RESPONSE_STEP: Record<Key, string> = {
  spo2: 'Bring the emergency oxygen kit',
  heartRate: 'Bring the medical kit and defibrillator',
  bloodPressure: 'Bring the medical kit',
  bodyTemp: 'Bring the medical kit and prepare cooling',
  glucose: 'Bring fast-acting carbohydrate',
  sleep: 'Check on the crew member',
  mood: 'Check on the crew member',
  fingerTempL: 'Prepare the airlock and the medical kit',
  fingerTempR: 'Prepare the airlock and the medical kit',
  helmetCO2: 'Prepare the airlock for an early return',
  helmetWater: 'Prepare the airlock for an emergency return',
  shoulderL: 'Check on the crew member',
  shoulderR: 'Check on the crew member',
  jointPain: 'Check on the crew member',
  help: 'Go to the crew member now',
};

/** The first thing to do once the kit is there. */
const FIRST_ACTION: Record<Key, string> = {
  spo2: 'Start oxygen and recheck blood oxygen with a finger sensor',
  heartRate: 'Keep them at rest; check breathing and pulse',
  bloodPressure: 'Keep them at rest; recheck blood pressure with the cuff',
  bodyTemp: 'Recheck temperature; cool or warm as needed',
  glucose: 'Give it if they can swallow; recheck glucose in 15 minutes',
  sleep: 'Ask how they are and stay with them',
  mood: 'Ask how they are and stay with them',
  fingerTempL: 'Stop work and keep the hand still until inside',
  fingerTempR: 'Stop work and keep the hand still until inside',
  helmetCO2: 'Stop work and rest; stay on the radio',
  helmetWater: 'Keep the head still; stay on the radio until inside',
  shoulderL: 'Stop work and change position',
  shoulderR: 'Stop work and change position',
  jointPain: 'Stop work and rest the joint',
  help: 'Find out what is wrong',
};

const keyOf = (alert: CrewAlert): Key => (alert.kind === 'help' ? 'help' : (alert.vital ?? 'help'));
const surname = (id: AstronautId) => CREW_BY_ID[id].name.split(' ').slice(-1)[0];

/** One-line summary for small cards: the kit, plus the airlock for someone outside. */
export function responseSteps(alert: CrewAlert, state: RoomState | null | undefined): string[] {
  const steps = [RESPONSE_STEP[keyOf(alert)]];
  if (isEva(state, alert.astronautId) && !steps[0].includes('airlock')) steps.push('Prepare the airlock for early return');
  return steps;
}

export interface ResponseStep {
  id: string;
  text: string;
}

/** The shared checklist for a crew alert, in order. */
export function responseChecklist(alert: CrewAlert, state: RoomState | null | undefined): ResponseStep[] {
  const id = alert.astronautId;
  const who = surname(id);
  const key = keyOf(alert);
  const eva = isEva(state, id);
  const kit = RESPONSE_STEP[key];
  const steps: ResponseStep[] = [
    {
      id: 'reach',
      text: eva ? `Talk to ${who} on the suit radio` : `Go to ${who} in the ${locationLabel(state, id).toLowerCase()}`,
    },
  ];
  if (key !== 'help') steps.push({ id: 'kit', text: kit });
  steps.push({ id: 'act', text: FIRST_ACTION[key] });
  if (eva && !kit.includes('airlock')) steps.push({ id: 'airlock', text: 'Prepare the airlock for early return' });
  steps.push({ id: 'care', text: CREW_BY_ID[id].cmo ? 'Commander coordinates care' : 'Medical officer takes over care' });
  const replyMs = 2 * PROFILES[state?.profile ?? 'lunar'].earthDelayMs;
  const reply = replyMs < 60_000 ? `${Math.ceil(replyMs / 1000)} s` : `${Math.round(replyMs / 60_000)} min`;
  steps.push({ id: 'earth', text: `Send flight surgeons an update (reply in about ${reply})` });
  return steps;
}

export interface ChecklistProgress {
  done: number;
  total: number;
}

export function checklistProgress(alert: CrewAlert, state: RoomState | null | undefined): ChecklistProgress {
  const ticks = state?.checklists?.[alert.astronautId] ?? {};
  const steps = responseChecklist(alert, state);
  return { done: steps.filter((s) => ticks[s.id]).length, total: steps.length };
}
