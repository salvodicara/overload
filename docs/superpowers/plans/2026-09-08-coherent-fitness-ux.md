# Coherent fitness UX implementation plan

**Goal:** unify app structure around familiar workout logging patterns while preserving the visual identity.
**Architecture:** one history explorer, a compact Home, aggregate analytics in Progress. Reuse current store and data types.
**Tech Stack:** React, TypeScript, Dexie/Zustand, i18next, Vitest, Playwright.
**Spec:** ../specs/2026-09-08-coherent-fitness-ux.md

## Global constraints
All files under ~/Workspace/Codex. No dependencies, production data, deployment or social features. Italian/English parity, phone touch sizes, both themes. Existing working edits and local-first account safety retained.

## Task 1: History explorer
Files: History.tsx, WorkoutList.tsx, lib/workoutHistory.ts, relevant unit tests, theme/history.css. Build regressions for month scoping, date sorting before pagination, multiple sessions and search marker consistency. Implement one 42-cell calendar with visible controls and swipe/keyboard navigation, meaningful empty states and restored context. Shared comparator sorts date descending, then timestamp and id. Verify focused tests.

## Task 2: Home and Progress
Files: Home.tsx, Progress.tsx, components/TrainingOverview.tsx, navigationState.ts, trainingPeriods.ts and tests, theme/overview.css. Remove historical calendar/feed from Home; show current-week strip, primary workout, totals and links. Put aggregate chart controls in Progress. Regression: a paused 60-minute elapsed workout with durationSec=1200 reports 20 minutes. Keep exercise/body/diet analytics. Verify focused tests.

## Task 3: Integration and audit
Files: Nav.tsx, Profile.tsx, locales, e2e/core.spec.ts, docs. Add canonical history entry to Profile; highlight Profile for history/detail/editor. Review remaining library/train/workout/editor flows and fix demonstrated defects. Update E2E expectations for intentional movement of Home analytics into Progress, add history month/date/swipe/back regressions.

## Task 4: Verification and delivery
Run pnpm test, pnpm build and pnpm e2e; inspect representative phone IT/EN light/dark and desktop screenshots with synthetic fixtures. Review whole diff, fix actionable findings, record results and commit on codex/hevy-ux-review. Leave a local preview and reviewable branch.
