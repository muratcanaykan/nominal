// Narrator captions on the live demo page: what just happened and who was told.

import { AnimatePresence, motion } from 'motion/react';
import { TOLD_LABELS, TOLD_ORDER, type Told, type Tone } from '../domain/narrator';
import type { NarratedBeat } from '../lib/useNarrator';
import { Avatar } from './Avatar';
import { icons } from './icons';

export function toneClass(t: Tone): string {
  if (t === 'trend') return 'is-trend';
  if (t === 'info') return 'is-info';
  return `lvl-${t}`;
}

/** "Own watch ✓ · Medical officer ✓ · Cabin screen – · Earth –" */
export function ToldRow({ told }: { told: Told[] }) {
  return (
    <ul className="told" aria-label="Who is told">
      {TOLD_ORDER.map((t) => {
        const on = told.includes(t);
        return (
          <li key={t} className={on ? 'is-on' : ''}>
            <span aria-hidden="true">{on ? '✓' : '–'}</span>
            {TOLD_LABELS[t]}
            <span className="sr-only">{on ? ': told' : ': not told'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function NarratorFeed({ beats, onDismiss }: { beats: NarratedBeat[]; onDismiss: (key: number) => void }) {
  return (
    <div className="narrator" role="log" aria-live="polite" aria-label="What just happened">
      <AnimatePresence initial={false}>
        {beats.map((b) => (
          <motion.article
            key={b.key}
            layout
            className={`narr ${toneClass(b.tone)}`}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <span className="narr__who">{b.who ? <Avatar id={b.who} size={30} /> : <span className="narr__icon">{icons.sun}</span>}</span>
            <div className="narr__body">
              <strong>{b.title}</strong>
              <p>{b.text}</p>
              {b.told.length > 0 && <ToldRow told={b.told} />}
            </div>
            <button className="narr__close" aria-label="Dismiss" onClick={() => onDismiss(b.key)}>
              ✕
            </button>
            <span className="narr__timer" aria-hidden="true" />
          </motion.article>
        ))}
      </AnimatePresence>
    </div>
  );
}
