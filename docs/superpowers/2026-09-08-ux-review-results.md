# Overload UX review — 8 September 2026

> Navigation organization superseded by the [reference synthesis](./2026-09-08-reference-synthesis-results.md).


## Product decisions

Keep Home, Train, Exercises, Progress and Profile. Home answers what to train next and how the current week is going. Profile owns the only workout history/calendar; Home links to that same explorer. Progress owns historical training charts, exercise analytics, body measurements and nutrition. Preserve Overload's graphite/volt identity and use familiar workout-app interactions rather than inventing new navigation.

Primary references: [Hevy consistency/calendar](https://www.hevyapp.com/features/gym-consistency/), [routines](https://www.hevyapp.com/features/gym-routines/) and [progress](https://www.hevyapp.com/features/gym-progress/). These informed interaction patterns; no proprietary code or artwork was copied.

## Changes and defects corrected

- Unified date-sorted history with list/calendar, visible month controls, swipe and keyboard navigation, day filtering, multiple sessions and matching search/filter markers.
- Replaced duplicate Home history/analytics with next-workout action and current-week summary; moved period charts to Progress.
- Preserved Profile navigation context in history/detail/editor and restored period/calendar state when returning.
- Prevented starting another routine from replacing an unfinished workout; kept paused time consistent in the minimized banner and active duration consistent in summaries/charts.
- Excluded empty draft routines from Home's next-workout action.
- Fixed narrow-screen headers, long routine/program names, exercise option menus, translated reorder actions and large summary values.
- Fixed Italian chart-control wrapping and distinct chart values being rounded to the same label.
- Made invalid-import feedback persistent and long backup filenames readable.

## Surface coverage

All 16 screen components were inspected with synthetic local data. Representative states include empty/populated surfaces, editing, expanded panels, options, search without results, validation errors and destructive-action dialogs.

| Area | Coverage |
| --- | --- |
| Home, Train, Exercises, Progress, Profile, History | 18 captures: Italian dark at 320/390 px; English light at 390 px; additional desktop Home |
| Routine editor, live workout, saved workout detail/editor, Summary | 84 captures: 21 states at 320/390 px in Italian dark and English light; notes, warmups, progression, exercise picker/options, rest controls, confirmation dialogs |
| Progress training/body/nutrition | 68 captures at 320/390 px in Italian dark and English light, including empty/one/many measurements, add/delete and nutrition targets |
| Library, exercise sheet, import/export | Additional 320 px Italian dark captures: search, custom exercise, details, invalid import and backup preview |
| Login | 320 px Italian dark and English light |

Final sampled states showed no page horizontal overflow. Intentional editable-input scrolling, metric-chip scrolling and visually hidden accessibility text were excluded from clipping checks. Long unbroken names and backup filenames have browser regressions. This is a local Chromium audit; real-device Safari and production account synchronization were not exercised by this task.

## Verification

- 249 unit tests across 32 files passed.
- Production build, TypeScript and locale parity passed.
- All 99 Playwright browser tests passed (2.6 minutes).
- Independent read-only review approved the full delta without actionable blocking findings.

Raw screenshots and reports are local under `~/Workspace/Codex/overload-qa` and the task worktree's `.playwright-cli`. They contain synthetic fixtures, not production workout history. Implementation is on `codex/hevy-ux-review`; production was not deployed.
