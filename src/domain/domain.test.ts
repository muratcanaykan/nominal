import { describe, expect, it } from 'vitest';
import { MemoryBackend, RoomStore } from '../lib/store';
import { applyPatch, newRoomState } from './room';
import { crewSummary, MOOD_MISSED_MS, moodDue, moodPromptStart, snapshot, valueAt } from './sim';
import { levelFor, routingFor } from './vitals';
import { radiationAdvisory } from '../data/spaceWeather';
import { dutyStatus, seesCrewStatus, tabletViews } from './roles';
import { forecast } from './forecast';
import { dose } from './radiation';
import { personBeats, personView } from './narrator';
import { scenarioPatch } from './scenarios';
import { checklistProgress, responseChecklist } from './response';
import { ANSWER_MS, composeMessage, earthMessages, replyAt, replyText, stageOf } from './earth';
import { isNetworkError, syncErrorMessage, withRetry } from '../lib/retry';

describe('levelFor', () => {
  it('maps values to nested threshold bands', () => {
    expect(levelFor('spo2', 98)).toBe(0);
    expect(levelFor('spo2', 93)).toBe(1);
    expect(levelFor('spo2', 90)).toBe(2);
    expect(levelFor('spo2', 85)).toBe(3);
    expect(levelFor('glucose', 60)).toBe(1);
    expect(levelFor('glucose', 50)).toBe(2);
  });

  it('caps sleep and mood at level 2', () => {
    expect(levelFor('sleep', 3)).toBe(2);
    expect(levelFor('mood', 1)).toBe(2);
  });
});

describe('routing', () => {
  it('only level 3 reaches the cabin and Earth', () => {
    expect(routingFor(2)).toMatchObject({ cmo: true, cabin: false, earth: false });
    expect(routingFor(3)).toMatchObject({ cmo: true, cabin: true, earth: true });
  });
});

describe('simulation', () => {
  it('is deterministic for the same time', () => {
    expect(valueAt('01', 'heartRate', 123456789)).toBe(valueAt('01', 'heartRate', 123456789));
  });

  it('stays nominal without scenarios', () => {
    const state = newRoomState(0);
    for (let t = 0; t < 600_000; t += 7_000) {
      for (const id of ['01', '02', '03', '04'] as const) {
        expect(snapshot(state, id, t).worst).toBe(0);
      }
    }
  });
});

describe('room store', () => {
  it('a critical scenario reaches the cabin, a warning does not', async () => {
    let now = 1_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    await store.runScenario('02', 'warning');
    now += 10_000;
    expect(snapshot(store.current!, '02', now).worst).toBe(2);
    expect(crewSummary(store.current!, now).alerts).toHaveLength(0);

    await store.runScenario('02', 'critical');
    now += 10_000;
    const summary = crewSummary(store.current!, now);
    expect(summary.alerts).toHaveLength(1);
    expect(summary.alerts[0]).toMatchObject({ astronautId: '02', kind: 'critical' });
  });

  it('acknowledging hides a warning but never a critical alert', async () => {
    let now = 2_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    await store.runScenario('01', 'warning');
    now += 10_000;
    const s = snapshot(store.current!, '01', now);
    await store.acknowledge('01', s.top!.id, s.top!.level);
    expect(snapshot(store.current!, '01', now).alert).toBeUndefined();

    await store.runScenario('01', 'critical');
    now += 10_000;
    const c = snapshot(store.current!, '01', now);
    await store.acknowledge('01', c.top!.id, c.top!.level);
    expect(snapshot(store.current!, '01', now).alert?.level).toBe(3);
  });

  it('a disconnected device reports no data', async () => {
    let now = 3_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    await store.runScenario('04', 'nodata');
    now += 5_000;
    expect(snapshot(store.current!, '04', now).status).toBe('nodata');
    expect(crewSummary(store.current!, now).connected).toBe(3);
  });
});

describe('glucose confirmation', () => {
  it('holds an out-of-range sensor value at watch level until a fingerstick confirms it', async () => {
    let now = 4_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    await store.runScenario('03', 'lowGlucose');
    now += 10_000;
    const g = snapshot(store.current!, '03', now).readings.glucose;
    expect(g).toMatchObject({ pending: true, level: 1, sensorLevel: 1 });

    await store.submitGlucoseCheck('03', 50);
    const c = snapshot(store.current!, '03', now).readings.glucose;
    expect(c).toMatchObject({ confirmed: true, value: 50, level: 2 });
    expect(routingFor(c.level).cmo).toBe(true);
  });
});

describe('mood check-in', () => {
  it('is due after a request and clears once answered', async () => {
    let now = 5_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    expect(moodDue(store.current!, '01', now, 0)).toBe(false);
    await store.askMood('01');
    expect(moodDue(store.current!, '01', now, 0)).toBe(true);
    now += 1000;
    await store.submitMood('01', 2);
    expect(moodDue(store.current!, '01', now, 0)).toBe(false);
    expect(snapshot(store.current!, '01', now).readings.mood.level).toBe(1);
  });
});

describe('applyPatch', () => {
  it('sets nested paths and deletes with null', () => {
    const s = applyPatch({ a: { b: 1, c: 2 } }, { 'a/b': null, 'x/y/z': 3 });
    expect(s).toEqual({ a: { c: 2 }, x: { y: { z: 3 } } });
    expect(applyPatch({ a: { b: 1 } }, { 'a/b': null })).toEqual({});
  });
});

describe('radiation advisory', () => {
  const weather = (time: string) => ({ source: 'test', fetchedAt: time, notifications: [], sep: [{ id: 'x', time, url: 'u' }] });

  it('is active for 72 hours after a DONKI solar particle event', () => {
    const t = Date.parse('2026-11-10T12:00Z');
    expect(radiationAdvisory(newRoomState(0), weather('2026-11-10T12:00Z'), t + 3_600_000)?.source).toBe('donki');
    expect(radiationAdvisory(newRoomState(0), weather('2026-11-10T12:00Z'), t + 73 * 3_600_000)).toBeNull();
  });

  it('can be simulated from the control panel', async () => {
    const now = 6_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    expect(radiationAdvisory(store.current, null, now)).toBeNull();
    await store.simulateSolarEvent(true);
    expect(radiationAdvisory(store.current, null, now)?.source).toBe('simulated');
  });
});

describe('roles', () => {
  it('gives the commander duty status only, and keeps cautions private', async () => {
    let now = 1_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    const duty = (id: '01' | '02' | '03' | '04') => dutyStatus(snapshot(store.current!, id, now), store.current!, now);
    expect(duty('02')).toBe('clear');
    await store.runScenario('02', 'caution');
    now += 10_000;
    expect(duty('02')).toBe('clear');
    await store.runScenario('02', 'warning');
    now += 10_000;
    expect(duty('02')).toBe('medical');
    await store.runScenario('02', 'critical');
    now += 10_000;
    expect(duty('02')).toBe('critical');
    await store.runScenario('04', 'nodata');
    now += 1_000;
    expect(duty('04')).toBe('nodata');
    await store.requestHelp('01');
    expect(duty('01')).toBe('help');
  });

  it('shows crew status to the commander and crew medical only to the medical officer', () => {
    expect(tabletViews('01')).toEqual(['self']);
    expect(seesCrewStatus('01')).toBe(true);
    expect(seesCrewStatus('03')).toBe(false);
    expect(tabletViews('02')).toEqual(['self']);
    expect(tabletViews('03')).toEqual(['self', 'crewMedical']);
    expect(tabletViews('04')).toEqual(['self']);
  });
});

describe('suit sensors', () => {
  const setup = () => {
    const clock = { now: 2_000_000 };
    const store = new RoomStore(new MemoryBackend(newRoomState(clock.now), () => clock.now));
    return { clock, store };
  };

  it('only report while the crew member is suited', async () => {
    const { clock, store } = setup();
    expect(snapshot(store.current!, '01', clock.now).readings.fingerTempL.inactive).toBe(true);
    expect(snapshot(store.current!, '02', clock.now).readings.fingerTempL.inactive).toBeUndefined();
    await store.setLocation('01', 'airlock');
    expect(snapshot(store.current!, '01', clock.now).readings.fingerTempL.inactive).toBeUndefined();
  });

  it('a cold hand waits for the numbness answer before telling the medical officer', async () => {
    const { clock, store } = setup();
    await store.runScenario('02', 'coldHand');
    clock.now += 10_000;
    let r = snapshot(store.current!, '02', clock.now).readings.fingerTempL;
    expect(r).toMatchObject({ level: 1, pending: true, sensorLevel: 2 });
    await store.answerSymptom('02', 'fingerTempL', true);
    clock.now += 1_000;
    r = snapshot(store.current!, '02', clock.now).readings.fingerTempL;
    expect(r).toMatchObject({ level: 2, confirmed: true });
    await store.answerSymptom('02', 'fingerTempL', false);
    clock.now += 1_000;
    r = snapshot(store.current!, '02', clock.now).readings.fingerTempL;
    expect(r).toMatchObject({ level: 1, denied: true });
  });

  it('water in the helmet is critical and reaches the cabin', async () => {
    const { clock, store } = setup();
    await store.runScenario('02', 'helmetWater');
    clock.now += 10_000;
    const summary = crewSummary(store.current!, clock.now);
    expect(summary.snapshots['02'].top?.id).toBe('helmetWater');
    expect(summary.alerts[0]).toMatchObject({ astronautId: '02', kind: 'critical', vital: 'helmetWater' });
  });

  it('joint pain while suited is raised to warning (possible decompression sickness)', async () => {
    const { clock, store } = setup();
    await store.runScenario('01', 'kneePain');
    await store.runScenario('02', 'kneePain');
    clock.now += 1_000;
    expect(snapshot(store.current!, '01', clock.now).readings.jointPain.level).toBe(1);
    expect(snapshot(store.current!, '02', clock.now).readings.jointPain.level).toBe(2);
  });

  it('moving inside the vehicle switches suit alerts off', async () => {
    const { clock, store } = setup();
    await store.runScenario('02', 'helmetCO2');
    clock.now += 10_000;
    expect(snapshot(store.current!, '02', clock.now).readings.helmetCO2.level).toBe(2);
    await store.setLocation('02', 'habitat');
    expect(snapshot(store.current!, '02', clock.now).readings.helmetCO2).toMatchObject({ level: 0, inactive: true });
  });
});

describe('sign-in retry', () => {
  const netError = () => Object.assign(new Error('network'), { code: 'auth/network-request-failed' });
  const noWait = () => Promise.resolve();

  it('retries network failures and then succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw netError();
        return 'ok';
      },
      [1000, 2000, 4000],
      isNetworkError,
      noWait,
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('gives up after the last attempt and does not retry other errors', async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw netError(); }, [1, 1], isNetworkError, noWait)).rejects.toThrow('network');
    expect(calls).toBe(3);
    calls = 0;
    const denied = Object.assign(new Error('denied'), { code: 'auth/operation-not-allowed' });
    await expect(withRetry(async () => { calls++; throw denied; }, [1, 1], isNetworkError, noWait)).rejects.toThrow('denied');
    expect(calls).toBe(1);
    expect(syncErrorMessage(netError())).toMatch(/internet connection/);
  });
});

describe('mood check-in reminders', () => {
  it('knows when the pending check-in started, and clears it once answered', async () => {
    let now = 5_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    await store.askMood('02');
    const asked = now;
    now += MOOD_MISSED_MS + 1_000;
    expect(moodPromptStart(store.current!, '02', now, 0)).toBe(asked);
    expect(now - asked).toBeGreaterThan(MOOD_MISSED_MS);
    await store.submitMood('02', 4);
    expect(moodPromptStart(store.current!, '02', now, 0)).toBeNull();
  });
});

describe('early warning', () => {
  it('does not mistake a sudden jump for a trend', () => {
    for (const sc of ['fever', 'warning', 'helmetCO2', 'coldHand'] as const) {
      for (const id of ['01', '02', '03', '04'] as const) {
        const t0 = 4_000_000;
        let state = newRoomState(0);
        state.locations = { [id]: 'eva' };
        state = applyPatch(state, scenarioPatch(id, sc, t0));
        for (let t = t0; t < t0 + 60_000; t += 500) expect(forecast(state, id, t), `${sc} ${id} at ${t - t0} ms`).toBeNull();
      }
    }
  });

  it('stays quiet without scenarios (sensor noise is not a trend)', () => {
    const state = newRoomState(0);
    state.locations = { '01': 'eva', '03': 'airlock' };
    let hits = 0;
    for (let t = 60_000; t < 2 * 24 * 3600_000; t += 13_000) {
      for (const id of ['01', '02', '03', '04'] as const) if (forecast(state, id, t)) hits++;
    }
    expect(hits).toBe(0);
  });

  it('warns ahead of time when oxygen drops slowly', async () => {
    let now = 9_000_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(now), () => now));
    await store.runScenario('04', 'slowSpo2');
    let first: { at: number; level: number } | null = null;
    let warningAt = Infinity;
    for (let dt = 0; dt <= 150_000; dt += 2_500) {
      const t = now + dt;
      const f = forecast(store.current!, '04', t);
      if (f && f.vital === 'spo2' && f.level === 2 && !first) first = { at: t, level: f.level };
      if (snapshot(store.current!, '04', t).readings.spo2.level >= 2 && warningAt === Infinity) warningAt = t;
    }
    expect(first).not.toBeNull();
    expect(warningAt - first!.at).toBeGreaterThanOrEqual(15_000);
  });
});

describe('radiation dose', () => {
  it('rises on a spacewalk and much more during a solar particle event', () => {
    const now = 3_600_000;
    const state = newRoomState(0);
    const inside = dose(state, '01', now, null);
    const eva = dose(state, '02', now, null);
    const spe = dose(state, '01', now, now - 600_000);
    expect(inside.status).toBe('normal');
    expect(eva.rateUsvH).toBeGreaterThan(inside.rateUsvH);
    expect(spe.status).toBe('high');
    expect(spe.rateUsvH).toBeGreaterThan(eva.rateUsvH);
    expect(spe.missionMsv).toBeGreaterThan(inside.missionMsv);
    expect(inside.careerShare).toBeLessThan(0.1);
  });
});

describe('narrator', () => {
  const view = (state: ReturnType<typeof newRoomState>, now: number) => personView(state, '02', snapshot(state, '02', now), now);

  it('says who is told at each level', () => {
    const quiet = newRoomState(0);
    const before = view(quiet, 1000);
    const warn = applyPatch(quiet, scenarioPatch('02', 'warning', 0));
    const w = personBeats(before, view(warn, 10_000), '02', snapshot(warn, '02', 10_000), warn);
    expect(w).toHaveLength(1);
    expect(w[0].told).toEqual(['watch', 'cmo']);
    const crit = applyPatch(quiet, scenarioPatch('02', 'critical', 0));
    const c = personBeats(before, view(crit, 10_000), '02', snapshot(crit, '02', 10_000), crit);
    expect(c[0].told).toEqual(['watch', 'cmo', 'cabin', 'earth']);
    expect(c[0].title).toContain('Critical');
  });

  it('explains a sensor waiting for confirmation and a lost signal', () => {
    const quiet = newRoomState(0);
    const before = view(quiet, 1000);
    const low = applyPatch(quiet, scenarioPatch('02', 'lowGlucose', 0));
    expect(personBeats(before, view(low, 10_000), '02', snapshot(low, '02', 10_000), low)[0].text).toContain('fingerstick');
    const off = applyPatch(quiet, scenarioPatch('02', 'nodata', 0));
    const n = personBeats(before, view(off, 10_000), '02', snapshot(off, '02', 10_000), off);
    expect(n[0].tone).toBe('nodata');
    expect(n[0].text).toContain('neither healthy nor an emergency');
  });
});

describe('response checklist', () => {
  it('fits the alert and the location, and never names a value', () => {
    const state = applyPatch(newRoomState(0), scenarioPatch('02', 'critical', 0));
    const alert = crewSummary(state, 10_000).alerts.find((a) => a.astronautId === '02')!;
    const steps = responseChecklist(alert, state).map((s) => s.id);
    // Okafor is outside on a spacewalk: radio first, then the airlock.
    expect(steps).toEqual(['reach', 'kit', 'act', 'airlock', 'care', 'earth']);
    expect(responseChecklist(alert, state)[0].text).toContain('suit radio');
    for (const s of responseChecklist(alert, state)) expect(s.text).not.toMatch(/\d+ ?%|bpm|mmHg/);
  });

  it('ticks steps, marks the responder and clears with the alert', async () => {
    const backend = new MemoryBackend(newRoomState(0), () => 10_000);
    const store = new RoomStore(backend);
    await store.runScenario('01', 'critical');
    await store.checkStep('01', 'reach', '04', true);
    await store.checkStep('01', 'kit', '03', true);
    const state = store.current!;
    expect(state.claims?.['01']?.by).toBe('04');
    const alert = crewSummary(state, 20_000).alerts.find((a) => a.astronautId === '01')!;
    expect(checklistProgress(alert, state)).toEqual({ done: 2, total: 5 });
    await store.resolve('01');
    expect(store.current!.checklists?.['01']).toBeUndefined();
  });
});

describe('messages to Earth', () => {
  it('replies only after the round trip and the answer time', () => {
    const lunar = composeMessage(newRoomState(0), '03', '02', 'guidance', 1000);
    expect(stageOf(lunar, 1000 + 1000)).toBe('outbound');
    expect(stageOf(lunar, 1000 + 1300 + ANSWER_MS - 1)).toBe('answering');
    expect(stageOf(lunar, replyAt(lunar))).toBe('replied');
    const mars = composeMessage(newRoomState(0, 'mars'), '03', '02', 'guidance', 1000);
    expect(replyAt(mars) - 1000).toBe(24 * 60_000 + ANSWER_MS);
    expect(replyText(mars)).toContain('Okafor');
  });

  it('sends updates after the alert is resolved, with nothing Firebase would reject', async () => {
    let t = 10_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(0), () => t));
    await store.runScenario('02', 'critical');
    t = 30_000;
    await store.resolve('02');
    t = 40_000;
    for (const kind of ['status', 'guidance', 'clear'] as const) {
      await store.sendEarth('03', '02', kind);
      t += 1000;
    }
    expect(store.getSnapshot().error).toBeUndefined();
    expect(earthMessages(store.current)).toHaveLength(3);
    expect(earthMessages(store.current)[0].text).toContain('all readings in range');
  });

  it('sends a status update when the Earth step of the checklist is ticked', async () => {
    let t = 10_000;
    const store = new RoomStore(new MemoryBackend(newRoomState(0), () => t));
    await store.runScenario('02', 'critical');
    t = 30_000;
    await store.checkStep('02', 'reach', '01', true);
    await store.checkStep('02', 'earth', '01', true);
    const msgs = earthMessages(store.current);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].kind).toBe('status');
    expect(msgs[0].text).toContain('Response checklist 2/6 done');
  });
});
