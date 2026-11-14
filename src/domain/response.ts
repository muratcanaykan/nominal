// What the crew should do when a crew alert shows on the cabin screen.

import { isEva } from './locations';
import type { RoomState } from './room';
import type { CrewAlert } from './sim';
import type { VitalId } from './vitals';

const RESPONSE_STEP: Record<VitalId | 'help', string> = {
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

export function responseSteps(alert: CrewAlert, state: RoomState | null | undefined): string[] {
  const steps = [RESPONSE_STEP[alert.kind === 'help' ? 'help' : (alert.vital ?? 'help')]];
  if (isEva(state, alert.astronautId) && !steps[0].includes('airlock')) steps.push('Prepare the airlock for early return');
  return steps;
}
