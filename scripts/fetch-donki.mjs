// Fetches the last 30 days of NASA DONKI space weather notifications and solar energetic particle (SEP) events
// into public/data/donki.json. Runs before every build. If DONKI is unreachable, the committed snapshot is kept, so
// the build never fails because of it.
// DONKI moved to the CCMC DONKI API on 30 September 2026 (no API key needed); the old api.nasa.gov address is tried
// as a fallback (set NASA_API_KEY for a higher rate limit there).
// Local builds reuse a snapshot younger than an hour; Cloudflare Pages builds (CF_PAGES) always fetch.

import { readFile, writeFile } from 'node:fs/promises';

const OUT = 'public/data/donki.json';
const key = process.env.NASA_API_KEY || 'DEMO_KEY';
const inCi = Boolean(process.env.CF_PAGES || process.env.CI);
const DAY = 24 * 3600 * 1000;

try {
  const existing = JSON.parse(await readFile(OUT, 'utf8'));
  if (!process.env.FORCE_DONKI && !inCi && Date.now() - Date.parse(existing.fetchedAt) < 60 * 60 * 1000) {
    console.log('DONKI: snapshot is less than an hour old, skipping fetch.');
    process.exit(0);
  }
} catch {
  /* no snapshot yet */
}

const end = new Date();
const start = new Date(end.getTime() - 30 * DAY);
const day = (d) => d.toISOString().slice(0, 10);

const SOURCES = [
  { name: 'ccmc.gsfc.nasa.gov/DONKI-API', url: (path) => `https://ccmc.gsfc.nasa.gov/DONKI-API/get/${path}` },
  { name: 'api.nasa.gov', url: (path) => `https://api.nasa.gov/DONKI/${path}&api_key=${key}` },
];

async function get(source, path) {
  const res = await fetch(source.url(path), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${source.name} ${path.split('?')[0]}: HTTP ${res.status}`);
  return res.json();
}

async function fetchAll() {
  let lastError;
  for (const source of SOURCES) {
    try {
      const [notes, sep] = await Promise.all([
        get(source, `notifications?startDate=${day(start)}&endDate=${day(end)}&type=all`),
        get(source, `SEP?startDate=${day(start)}&endDate=${day(end)}`),
      ]);
      return { source, notes, sep };
    } catch (e) {
      lastError = e;
      console.warn(`DONKI: ${e.message}`);
    }
  }
  throw lastError;
}

function summary(body = '') {
  const m = body.match(/## Summary:\s*([\s\S]*?)(?:\n## |$)/);
  const text = (m ? m[1] : body).replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

try {
  const { source, notes, sep } = await fetchAll();
  const out = {
    source: `NASA DONKI — Space Weather Database Of Notifications, Knowledge, Information (${source.name})`,
    fetchedAt: end.toISOString(),
    via: source.name,
    notifications: (notes ?? []).map((n) => ({
      type: n.messageType,
      id: n.messageID,
      time: n.messageIssueTime,
      url: n.messageURL,
      summary: summary(n.messageBody),
    })),
    sep: (sep ?? []).map((s) => ({ id: s.sepID, time: s.eventTime, url: s.link })),
  };
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`DONKI: saved ${out.notifications.length} notifications and ${out.sep.length} SEP events (${out.via}).`);
} catch (e) {
  console.warn(`DONKI: fetch skipped (${e.message}); keeping the committed snapshot.`);
}
