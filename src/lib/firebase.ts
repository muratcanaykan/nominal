// Firebase Realtime Database backend: every screen in the same room sees each action instantly.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, onValue, ref, set, update, type Database } from 'firebase/database';
import { withoutUndefined, type Patch, type RoomState } from '../domain/room';
import { isNetworkError, syncErrorMessage, withRetry } from './retry';
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
let authPromise: Promise<void> | undefined;
let serverOffset = 0;

/** Waits 1, 2 and 4 seconds between sign-in attempts when the network fails. */
const SIGN_IN_RETRY_MS = [1000, 2000, 4000];

async function signIn(a: FirebaseApp) {
  const auth = getAuth(a);
  await auth.authStateReady();
  if (auth.currentUser) return;
  await withRetry(() => signInAnonymously(auth), SIGN_IN_RETRY_MS, isNetworkError);
}

/** Signs in once per page; after a failure, the next call starts a fresh attempt instead of reusing the error. */
function ensureAuth(a: FirebaseApp): Promise<void> {
  if (!authPromise) {
    authPromise = signIn(a);
    authPromise.catch(() => {
      authPromise = undefined;
    });
  }
  return authPromise;
}

function init() {
  if (!firebaseConfigured) throw new Error('Firebase is not configured. Copy .env.example to .env.local.');
  if (!app) {
    app = initializeApp(config);
    db = getDatabase(app);
    onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      serverOffset = Number(snap.val()) || 0;
    });
  }
  return { db: db!, authReady: ensureAuth(app) };
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
    await update(ref(db, this.path), withoutUndefined(patch));
  }

  async reset(state: RoomState) {
    const { db, authReady } = init();
    await authReady;
    await set(ref(db, this.path), withoutUndefined(state));
  }

  subscribe(listener: (state: RoomState | null, status: RoomStatus, error?: string) => void) {
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
            (e) => listener(null, 'error', `Sync read failed: ${e.message}`),
          );
        })
        .catch((e: unknown) => listener(null, 'error', syncErrorMessage(e)));
    } catch (e) {
      listener(null, 'error', e instanceof Error ? e.message : String(e));
    }
    return () => {
      cancelled = true;
      unsub?.();
    };
  }
}
