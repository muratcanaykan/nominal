import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect } from 'react';
import type { Status } from '../domain/vitals';

export type Variant = 'mission' | 'glass' | 'suit';

export const levelClass = (s: Status) => `lvl-${s}`;

/** A number that glides to its new value instead of jumping. */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: 'easeOut' });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className="num">{text}</motion.span>;
}

export function HeartIcon({ bpm, still }: { bpm: number; still?: boolean }) {
  return (
    <svg
      className={`heart${still ? '' : ' heart--beat'}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ ['--beat' as string]: `${(60 / Math.max(30, bpm)).toFixed(3)}s` }}
    >
      <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 10.5v6.5M12 7.2v.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function SignalOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M3 18h2M8 18v-3M13 18V11M18 18V7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 4l18 16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Short indicator label; renders the "2" of SpO2 as a subscript so it works in every font. */
export function ShortLabel({ text }: { text: string }) {
  if (text === 'SpO2') {
    return (
      <>
        SpO<sub className="sub">2</sub>
      </>
    );
  }
  return <>{text}</>;
}

export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDelay(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}
