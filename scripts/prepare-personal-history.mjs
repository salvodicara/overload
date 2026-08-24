// Converts a Hevy CSV export into an Overload backup file that the app can import.
//
//   node scripts/prepare-personal-history.mjs ~/Downloads/workout_data.csv
//
// Output: data/personal/history-import.json (gitignored — personal data never enters the repo).
// The parsing/grouping/id logic mirrors src/lib/hevyCsv.ts + src/lib/ids.ts, so importing the
// generated file twice is a no-op (deterministic ids dedup in `planImport`).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IT_MONTHS = [
  'gen',
  'feb',
  'mar',
  'apr',
  'mag',
  'giu',
  'lug',
  'ago',
  'set',
  'ott',
  'nov',
  'dic',
];

/** Hevy exercise_title → free-exercise-db id, scraped from the curated overlay. */
function readAliasMap() {
  const source = readFileSync(new URL('../src/data/curated.ts', import.meta.url), 'utf8');
  const entry = /^ {2}('[^']+'|[A-Za-z0-9_-]+):\s*\{/gm;
  const starts = [];
  for (let m = entry.exec(source); m !== null; m = entry.exec(source)) {
    starts.push({ id: m[1].replace(/^'|'$/g, ''), at: m.index });
  }
  const map = {};
  starts.forEach(({ id, at }, i) => {
    const body = source.slice(at, starts[i + 1]?.at ?? source.length);
    const aliases = /aliases:\s*\[([^\]]*)\]/.exec(body);
    if (!aliases) return;
    for (const quoted of aliases[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
      map[quoted[1].replace(/\\'/g, "'")] = id;
    }
  });
  return map;
}

/** RFC4180 rows: quoted fields, "" escapes, embedded newlines. */
function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let hasField = false;

  const endField = () => {
    row.push(field);
    field = '';
    hasField = false;
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !hasField) {
      quoted = true;
      hasField = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\n') {
      endRow();
    } else if (ch !== '\r') {
      field += ch;
      hasField = true;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** `20 giu 2026, 14:13` → { date, ts, time } in local time. */
function parseHevyDate(value) {
  const m = /^(\d{1,2})\s+([a-zA-Zàèéìòù]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const monthIndex = IT_MONTHS.indexOf(m[2].toLowerCase().slice(0, 3));
  if (monthIndex < 0) return null;
  const [day, year, hours, minutes] = [Number(m[1]), Number(m[3]), Number(m[4]), Number(m[5])];
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${year}-${pad(monthIndex + 1)}-${pad(day)}`,
    ts: new Date(year, monthIndex, day, hours, minutes).getTime(),
    time: `${pad(hours)}:${pad(minutes)}`,
  };
}

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function numberOrNull(value) {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function convert(csv, aliasMap) {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return { workouts: [], unknown: [] };

  const header = rows[0].map((h) => h.trim());
  const workouts = [];
  const byKey = new Map();
  const unknown = new Map();

  for (const cells of rows.slice(1)) {
    const record = {};
    header.forEach((name, i) => {
      record[name] = cells[i] ?? '';
    });

    const weightKg = numberOrNull(record.weight_kg);
    const reps = numberOrNull(record.reps);
    if (weightKg === null || reps === null) continue;

    const start = parseHevyDate(record.start_time ?? '');
    if (!start) continue;

    const title = record.title ?? '';
    const groupKey = `${title} ${record.start_time}`;
    let workout = byKey.get(groupKey);
    if (!workout) {
      const end = parseHevyDate(record.end_time ?? '');
      const note = (record.description ?? '').trim();
      workout = {
        id: `hevy-${start.date}-${slug(`${title} ${start.time}`)}`,
        dayLabel: title,
        date: start.date,
        startTs: start.ts,
        sets: [],
        volumeKg: 0,
        updatedAt: start.ts,
        source: 'hevy',
      };
      if (end) workout.endTs = end.ts;
      if (note !== '') workout.note = note;
      byKey.set(groupKey, workout);
      workouts.push(workout);
    }

    const exerciseTitle = record.exercise_title ?? '';
    let exerciseId = aliasMap[exerciseTitle];
    if (exerciseId === undefined) {
      exerciseId = `hevy:${slug(exerciseTitle)}`;
      unknown.set(exerciseTitle, (unknown.get(exerciseTitle) ?? 0) + 1);
    }
    workout.sets.push({ exerciseId, weightKg, reps, done: true });
  }

  for (const workout of workouts) {
    workout.volumeKg = workout.sets.reduce((total, s) => total + s.weightKg * s.reps, 0);
  }
  return { workouts, unknown: [...unknown.keys()] };
}

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/prepare-personal-history.mjs <path-to-hevy-csv>');
  process.exit(1);
}

const csv = readFileSync(input, 'utf8');
const aliasMap = readAliasMap();
const { workouts, unknown } = convert(csv, aliasMap);

const outDir = new URL('../data/personal/', import.meta.url);
mkdirSync(outDir, { recursive: true });
const outFile = new URL('history-import.json', outDir);
writeFileSync(outFile, `${JSON.stringify({ version: 1, workouts, routines: [] }, null, 2)}\n`);

const sets = workouts.reduce((n, w) => n + w.sets.length, 0);
const volume = workouts.reduce((n, w) => n + w.volumeKg, 0);
console.log(`aliases: ${Object.keys(aliasMap).length}`);
console.log(`workouts: ${workouts.length} · sets: ${sets} · volume: ${Math.round(volume)} kg`);
if (workouts.length > 0) {
  console.log(`range: ${workouts[0].date} → ${workouts[workouts.length - 1].date}`);
}
console.log(
  `unknown exercises: ${unknown.length}${unknown.length ? ` (${unknown.join(', ')})` : ''}`,
);
console.log(`written: ${fileURLToPath(outFile)}`);
