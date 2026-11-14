// Connects a page to a Firebase room and handles the loading, missing and error states.

import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { newRoomState } from '../domain/room';
import { FirebaseBackend, firebaseConfigured, ROOM_ID_PATTERN } from './firebase';
import { RoomStore } from './store';
import { RoomContext, useRoom } from './useRoom';

export function useRoomId(): string {
  const { roomId = '' } = useParams();
  return roomId.toUpperCase();
}

/** Creates a room in Firebase and returns its id. */
export async function createRoom(id: string): Promise<void> {
  const backend = new FirebaseBackend(id);
  await backend.reset(newRoomState(backend.now(), 'lunar'));
}

function Gate({ children }: { children: ReactNode }) {
  const { status, error } = useRoom();
  const roomId = useRoomId();
  const navigate = useNavigate();

  if (status === 'ready') {
    return (
      <>
        {children}
        {error && (
          <div className="sync-error" role="alert">
            Changes are not syncing: {error}
          </div>
        )}
      </>
    );
  }

  let title = 'Connecting to the mission…';
  let body: ReactNode = null;
  if (status === 'missing') {
    title = `Demo room ${roomId} does not exist`;
    body = (
      <div className="gate__actions">
        <button
          className="btn-primary"
          onClick={async () => {
            await createRoom(roomId);
            navigate(0);
          }}
        >
          Create room {roomId}
        </button>
        <Link className="btn-secondary" to="/">
          Start a new demo
        </Link>
      </div>
    );
  }
  if (status === 'error') {
    title = 'Live sync is not available';
    body = <p className="gate__detail">{error ?? 'Unknown error.'}</p>;
  }
  return (
    <div className="gate" role="status">
      <h1>{title}</h1>
      {body}
    </div>
  );
}

/** Wraps a room page: one store per room id, shared by everything on the page. */
export function RoomRoute({ children }: { children: ReactNode }) {
  const roomId = useRoomId();
  const valid = ROOM_ID_PATTERN.test(roomId);
  const store = useMemo(() => (valid && firebaseConfigured ? new RoomStore(new FirebaseBackend(roomId)) : null), [roomId, valid]);

  useEffect(() => {
    if (!store) return;
    store.retain();
    return () => store.release();
  }, [store]);

  if (!store) {
    return (
      <div className="page">
        <div className="gate" role="alert">
          <h1>{valid ? 'Live sync is not configured' : `"${roomId}" is not a valid room code`}</h1>
          <Link className="btn-secondary" to="/">
            Back to start
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RoomContext.Provider value={store}>
      <div className="page">
        <Gate>{children}</Gate>
      </div>
    </RoomContext.Provider>
  );
}
