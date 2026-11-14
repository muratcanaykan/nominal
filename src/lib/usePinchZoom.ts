// Two-finger pinch zoom for the 3D views on touch screens. It changes the same zoom value as the wheel and the + / -
// buttons: fingers apart zooms in, together zooms out.

import { useEffect, type RefObject } from 'react';

/** Camera distance multiplier limits: 1 is the default framing, smaller is closer. */
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 2.4;
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function usePinchZoom(ref: RefObject<HTMLElement | null>, zoom: { current: number }) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const points = new Map<number, { x: number; y: number }>();
    let startDistance = 0;
    let startZoom = 1;
    const distance = () => {
      const [a, b] = [...points.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        startDistance = distance();
        startZoom = zoom.current;
      }
    };
    const move = (e: PointerEvent) => {
      if (!points.has(e.pointerId)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2 && startDistance > 0) {
        const d = distance();
        if (d > 0) zoom.current = clampZoom((startZoom * startDistance) / d);
      }
    };
    const up = (e: PointerEvent) => {
      points.delete(e.pointerId);
      if (points.size < 2) startDistance = 0;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [ref, zoom]);
}
