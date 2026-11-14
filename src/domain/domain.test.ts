import { describe, expect, it } from 'vitest';
import { MemoryBackend, RoomStore } from '../lib/store';
import { applyPatch, newRoomState } from './room';
import { crewSummary, snapshot, valueAt } from './sim';
import { levelFor, routingFor } from './vitals';

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

describe('applyPatch', () => {
  it('sets nested paths and deletes with null', () => {
    const s = applyPatch({ a: { b: 1, c: 2 } }, { 'a/b': null, 'x/y/z': 3 });
    expect(s).toEqual({ a: { c: 2 }, x: { y: { z: 3 } } });
    expect(applyPatch({ a: { b: 1 } }, { 'a/b': null })).toEqual({});
  });
});
