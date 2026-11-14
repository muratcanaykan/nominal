// Downloads the Inspiration4 Comprehensive Metabolic Panel (NASA OSDR, OSD-575) and saves the glucose values per
// anonymised crew member and timepoint to src/data/osdr-inspiration4.json. The data is historical, so this runs on
// demand (`npm run data:osdr`), not on every build.

import { writeFile } from 'node:fs/promises';

const ACCESSION = 'OSD-575';
const FILE = 'LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv';
const URL = `https://osdr.nasa.gov/geode-py/ws/studies/${ACCESSION}/download?source=datamanager&file=${FILE}`;
const PREFLIGHT = ['L-92', 'L-44', 'L-3'];

const res = await fetch(URL, { signal: AbortSignal.timeout(60000) });
if (!res.ok) throw new Error(`OSDR download failed: HTTP ${res.status}`);
const lines = (await res.text()).trim().split(/\r?\n/);
const header = lines.shift().split(',');
const col = (name) => header.indexOf(name);

const subjects = {};
let units = '';
let labRange = null;
for (const line of lines) {
  const f = line.split(',');
  if (f[col('ANALYTE')] !== 'GLUCOSE') continue;
  const id = f[col('SUBJECT_ID')];
  const value = Number(f[col('VALUE')]);
  if (Number.isNaN(value)) continue;
  units = f[col('UNITS')];
  labRange = [Number(f[col('RANGE_MIN')]), Number(f[col('RANGE_MAX')])];
  subjects[id] ??= { sex: f[col('SEX')], glucose: {} };
  subjects[id].glucose[f[col('timepoint')]] = value;
}

for (const s of Object.values(subjects)) {
  const pre = PREFLIGHT.map((t) => s.glucose[t]).filter((v) => v !== undefined);
  s.preflightMean = Math.round((pre.reduce((a, b) => a + b, 0) / pre.length) * 10) / 10;
  s.dayAfterLanding = s.glucose['R+1'] ?? null;
}

const out = {
  source: 'NASA Open Science Data Repository (OSDR) — Inspiration4 Comprehensive Metabolic Panel',
  accession: ACCESSION,
  file: FILE,
  url: `https://osdr.nasa.gov/bio/repo/data/studies/${ACCESSION}`,
  analyte: 'GLUCOSE',
  units,
  labRange,
  timepoints: 'L-n = days before launch, R+n = days after return',
  preflightTimepoints: PREFLIGHT,
  subjects,
};
await writeFile('src/data/osdr-inspiration4.json', JSON.stringify(out, null, 1) + '\n');
console.log(`OSDR: saved glucose for ${Object.keys(subjects).length} crew members (${units}).`);
for (const [id, s] of Object.entries(subjects)) console.log(` ${id} ${s.sex} pre-flight ${s.preflightMean} → R+1 ${s.dayAfterLanding}`);
