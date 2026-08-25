# Task 1 report: deterministic next-routine selection

## RED

Command:

```text
pnpm vitest run src/lib/__tests__/routines.test.ts
```

Result: expected failure. Vitest could not resolve `../routines` from the new test (`Cannot find module '../routines'`), so the selector was genuinely missing before implementation.

## GREEN

Command:

```text
pnpm vitest run src/lib/__tests__/routines.test.ts
```

Result: exit 0; 1 test file and 5 tests passed.

## Files and decisions

- Added `src/lib/routines.ts` with `lastCompletedFor` and `nextRoutine`.
- Evidence is matched by routine ID, with the legacy day-label fallback, and sorted by `startTs` with deterministic tie-breakers (`updatedAt`, then ID); input array position is never used to decide recency.
- A known folder advances according to the stored routine-array order within that folder and wraps. New data selects the first stored routine. Ungrouped/unknown-folder data selects the oldest completion, treating never-completed routines as oldest.
- Added focused unit coverage for new programs, program advance/wrap, ungrouped least-recent selection, unsorted evidence, and latest completion lookup.
- Replaced Train’s duplicate suggestion heuristic and last-workout lookup with the shared helpers. No unrelated Train UI behavior was changed.

## Full verification

Commands:

```text
pnpm vitest run
pnpm build
```

Results: exit 0; 14 test files and 164 tests passed. The build reported `i18n ok (246 keys)`, TypeScript and Vite succeeded, and the PWA artifacts were generated. Vite retains the existing warning that two application chunks exceed 500 kB; this task did not change chunking.

Additional combined verification:

```text
pnpm vitest run src/lib/__tests__/routines.test.ts && pnpm build
```

Result: exit 0; focused 5/5 passed and build succeeded.

## Commit

SHA: `140608836e3df20321c5ae6d76419b8720c82a5e` (the source commit created for this task; the report was amended afterward to record it).

Message: `feat: derive the next routine from user history`

## Self-review

- [x] Scope is limited to the selector, its tests, Train’s duplicate selector/recency logic, and this report.
- [x] Tests were observed failing before production implementation and passing afterward.
- [x] No new dependency or product-specific routine behavior was introduced.
- [x] `git diff --check` is clean.

## Fix round 1 (review P1)

The review identified that an ungrouped or deleted-folder latest workout incorrectly restricted least-recent fallback to ungrouped routines. The approved fallback considers every stored routine, while the known-folder cycle remains unchanged.

### RED

Added the mixed-history regression `considers program routines in the fallback after an ungrouped workout` and ran:

```text
pnpm vitest run src/lib/__tests__/routines.test.ts
```

Result: exit 1 as expected; 5 tests passed and the new test failed with `expected 'u-a' to be 'a'`, proving the current fallback omitted untouched program routines.

### GREEN

Changed only the fallback candidate set to all stored routines and reran:

```text
pnpm vitest run src/lib/__tests__/routines.test.ts
```

Result: exit 0; 1 test file and 6 tests passed.

### Verification

```text
pnpm vitest run && pnpm build && git diff --check
```

Result: exit 0; 14 test files and 165 tests passed, i18n checked 246 keys, TypeScript/Vite/PWA build succeeded, and the diff check was clean. The existing Vite warning about application chunks over 500 kB remains unchanged.

### Fix commit

SHA: `56d04418102782a93b4abcc719bcf4e0be7f1452` (the fix commit created before this report metadata amendment).

Message: `fix: include every routine in fallback selection`

### Fix-round self-review

- [x] Only `src/lib/routines.ts`, `src/lib/__tests__/routines.test.ts`, and this report changed.
- [x] Known-folder cycle semantics and deterministic evidence tie-breakers are unchanged.
- [x] The regression was observed failing before the candidate-set correction and passing afterward.
