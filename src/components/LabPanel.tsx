// Lab results: blood tests before launch and after landing (real data, NASA OSDR), one collapsible panel per crew member.

import type { OsdrSubject } from '../domain/crew';
import { labRows, type LabRow } from '../domain/labs';

const fmt = (v: number, d: number) => v.toFixed(d);

/** Seven tests: three before launch, a gap for the flight, four after landing. The shaded band is the lab range. */
function LabChart({ row }: { row: LabRow }) {
  const W = 120;
  const H = 30;
  const pts = row.series;
  const vals = pts.filter((v): v is number => v !== null);
  const [lo, hi] = row.range;
  const min = Math.min(...vals, lo ?? Infinity);
  const max = Math.max(...vals, hi ?? -Infinity);
  const span = max - min || 1;
  const x = (i: number) => 4 + (i < 3 ? i * 14 : 3 * 14 + 16 + (i - 3) * 14);
  const y = (v: number) => H - 4 - ((v - min) / span) * (H - 8);
  const path = (from: number, to: number) =>
    pts
      .slice(from, to)
      .map((v, i) => (v === null ? '' : `${x(from + i)},${y(v)}`))
      .filter(Boolean)
      .join(' ');
  return (
    <svg className="lab-chart" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {lo !== null && (
        <rect x="0" width={W} y={hi !== null ? y(hi) : 0} height={Math.max(1, y(lo) - (hi !== null ? y(hi) : 0))} className="lab-chart__band" />
      )}
      <line x1={x(2) + 8} x2={x(2) + 8} y1="2" y2={H - 2} className="lab-chart__flight" />
      <polyline points={path(0, 3)} className="lab-chart__line" />
      <polyline points={path(3, 7)} className="lab-chart__line" />
      {pts.map((v, i) => (v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={i === 3 ? 2.6 : 1.6} className={i === 3 ? 'lab-chart__after' : 'lab-chart__dot'} />))}
    </svg>
  );
}

export function LabPanel({ subject, open }: { subject: OsdrSubject; open?: boolean }) {
  const rows = labRows(subject);
  const flagged = rows.filter((r) => r.flag).length;
  return (
    <details className="labs" open={open}>
      <summary>
        <span className="labs__title">Lab results · blood panel</span>
        <span className="labs__sum">
          {rows.length} tests · {flagged ? `${flagged} outside the lab range the day after landing` : 'all in range the day after landing'}
        </span>
      </summary>
      <p className="labs__note">
        Real blood tests of anonymised commercial spaceflight crew member {subject} (NASA OSDR OSD-575), before launch and
        after landing, mapped to this simulated crew member. Blood tests are taken now and then, not live.
      </p>
      <table className="labs__table">
        <thead>
          <tr>
            <th scope="col">Test</th>
            <th scope="col">Before flight</th>
            <th scope="col">Day after landing</th>
            <th scope="col" className="labs__range-col">
              Lab range
            </th>
            <th scope="col" className="labs__chart-col">
              <span className="sr-only">Over time</span>
              <span aria-hidden="true">Before · after</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.def.decimals;
            const change = r.after === null ? null : ((r.after - r.before) / r.before) * 100;
            return (
              <tr key={r.def.key} className={r.flag ? 'is-flagged' : ''}>
                <th scope="row">
                  <strong>{r.def.label}</strong>
                  <span>{r.def.why}</span>
                </th>
                <td>
                  {fmt(r.before, d)} <small>{r.units}</small>
                </td>
                <td>
                  {r.after === null ? '–' : fmt(r.after, d)}
                  {change !== null && Math.abs(change) >= 1 && (
                    <em className="labs__change">
                      {change > 0 ? '↑' : '↓'}
                      {Math.abs(Math.round(change))} %
                    </em>
                  )}
                  {r.flag && <b className="labs__flag">{r.flag === 'high' ? 'High' : 'Low'}</b>}
                </td>
                <td className="labs__range-col">
                  {r.range[0] ?? '–'}–{r.range[1] ?? ''} <small>{r.units}</small>
                </td>
                <td className="labs__chart-col">
                  <LabChart row={r} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}
