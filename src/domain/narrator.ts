// Event narrator for the live demo: turns changes in the room into short plain sentences that say what happened and
// who was told. It explains the escalation model while a scenario plays; it is a presenter aid, not a crew screen.

import { CREW_BY_ID, PROFILES, type AstronautId } from './crew';
import { forecastText, type Forecast } from './forecast';
import { isSuited, locationLabel, locationOf, type LocationId } from './locations';
import { MESSAGE_LABELS, replyText, type EarthMessage } from './earth';
import { RATING_LABELS, REACTION_BASELINE_MS, type ReactionResult } from './reaction';
import { checklistProgress } from './response';
import type { RoomState } from './room';
import type { CrewAlert, Snapshot } from './sim';
import { LEVEL_NAMES, VITALS, type Level, type VitalId } from './vitals';

/** Who learns about an event. */
export type Told = 'watch' | 'cmo' | 'cabin' | 'earth';
export const TOLD_LABELS: Record<Told, string> = { watch: 'Own watch', cmo: 'Medical officer', cabin: 'Cabin screen', earth: 'Earth' };
export const TOLD_ORDER: Told[] = ['watch', 'cmo', 'cabin', 'earth'];

export type Tone = Level | 'nodata' | 'trend' | 'info';

export interface Beat {
  who: AstronautId | null;
  tone: Tone;
  title: string;
  text: string;
  /** Empty when the event is not a health alert (for example a move to the airlock). */
  told: Told[];
}

/** What the narrator compares between two moments for one crew member. */
export interface PersonView {
  status: Level | 'nodata';
  vital?: VitalId;
  pending: boolean;
  help: boolean;
  location: LocationId;
  /** Crew alert on the cabin screen: who answered it and whether its response checklist is complete. */
  respondedBy?: AstronautId;
  checklistDone: boolean;
}

export function personView(state: RoomState | undefined, id: AstronautId, s: Snapshot, now: number, alert?: CrewAlert): PersonView {
  const help = state?.help?.[id];
  const progress = alert ? checklistProgress(alert, state) : null;
  return {
    status: s.status,
    vital: s.top?.id,
    pending: !!s.top?.pending,
    help: !!help && help.at <= now,
    location: locationOf(state, id),
    respondedBy: alert?.claimedBy,
    checklistDone: !!progress && progress.done === progress.total,
  };
}

export const viewKey = (v: PersonView) =>
  `${v.status}|${v.vital ?? ''}|${v.pending}|${v.help}|${v.location}|${v.respondedBy ?? ''}|${v.checklistDone}`;

const rank = (s: Level | 'nodata') => (s === 'nodata' ? -1 : s);

function valueText(s: Snapshot, vital: VitalId): string {
  const r = s.readings[vital];
  const def = VITALS[vital];
  const v = vital === 'bloodPressure' ? `${r.value}/${r.secondary}` : r.value.toFixed(def.decimals);
  return `${def.label.toLowerCase()} ${v}${def.unit === '%' ? ' %' : def.unit ? ` ${def.unit}` : ''}`;
}

function delayText(state: RoomState | undefined): string {
  const ms = PROFILES[state?.profile ?? 'lunar'].earthDelayMs;
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
}

/** Sentences for one crew member whose view changed from `prev` to `next`. */
export function personBeats(prev: PersonView, next: PersonView, id: AstronautId, s: Snapshot, state: RoomState | undefined): Beat[] {
  const name = CREW_BY_ID[id].name;
  const first = name.split(' ')[0];
  const beats: Beat[] = [];

  if (next.location !== prev.location) {
    const suitedNow = isSuited(state, id);
    const suitedBefore = prev.location === 'airlock' || prev.location === 'eva';
    beats.push({
      who: id,
      tone: 'info',
      title: `${name} moved to ${locationLabel(state, id).toLowerCase()}`,
      text:
        suitedNow && !suitedBefore
          ? 'Suit sensors switch on: glove fingertips, helmet CO₂ and water, shoulder pressure. The cabin screen shows the new location.'
          : !suitedNow && suitedBefore
            ? 'Suit sensors switch off. The cabin screen shows the new location.'
            : 'The cabin screen shows the new location; health data does not change.',
      told: [],
    });
  }

  if (next.help && !prev.help) {
    beats.push({
      who: id,
      tone: 3,
      title: `${name} called for help`,
      text: `The help button on the watch puts an event card on the cabin screen for the whole crew. The medical officer is told, and flight surgeons on Earth after a ${delayText(state)} signal delay.`,
      told: ['watch', 'cmo', 'cabin', 'earth'],
    });
  } else if (!next.help && prev.help) {
    beats.push({ who: id, tone: 'info', title: `${name}'s help call closed`, text: 'The event card leaves the cabin screen.', told: [] });
  }

  if (next.status !== prev.status || (next.pending !== prev.pending && next.status === 1)) {
    const st = next.status;
    const vital = next.vital;
    if (st === 'nodata') {
      beats.push({
        who: id,
        tone: 'nodata',
        title: `${name}'s watch stopped sending`,
        text: 'The cabin screen shows one device fewer connected and the medical officer gets a connection warning. Lost data is treated as unknown: neither healthy nor an emergency.',
        told: ['cmo', 'cabin'],
      });
    } else if (prev.status === 'nodata') {
      beats.push({ who: id, tone: st, title: `${name}'s watch is back online`, text: 'Readings flow again and every screen catches up.', told: [] });
    } else if (st === 0) {
      beats.push({ who: id, tone: 0, title: `${name} is back to nominal`, text: 'Readings are back in range and the alerts clear on every screen.', told: [] });
    } else if (vital && rank(st) < rank(prev.status)) {
      beats.push({
        who: id,
        tone: st,
        title: `${name} is improving · ${LEVEL_NAMES[st]}`,
        text: st >= 2 ? 'The cabin card closes; the medical officer keeps watching.' : 'Only the own watch still shows it.',
        told: st >= 2 ? ['watch', 'cmo'] : ['watch'],
      });
    } else if (vital) {
      const what = valueText(s, vital);
      const title = `${name} · ${LEVEL_NAMES[st]}: ${what}`;
      if (st === 1 && next.pending) {
        const finger = VITALS[vital].confirm?.kind === 'fingerstick';
        beats.push({
          who: id,
          tone: 1,
          title,
          text: finger
            ? `The sensor reads out of range, so the watch asks ${first} for a fingerstick test before anyone else is told.`
            : `The watch asks ${first} a quick yes or no question to confirm the sensor before anyone else is told.`,
          told: ['watch'],
        });
      } else if (st === 1) {
        beats.push({ who: id, tone: 1, title, text: `Yellow and a light vibration on ${first}'s watch only. Small changes stay private.`, told: ['watch'] });
      } else if (st === 2) {
        beats.push({
          who: id,
          tone: 2,
          title,
          text: `The watch turns orange and vibrates strongly. The medical officer's tablet is notified; the commander sees only "Medical review". The cabin screen stays quiet.`,
          told: ['watch', 'cmo'],
        });
      } else {
        beats.push({
          who: id,
          tone: 3,
          title,
          text: `The watch goes red. The cabin screen shows an event card with name, location and first actions for the whole crew. Flight surgeons on Earth are told after a ${delayText(state)} signal delay.`,
          told: ['watch', 'cmo', 'cabin', 'earth'],
        });
      }
    }
  }
  if (next.respondedBy && next.respondedBy !== prev.respondedBy) {
    beats.push({
      who: next.respondedBy,
      tone: 'info',
      title: `${CREW_BY_ID[next.respondedBy].name} is responding to ${name}`,
      text: 'The cabin screen shows who is on it, so the rest of the crew can keep working. Each response step is ticked off there.',
      told: ['cmo', 'cabin'],
    });
  }
  if (next.checklistDone && !prev.checklistDone) {
    beats.push({
      who: id,
      tone: 0,
      title: `Response checklist complete for ${name}`,
      text: 'Every step is done. The crew resolves the alert once the crew member is stable.',
      told: ['cmo', 'cabin'],
    });
  }
  return beats;
}

/** Early warning: a reading heading for the next level. */
export function forecastBeat(id: AstronautId, f: Forecast): Beat {
  const name = CREW_BY_ID[id].name;
  return {
    who: id,
    tone: 'trend',
    title: `Early warning · ${name}`,
    text: `${forecastText(f)}. ${f.level >= 2 ? "Shown on the watch and the medical officer's tablet" : 'Shown on the watch'} before the alert, so there is time to act.`,
    told: f.level >= 2 ? ['watch', 'cmo'] : ['watch'],
  };
}

export function solarBeat(on: boolean): Beat {
  return on
    ? {
        who: null,
        tone: 2,
        title: 'Solar particle event',
        text: 'A radiation advisory appears on every screen. Dose rates rise, most for anyone outside the vehicle.',
        told: ['watch', 'cmo', 'cabin'],
      }
    : { who: null, tone: 'info', title: 'Solar particle event over', text: 'The radiation advisory clears.', told: [] };
}

export const forecastKey = (f: Forecast) => `${f.vital}-${f.level}`;

export function messageBeat(m: EarthMessage, profileDelayText: string, replyIn: string): Beat {
  return {
    who: m.from,
    tone: 'info',
    title: `${MESSAGE_LABELS[m.kind]} to Earth about ${CREW_BY_ID[m.about].name}`,
    text: `The signal takes ${profileDelayText} each way, so the flight surgeon's reply is due in about ${replyIn}. The crew keeps acting meanwhile.`,
    told: ['earth'],
  };
}

export function reactionBeat(id: AstronautId, r: ReactionResult): Beat {
  return {
    who: id,
    tone: r.rating === 'alert' ? 0 : r.rating === 'slower' ? 1 : 2,
    title: `${CREW_BY_ID[id].name} took an alertness check · ${RATING_LABELS[r.rating]}`,
    text: `${r.medianMs} ms median reaction time, ${r.lapses} ${r.lapses === 1 ? 'lapse' : 'lapses'}, against a usual ${REACTION_BASELINE_MS[id]} ms. The result stays on the own tablet and goes to the medical officer.`,
    told: ['cmo'],
  };
}

export function replyBeat(m: EarthMessage): Beat {
  return {
    who: null,
    tone: 'info',
    title: `Reply from flight surgeons about ${CREW_BY_ID[m.about].name}`,
    text: replyText(m),
    told: ['cmo'],
  };
}
