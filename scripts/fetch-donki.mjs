// Fetches the last 30 days of NASA DONKI space weather notifications and solar energetic particle (SEP) events
// into public/data/donki.json. Runs before every build. If NASA's API is unreachable or rate limited, the committed
// snapshot is kept, so the build never fails because of it. Set NASA_API_KEY for a higher rate limit.

import { readFile, writeFile } from 'node:fs/promises';

const OUT = 'public/data/donki.json';
const key = process.env.NASA_API_KEY || 'DEMO_KEY';
const DAY = 24 * 3600 * 1000;

try {
  const existing = JSON.parse(await readFile(OUT, 'utf8'));
  if (!process.env.FORCE_DONKI && Date.now() - Date.parse(existing.fetchedAt) < 60 * 60 * 1000) {
    console.log('DONKI: snapshot is less than an hour old, skipping fetch.');
    process.exit(0);
  }
} catch {
  /* no snapshot yet */
}

const end = new Date();
const start = new Date(end.getTime() - 30 * DAY);
const day = (d) => d.toISOString().slice(0, 10);

async function get(path) {
  const res = await fetch(`https://api.nasa.gov/DONKI/${path}&api_key=${key}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${path.split('?')[0]}: HTTP ${res.status}`);
  return res.json();
}

function summary(body = '') {
  const m = body.match(/## Summary:\s*([\s\S]*?)(?:\n## |$)/);
  const text = (m ? m[1] : body).replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}…` : text;
}

try {
  const [notes, sep] = await Promise.all([
    get(`notifications?startDate=${day(start)}&endDate=${day(end)}&type=all`),
    get(`SEP?startDate=${day(start)}&endDate=${day(end)}`),
  ]);
  const out = {
    source: 'NASA DONKI — Space Weather Database Of Notifications, Knowledge, Information (api.nasa.gov)',
    fetchedAt: end.toISOString(),
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
  console.log(`DONKI: saved ${out.notifications.length} notifications and ${out.sep.length} SEP events.`);
} catch (e) {
  console.warn(`DONKI: fetch skipped (${e.message}); keeping the committed snapshot.`);
}
