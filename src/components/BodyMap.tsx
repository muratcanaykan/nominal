// Front-view body map: each region takes the colour of its worst reading, and dots show where the sensors sit.
// The crew member's left side is on the viewer's right, as in a medical chart.

import { useState } from 'react';
import { REGION_LABELS, type BodyRegion } from '../domain/body';
import { regionStates } from '../domain/bodymap';
import type { RoomState } from '../domain/room';
import type { Snapshot } from '../domain/sim';
import { isSuited } from '../domain/locations';
import { LEVEL_NAMES, VITALS } from '../domain/vitals';
import { LevelMark, levelClass } from './bits';
import { readingNote, readingValue } from './health';
import { RegionDetails, RegionSheet } from './RegionDetails';

type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; rotate?: [number, number, number] }
  | { kind: 'circle'; cx: number; cy: number; r: number };

const SHAPES: Record<BodyRegion, Shape> = {
  head: { kind: 'ellipse', cx: 70, cy: 26, rx: 16, ry: 18 },
  chest: { kind: 'rect', x: 47, y: 50, w: 46, h: 70, r: 14 },
  rightShoulder: { kind: 'circle', cx: 41, cy: 58, r: 10 },
  leftShoulder: { kind: 'circle', cx: 99, cy: 58, r: 10 },
  rightArm: { kind: 'rect', x: 23, y: 66, w: 14, h: 54, r: 7, rotate: [10, 30, 66] },
  leftArm: { kind: 'rect', x: 103, y: 66, w: 14, h: 54, r: 7, rotate: [-10, 110, 66] },
  rightHand: { kind: 'circle', cx: 21, cy: 128, r: 9 },
  leftHand: { kind: 'circle', cx: 119, cy: 128, r: 9 },
  rightLeg: { kind: 'rect', x: 50, y: 124, w: 18, h: 100, r: 9 },
  leftLeg: { kind: 'rect', x: 72, y: 124, w: 18, h: 100, r: 9 },
};

const REGION_ORDER = Object.keys(SHAPES) as BodyRegion[];

function RegionShape({ shape }: { shape: Shape }) {
  if (shape.kind === 'ellipse') return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />;
  if (shape.kind === 'circle') return <circle cx={shape.cx} cy={shape.cy} r={shape.r} />;
  return (
    <rect
      x={shape.x}
      y={shape.y}
      width={shape.w}
      height={shape.h}
      rx={shape.r}
      transform={shape.rotate ? `rotate(${shape.rotate.join(' ')})` : undefined}
    />
  );
}

/** Sensor positions: always worn (watch, temperature patch, glucose sensor) and suit-only. */
const BODY_SENSORS = [
  { x: 115, y: 116, label: 'Watch' },
  { x: 70, y: 72, label: 'Temperature patch' },
  { x: 109, y: 80, label: 'Glucose sensor' },
];
const SUIT_SENSORS = [
  { x: 70, y: 12, label: 'Helmet CO₂ and water sensors' },
  { x: 21, y: 128, label: 'Glove sensor' },
  { x: 119, y: 128, label: 'Glove sensor' },
  { x: 41, y: 58, label: 'Shoulder pressure sensor' },
  { x: 99, y: 58, label: 'Shoulder pressure sensor' },
];

/**
 * Regions are clickable. The full panel shows the region details beside the map; compact maps call `onRegion` (or,
 * without it, open the details in a window).
 */
export function BodyMap({
  s,
  state,
  compact,
  onRegion,
  selected,
}: {
  s: Snapshot;
  state: RoomState | undefined;
  compact?: boolean;
  onRegion?: (region: BodyRegion) => void;
  selected?: BodyRegion | null;
}) {
  const [own, setOwn] = useState<BodyRegion | null>(null);
  const active = selected !== undefined ? selected : own;
  const pick = (region: BodyRegion) => {
    if (onRegion) onRegion(region);
    else setOwn((cur) => (cur === region ? null : region));
  };
  const regions = regionStates(s, state);
  const suited = isSuited(state, s.astronautId);
  const sensors = suited ? [...BODY_SENSORS, ...SUIT_SENSORS] : BODY_SENSORS;
  const findings = REGION_ORDER.flatMap((region) =>
    (regions[region]?.readings ?? []).filter((r) => r.level > 0).map((r) => ({ region, r })),
  );

  const map = (
    <svg className={`bodymap${compact ? ' bodymap--compact' : ''}`} viewBox="0 0 140 232" role="group" aria-label="Body map: click a region for details">
      {suited && <ellipse className="bodymap__helmet" cx="70" cy="26" rx="23" ry="25" />}
      {REGION_ORDER.map((region) => {
        const st = regions[region];
        const level = s.connected ? (st?.level ?? 0) : 'nodata';
        return (
          <g
            key={region}
            className={`bodymap__region ${levelClass(level)}${st && st.level > 0 ? ' is-alert' : ''}${active === region ? ' is-selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${REGION_LABELS[region]}${st && st.level > 0 ? `, ${LEVEL_NAMES[st.level]}` : ''}: show details`}
            onClick={(e) => {
              e.stopPropagation();
              pick(region);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pick(region);
              }
            }}
          >
            <title>
              {REGION_LABELS[region]}
              {st && st.level > 0 ? ` · ${LEVEL_NAMES[st.level]}` : ''}
            </title>
            <RegionShape shape={SHAPES[region]} />
          </g>
        );
      })}
      {sensors.map((p, i) => (
        <circle key={i} className="bodymap__sensor" cx={p.x} cy={p.y} r="2.6">
          <title>{p.label}</title>
        </circle>
      ))}
      <text className="bodymap__side" x="6" y="12">
        R
      </text>
      <text className="bodymap__side" x="128" y="12">
        L
      </text>
    </svg>
  );

  if (compact) {
    return (
      <>
        {map}
        {!onRegion && own && <RegionSheet region={own} s={s} state={state} onClose={() => setOwn(null)} />}
      </>
    );
  }

  return (
    <div className="bodymap-panel">
      {map}
      {active ? (
        <div className="bodymap-panel__text">
          <RegionDetails region={active} s={s} state={state} onClose={() => (onRegion ? onRegion(active) : setOwn(null))} />
        </div>
      ) : (
      <div className="bodymap-panel__text">
        <h3>Body map</h3>
        <p className="bodymap-panel__tip">Click a region to see what it does, how spaceflight affects it and what to do.</p>
        {!s.connected ? (
          <p>No data from the sensors.</p>
        ) : findings.length === 0 ? (
          <p>No region needs attention.</p>
        ) : (
          <ul className="bodymap-findings">
            {findings.map(({ region, r }) => (
              <li key={`${region}-${r.id}`} className={levelClass(r.level)}>
                <strong>
                  <LevelMark status={r.level} /> {REGION_LABELS[region]}
                </strong>
                <span>
                  {VITALS[r.id].label} {readingValue(r)} {VITALS[r.id].unit} · {LEVEL_NAMES[r.level]}
                  {readingNote(r, state, s.astronautId) ? ` (${readingNote(r, state, s.astronautId)})` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="bodymap-panel__legend">
          <span className="bodymap-panel__dot" aria-hidden="true" />
          {suited
            ? 'In the spacesuit: watch, temperature patch, glucose sensor, and suit sensors in the helmet, gloves and shoulders.'
            : 'Inside the vehicle: smart shirt under the coverall (heart and breathing), watch, temperature patch and glucose sensor. Suit sensors report only while suited.'}
        </p>
      </div>
      )}
    </div>
  );
}
