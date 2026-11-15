// Room store: the same actions work against Firebase (cross-device) or memory (single page).

import type { PainSite } from '../domain/body';
import type { AstronautId, ProfileId } from '../domain/crew';
import type { LocationId } from '../domain/locations';
import { ackKey, applyPatch, findUndefined, newRoomState, type Patch, type RoomState } from '../domain/room';
import { composeMessage, type MessageKind } from '../domain/earth';
import { scoreReaction } from '../domain/reaction';
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

  runScenario(id: AstronautId, scenario: ScenarioId, rampMs?: number) {
    return this.update({
      ...scenarioPatch(id, scenario, this.now(), rampMs),
      [`help/${id}`]: null,
      [`glucoseChecks/${id}`]: null,
    });
  }

  requestHelp(id: AstronautId) {
    return this.update({ [`help/${id}`]: { at: this.now() }, [`claims/${id}`]: null, [`checklists/${id}`]: null });
  }

  cancelHelp(id: AstronautId) {
    return this.update({ [`help/${id}`]: null, [`claims/${id}`]: null, [`checklists/${id}`]: null });
  }

  claim(id: AstronautId, by: AstronautId) {
    return this.update({ [`claims/${id}`]: { by, at: this.now() } });
  }

  /**
   * Ticks or unticks a response step on the cabin screen; the first tick also marks `by` as responding. Ticking the
   * "update Earth" step sends a status update to the flight surgeons.
   */
  checkStep(id: AstronautId, step: string, by: AstronautId, done: boolean) {
    const now = this.now();
    const patch: Patch = { [`checklists/${id}/${step}`]: done ? { by, at: now } : null };
    if (done && !this.state?.claims?.[id]) patch[`claims/${id}`] = { by, at: now };
    if (done && step === 'earth') {
      // The update includes this tick in its checklist count.
      const after = applyPatch(this.state ?? newRoomState(now), patch);
      patch[`messages/${now}-${by}`] = composeMessage(after, by, id, 'status', now);
    }
    return this.update(patch);
  }

  /** Saves a finished alertness check (reaction test). */
  submitReaction(id: AstronautId, times: number[], falseStarts: number) {
    return this.update({ [`reactions/${id}`]: scoreReaction(id, times, falseStarts, this.now()) });
  }

  /** Moves Earth messages to the archive, or back. */
  archiveEarth(ids: string[], archived: boolean) {
    const now = this.now();
    return this.update(Object.fromEntries(ids.map((id) => [`messages/${id}/archived`, archived ? now : null])));
  }

  /** Sends a message about a crew member to the flight surgeons on Earth. */
  sendEarth(from: AstronautId, about: AstronautId, kind: MessageKind) {
    const now = this.now();
    return this.update({ [`messages/${now}-${from}`]: composeMessage(this.state ?? undefined, from, about, kind, now) });
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

  /** Moves one indicator toward a value (simulation sliders). */
  setVital(id: AstronautId, vital: VitalId, target: number) {
    return this.update({ [`overrides/${id}/${vital}`]: { target, startAt: this.now(), rampMs: 1500 } });
  }

  setLocation(id: AstronautId, location: LocationId) {
    return this.update({ [`locations/${id}`]: location });
  }

  /** Answer to a sensor's symptom question on the watch, such as "Do your fingers feel numb?". */
  answerSymptom(id: AstronautId, vital: VitalId, yes: boolean) {
    return this.update({ [`symptomChecks/${id}/${vital}`]: { yes, at: this.now() } });
  }

  reportPain(id: AstronautId, site: PainSite, value: number) {
    return this.update({
      [`reports/${id}/jointPain`]: { value, site, at: this.now() },
      [`acks/${id}/${ackKey('jointPain', 1)}`]: null,
      [`acks/${id}/${ackKey('jointPain', 2)}`]: null,
    });
  }

  clearPain(id: AstronautId) {
    return this.update({ [`reports/${id}/jointPain`]: null });
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
    // Same rule as Firebase, so tests catch writes it would reject.
    const bad = findUndefined(patch);
    if (bad) throw new Error(`update failed: values argument contains undefined in property '${bad}'`);
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
