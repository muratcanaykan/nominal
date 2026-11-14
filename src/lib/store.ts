// Room store: the same actions work against Firebase (cross-device) or memory (single page).

import type { AstronautId, ProfileId } from '../domain/crew';
import { ackKey, applyPatch, newRoomState, type Patch, type RoomState } from '../domain/room';
import { scenarioPatch, type ScenarioId } from '../domain/scenarios';
import type { Level, VitalId } from '../domain/vitals';

export type RoomStatus = 'connecting' | 'ready' | 'missing' | 'error';

export interface Backend {
  /** Applies a multi-path patch to the room. */
  update(patch: Patch): Promise<void>;
  /** Replaces the whole room (create or reset). */
  reset(state: RoomState): Promise<void>;
  subscribe(listener: (state: RoomState | null, status: RoomStatus, error?: string) => void): () => void;
  /** Clock aligned across devices (server time when available). */
  now(): number;
}

export interface RoomSnapshot {
  state: RoomState | null;
  status: RoomStatus;
  /** Last failed read or write, shown to the user. */
  error?: string;
}

export class RoomStore {
  private state: RoomState | null = null;
  private listeners = new Set<() => void>();
  private snapshot: RoomSnapshot = { state: null, status: 'connecting' };
  private unsub: (() => void) | null;
  private refs = 0;
  private disposeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private backend: Backend) {
    this.unsub = backend.subscribe((state, status, error) => {
      this.state = state;
      this.snapshot = { state, status, error: error ?? (status === 'error' ? this.snapshot.error : undefined) };
      this.emit();
    });
  }

  /** Components that use the store call retain/release; the backend closes shortly after the last release. */
  retain() {
    this.refs++;
    clearTimeout(this.disposeTimer);
  }

  release() {
    this.refs--;
    if (this.refs <= 0) this.disposeTimer = setTimeout(() => this.dispose(), 1500);
  }

  dispose() {
    this.unsub?.();
    this.unsub = null;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  now = () => this.backend.now();

  get current() {
    return this.state;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private write(p: Promise<void>): Promise<void> {
    return p.then(
      () => {
        if (this.snapshot.error) {
          this.snapshot = { ...this.snapshot, error: undefined };
          this.emit();
        }
      },
      (e: unknown) => {
        this.snapshot = { ...this.snapshot, error: e instanceof Error ? e.message : String(e) };
        this.emit();
      },
    );
  }

  private update(patch: Patch) {
    return this.write(this.backend.update(patch));
  }

  // ---- actions ----

  create(profile: ProfileId = 'lunar') {
    return this.write(this.backend.reset(newRoomState(this.now(), profile)));
  }

  /** Clears every scenario and event but keeps the mission clock and profile. */
  resetDemo() {
    const profile = this.state?.profile ?? 'lunar';
    return this.write(this.backend.reset(newRoomState(this.state?.createdAt ?? this.now(), profile)));
  }

  setProfile(profile: ProfileId) {
    return this.update({ profile });
  }

  runScenario(id: AstronautId, scenario: ScenarioId) {
    return this.update({
      ...scenarioPatch(id, scenario, this.now()),
      [`help/${id}`]: null,
      [`glucoseChecks/${id}`]: null,
    });
  }

  requestHelp(id: AstronautId) {
    return this.update({ [`help/${id}`]: { at: this.now() }, [`claims/${id}`]: null });
  }

  cancelHelp(id: AstronautId) {
    return this.update({ [`help/${id}`]: null, [`claims/${id}`]: null });
  }

  claim(id: AstronautId, by: AstronautId) {
    return this.update({ [`claims/${id}`]: { by, at: this.now() } });
  }

  /** Closes a crew alert: clears the help request, the claim and the astronaut's scenario. */
  resolve(id: AstronautId) {
    return this.update({
      ...scenarioPatch(id, 'nominal', this.now()),
      [`help/${id}`]: null,
      [`glucoseChecks/${id}`]: null,
    });
  }

  acknowledge(id: AstronautId, vital: VitalId, level: Level) {
    return this.update({ [`acks/${id}/${ackKey(vital, level)}`]: this.now() });
  }

  acknowledgeAdvisory(id: AstronautId, level: Level) {
    return this.update({ [`acks/${id}/radiation-${level}`]: this.now() });
  }

  askMood(id: AstronautId) {
    return this.update({ [`moodPrompts/${id}`]: { at: this.now() } });
  }

  submitMood(id: AstronautId, value: number) {
    return this.update({ [`moods/${id}`]: { value, at: this.now() }, [`moodPrompts/${id}`]: null });
  }

  submitGlucoseCheck(id: AstronautId, value: number) {
    return this.update({ [`glucoseChecks/${id}`]: { value, at: this.now() } });
  }

  simulateSolarEvent(on: boolean) {
    return this.update({ 'spaceWeather/sepAt': on ? this.now() : null });
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
