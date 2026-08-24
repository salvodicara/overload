// Downloads exercise demo images from free-exercise-db (Public Domain / Unlicense).
// Default: only the ids used by seeded routines (fast, ~4 MB). `--all`: full catalog (~98 MB).
// Media lands in public/exercise-media/ (gitignored; re-run before deploy).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const all = process.argv.includes('--all');
const root = new URL('..', import.meta.url).pathname;
const dest = join(root, 'public/exercise-media');
const tmp = join(tmpdir(), 'free-exercise-db');

if (!existsSync(join(tmp, 'exercises'))) {
  console.log('Cloning free-exercise-db…');
  rmSync(tmp, { recursive: true, force: true });
  execSync(`git clone --depth 1 https://github.com/yuhonas/free-exercise-db "${tmp}"`, {
    stdio: 'inherit',
  });
}

mkdirSync(dest, { recursive: true });

let ids;
if (all) {
  ids = JSON.parse(readFileSync(join(tmp, 'dist/exercises.json'), 'utf8')).map((e) => e.id);
} else {
  const curated = readFileSync(join(root, 'src/data/curated.ts'), 'utf8');
  ids = [...new Set([...curated.matchAll(/'([A-Za-z0-9_'\-]+)':\s*\{/g)].map((m) => m[1]))];
}

let copied = 0;
for (const id of ids) {
  const src = join(tmp, 'exercises', id);
  if (!existsSync(src)) {
    console.warn('missing in dataset:', id);
    continue;
  }
  cpSync(src, join(dest, id), { recursive: true });
  copied++;
}
console.log(`Copied media for ${copied}/${ids.length} exercises to public/exercise-media/`);
