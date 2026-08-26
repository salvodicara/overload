import { readFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(new URL(`../src/i18n/${p}`, import.meta.url), 'utf8'));
const loadJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
const flatValues = (obj) =>
  Object.values(obj).flatMap((value) =>
    typeof value === 'object' && value !== null ? flatValues(value) : [String(value)],
  );
const forbidden = /\b(bulk|massa|surplus|whey)\b/i;
for (const [locale, data] of [
  ['it', load('it.json')],
  ['en', load('en.json')],
]) {
  const bad = flatValues(data).filter((value) => forbidden.test(value));
  if (bad.length) {
    console.error(`Personal nutrition copy in ${locale}:`, bad.join(' | '));
    process.exit(1);
  }
}

const it = new Set(keys(load('it.json')));
const en = new Set(keys(load('en.json')));
const onlyIt = [...it].filter((k) => !en.has(k));
const onlyEn = [...en].filter((k) => !it.has(k));

if (onlyIt.length || onlyEn.length) {
  if (onlyIt.length) console.error('Missing in en.json:', onlyIt.join(', '));
  if (onlyEn.length) console.error('Missing in it.json:', onlyEn.join(', '));
  process.exit(1);
}

const equipment = loadJson('../src/data/equipment.json');
const catalog = loadJson('../public/data/exercises.json');
const rawEquipment = new Set(
  catalog.map((exercise) => exercise.equipment).filter((value) => typeof value === 'string'),
);
const unmapped = [...rawEquipment].filter((value) => equipment[value.toLowerCase()] === undefined);
const missingEquipmentKeys = [...new Set(Object.values(equipment))]
  .flatMap((key) => [`library.equipment.${key}`])
  .filter((key) => !it.has(key) || !en.has(key));
if (unmapped.length || missingEquipmentKeys.length) {
  if (unmapped.length) console.error('Unmapped catalog equipment:', unmapped.join(', '));
  if (missingEquipmentKeys.length) {
    console.error('Missing localized equipment keys:', missingEquipmentKeys.join(', '));
  }
  process.exit(1);
}
console.log(`i18n ok (${it.size} keys)`);
