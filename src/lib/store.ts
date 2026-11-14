// Room store: the same actions work against Firebase (cross-device) or memory (single page).

import type { AstronautId } from '../domain/crew';
import { ackKey, applyPatch, newRoomState, type Patch, type RoomState } from '../domain/room';
import { scenarioPatch, type ScenarioId } from '../domain/scenarios';
import type { Level, VitalId } from '../domain/vitals';

export type RoomStatus = 'connecting' | 'ready' | 'missing' | 'error';

export interface Backend {
  /** Applies a multi-path patch to the room. */
  update(patch: Patch): Promise<void>;
  /** Replaces the whole room (create or reset). */
  reset(state: RoomState): Promise<void>;
  subscribe(listener: (state: RoomState | null, status: RoomStatus) => void): () => void;
  /** Clock aligned across devices (server time when available). */
  now(): number;
}

export class RoomStore {
  private state: RoomState | null = null;
  private listeners = new Set<() => void>();
  private snapshot: { state: RoomState | null; status: RoomStatus } = { state: null, status: 'connecting' };
  private unsub: () => void;

  constructor(private backend: Backend) {
    this.unsub = backend.subscribe((state, status) => {
      this.state = state;
      this.snapshot = { state, status };
      this.listeners.forEach((l) => l());
    });
  }

  dispose() {
    this.unsub();
    this.listeners.clear();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  now = () => this.backend.now();

  get current() {
    return this.state;
  }

  // ---- actions ----

  create(profile: RoomState['profile'] = 'lunar') {
    return this.backend.reset(newRoomState(this.now(), profile));
  }

  resetDemo() {
    const profile = this.state?.profile ?? 'lunar';
    return this.backend.reset({ ...newRoomState(this.state?.createdAt ?? this.now(), profile) });
  }

  setProfile(profile: RoomState['profile']) {
    return this.backend.update({ profile });
  }

  runScenario(id: AstronautId, scenario: ScenarioId) {
    return this.backend.update({ ...scenarioPatch(id, scenario, this.now()), [`help/${id}`]: null });
  }

  requestHelp(id: AstronautId) {
    return this.backend.update({ [`help/${id}`]: { at: this.now() }, [`claims/${id}`]: null });
  }

  cancelHelp(id: AstronautId) {
    return this.backend.update({ [`help/${id}`]: null, [`claims/${id}`]: null });
  }

  claim(id: AstronautId, by: AstronautId) {
    return this.backend.update({ [`claims/${id}`]: { by, at: this.now() } });
  }

  /** Closes a crew alert: clears the help request, the claim and the astronaut's scenario. */
  resolve(id: AstronautId) {
    return this.backend.update({ ...scenarioPatch(id, 'nominal', this.now()), [`help/${id}`]: null });
  }

  acknowledge(id: AstronautId, vital: VitalId, level: Level) {
    return this.backend.update({ [`acks/${id}/${ackKey(vital, level)}`]: this.now() });
  }

  submitMood(id: AstronautId, value: number) {
    return this.backend.update({ [`moods/${id}`]: { value, at: this.now() } });
  }
}

/** In-memory backend for single-page previews and tests. */
export class MemoryBackend implements Backend {
  private state: RoomState;
  private listeners = new Set<(s: RoomState | null, st: RoomStatus) => void>();

  constructor(initial?: RoomState, private clock: () => number = Date.now) {
    this.state = initial ?? newRoomState(clock());
  }

  now() {
    return this.clock();
  }

  async update(patch: Patch) {
    this.state = applyPatch(this.state, patch);
    this.emit();
  }

  async reset(state: RoomState) {
    this.state = state;
    this.emit();
  }

  subscribe(listener: (s: RoomState | null, st: RoomStatus) => void) {
    this.listeners.add(listener);
    listener(this.state, 'ready');
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l(this.state, 'ready'));
  }
}
