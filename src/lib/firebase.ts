// Firebase Realtime Database backend: every screen in the same room sees each action instantly.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, onValue, ref, set, update, type Database } from 'firebase/database';
import type { Patch, RoomState } from '../domain/room';
import type { Backend, RoomStatus } from './store';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.databaseURL);

let app: FirebaseApp | undefined;
let db: Database | undefined;
let authReady: Promise<unknown> | undefined;
let serverOffset = 0;

function init() {
  if (!firebaseConfigured) throw new Error('Firebase is not configured. Copy .env.example to .env.local.');
  if (!app) {
    app = initializeApp(config);
    db = getDatabase(app);
    authReady = signInAnonymously(getAuth(app));
    onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      serverOffset = Number(snap.val()) || 0;
    });
  }
  return { db: db!, authReady: authReady! };
}

export const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;

/** Six characters without look-alikes (0/O, 1/I), easy to read aloud or type. */
export function newRoomId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export class FirebaseBackend implements Backend {
  private path: string;

  constructor(roomId: string) {
    this.path = `rooms/${roomId}`;
  }

  now() {
    return Date.now() + serverOffset;
  }

  async update(patch: Patch) {
    const { db, authReady } = init();
    await authReady;
    await update(ref(db, this.path), patch);
  }

  async reset(state: RoomState) {
    const { db, authReady } = init();
    await authReady;
    await set(ref(db, this.path), state);
  }

  subscribe(listener: (state: RoomState | null, status: RoomStatus) => void) {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    listener(null, 'connecting');
    try {
      const { db, authReady } = init();
      authReady
        .then(() => {
          if (cancelled) return;
          unsub = onValue(
            ref(db, this.path),
            (snap) => {
              const val = snap.val() as RoomState | null;
              listener(val, val ? 'ready' : 'missing');
            },
            () => listener(null, 'error'),
          );
        })
        .catch(() => listener(null, 'error'));
    } catch {
      listener(null, 'error');
    }
    return () => {
      cancelled = true;
      unsub?.();
    };
  }
}
