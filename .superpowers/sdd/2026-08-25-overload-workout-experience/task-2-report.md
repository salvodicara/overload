# Task 2 report: contextual Home and full History

## RED

Command:

```text
pnpm e2e --grep "home prioritizes"
```

Result: expected failure. The new Home acceptance test could not find the
`Next workout` / `Prossimo allenamento` heading because the Home route still
rendered the former History screen.

## GREEN

The focused dashboard acceptance test passed after implementation. It starts a
Vite process from this worktree only after confirming port 5199 is clear, and
also verifies a main landmark, three labelled sections, and no horizontal
overflow at 320px and 390px.

```text
pnpm e2e --grep "home prioritizes"
```

Result: 1 passed.

The neutral helper and legacy-generalization fix round also passed:

```text
pnpm e2e --grep "technique and session|mid-workout rest|hardware back"
```

Result: 3 passed.

## Decisions

- Home uses the shared `nextRoutine` selector, shows an active-session resume
  card first, then the next routine or neutral onboarding, the current week,
  and at most three recent workouts.
- Weekly sessions, sets, and volume derive from completed working sets only;
  volume is recomputed with the working-set-aware volume helper and displayed
  through the configured unit formatter.
- `WorkoutList` owns the existing workout summary card and month grouping.
  History is now an unbounded, titled internal route; Home links to it and the
  five-tab navigation continues to mark Home as active there.
- Routine-card controls now expose localized `Edit <routine>` and
  `Start <routine>` names. The neutral E2E helpers explicitly navigate to
  Train and start Full Body A, so repeated starts never depend on the dashboard
  suggestion advancing to Full Body B.
- The former personal/structural E2E checks now use the current labelled note
  scopes and role/name selectors. Distinct session-note persistence is checked
  against the local workout records until Task 6 exposes those observations in
  the journal and detail views.

## Full verification

```text
pnpm e2e
pnpm i18n
pnpm test
pnpm build
git diff --check
```

Results: full browser suite 11/11 passed; i18n reported 255 matched keys;
Vitest reported 14 files and 165 tests passed; TypeScript, Vite, and PWA build
completed successfully; and the diff check was clean. The existing Vite
warning about application chunks over 500 kB remains unchanged.

## Self-review

- [x] Five bottom tabs are unchanged; History is internal and grouped under
  Home.
- [x] Home and History use semantic headers and labelled sections.
- [x] The 320px and 390px E2E viewport checks have no horizontal overflow.
- [x] No routine selection logic was duplicated and no unrelated production
  screen was changed.
- [x] The committed implementation files are limited to Task 2 ownership.

## Commit

Implementation source commit: `7ba4a3bdd18f145cecdf986dc9ed83a880511f0d`
(`feat: turn home into a training dashboard`). This report is added in the
follow-up amendment that records the verification evidence.
