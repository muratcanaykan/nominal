// Vehicle map for the cabin screen: where each crew member is right now. Locations and crew alerts only; never a
// health value. The same layout is drawn on the cabin screen inside the 3D vehicle.

import { CREW, type AstronautId } from '../domain/crew';
import { LOCATION_IDS, locationOf, type LocationId } from '../domain/locations';
import type { RoomState } from '../domain/room';
import { CREW_COLORS } from './Avatar';

export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

/** Map layout in a 600 × 170 box: the spacewalk area above the modules, airlock — habitat — lab below. */
export const MAP_ZONES: Record<LocationId, Zone> = {
  eva: { x: 10, y: 8, w: 580, h: 62, label: 'Outside · spacewalk' },
  airlock: { x: 10, y: 92, w: 118, h: 62, label: 'Airlock' },
  habitat: { x: 148, y: 84, w: 226, h: 78, label: 'Habitat' },
  lab: { x: 394, y: 84, w: 196, h: 78, label: 'Lab' },
};

export interface MapMarker {
  id: AstronautId;
  callsign: string;
  x: number;
  y: number;
  color: string;
}

/** Marker positions: crew members spread evenly across their zone. */
export function mapMarkers(state: RoomState | null | undefined): MapMarker[] {
  const byZone: Record<LocationId, AstronautId[]> = { eva: [], airlock: [], habitat: [], lab: [] };
  for (const a of CREW) byZone[locationOf(state, a.id)].push(a.id);
  const out: MapMarker[] = [];
  for (const loc of LOCATION_IDS) {
    const z = MAP_ZONES[loc];
    byZone[loc].forEach((id, i, all) => {
      const a = CREW.find((c) => c.id === id)!;
      out.push({
        id,
        callsign: a.callsign,
        x: z.x + ((i + 1) * z.w) / (all.length + 1),
        y: z.y + z.h / 2 + 2,
        color: CREW_COLORS[id],
      });
    });
  }
  return out;
}

export function CrewMap({ state, alerting, offline }: { state: RoomState | null | undefined; alerting: Set<AstronautId>; offline: Set<AstronautId> }) {
  const markers = mapMarkers(state);
  return (
    <svg className="crew-map" viewBox="0 0 600 170" role="img" aria-label="Crew locations in the vehicle">
      {LOCATION_IDS.map((loc) => {
        const z = MAP_ZONES[loc];
        return (
          <g key={loc} className={`crew-map__zone crew-map__zone--${loc}`}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={loc === 'eva' ? 14 : 20} />
            <text x={z.x + 12} y={z.y + 17}>
              {z.label}
            </text>
          </g>
        );
      })}
      <line className="crew-map__link" x1={128} y1={123} x2={148} y2={123} />
      <line className="crew-map__link" x1={374} y1={123} x2={394} y2={123} />
      {markers.map((m) => (
        <g
          key={m.id}
          className={`crew-map__crew${alerting.has(m.id) ? ' is-alert' : ''}${offline.has(m.id) ? ' is-offline' : ''}`}
          style={{ transform: `translate(${m.x}px, ${m.y}px)` }}
        >
          {alerting.has(m.id) && <circle className="crew-map__ring" r={15} />}
          <circle r={10} fill={offline.has(m.id) ? '#64748b' : m.color} />
          <text y={25}>{m.callsign}</text>
          <title>{`${m.callsign}${alerting.has(m.id) ? ' · needs help' : ''}${offline.has(m.id) ? ' · no data' : ''}`}</title>
        </g>
      ))}
    </svg>
  );
}
