import { readFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(new URL(`../src/i18n/${p}`, import.meta.url), 'utf8'));
const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const it = new Set(keys(load('it.json')));
const en = new Set(keys(load('en.json')));
const onlyIt = [...it].filter((k) => !en.has(k));
const onlyEn = [...en].filter((k) => !it.has(k));

if (onlyIt.length || onlyEn.length) {
  if (onlyIt.length) console.error('Missing in en.json:', onlyIt.join(', '));
  if (onlyEn.length) console.error('Missing in it.json:', onlyEn.join(', '));
  process.exit(1);
}
console.log(`i18n ok (${it.size} keys)`);
