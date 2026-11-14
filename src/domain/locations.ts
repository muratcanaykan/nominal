// Where each crew member is. Suit sensors only report while the crew member wears the spacesuit (airlock or outside).

import { CREW_BY_ID, type AstronautId } from './crew';
import type { RoomState } from './room';

export type LocationId = 'habitat' | 'lab' | 'airlock' | 'eva';

export interface Location {
  id: LocationId;
  label: string;
  short: string;
  /** Wears the spacesuit, so suit sensors report. */
  suited: boolean;
  /** Outside the vehicle on a spacewalk. */
  eva: boolean;
}

export const LOCATIONS: Record<LocationId, Location> = {
  habitat: { id: 'habitat', label: 'Habitat module', short: 'Habitat', suited: false, eva: false },
  lab: { id: 'lab', label: 'Lab module', short: 'Lab', suited: false, eva: false },
  airlock: { id: 'airlock', label: 'Airlock · suited', short: 'Airlock', suited: true, eva: false },
  eva: { id: 'eva', label: 'Spacewalk · Outside', short: 'Outside', suited: true, eva: true },
};

export const LOCATION_IDS = Object.keys(LOCATIONS) as LocationId[];

export function locationOf(state: RoomState | null | undefined, id: AstronautId): LocationId {
  return state?.locations?.[id] ?? CREW_BY_ID[id].home;
}

export const locationLabel = (state: RoomState | null | undefined, id: AstronautId) => LOCATIONS[locationOf(state, id)].label;
export const isSuited = (state: RoomState | null | undefined, id: AstronautId) => LOCATIONS[locationOf(state, id)].suited;
export const isEva = (state: RoomState | null | undefined, id: AstronautId) => LOCATIONS[locationOf(state, id)].eva;
