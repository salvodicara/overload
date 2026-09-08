# Reference pattern synthesis implementation plan

**Goal:** implement the approved Hevy/Strong/StrengthLog synthesis using existing screens and shared state.
**Architecture:** three main tabs; personal detail screens under Profile; Settings extracted from Profile; Home previews existing canonical content.
**Tech stack:** current React/TypeScript/Zustand/Dexie/i18next/Vitest/Playwright.
**Spec:** ../specs/2026-09-08-reference-pattern-synthesis.md

## Constraints
Preserve existing fixes and visual identity. Synthetic QA only, no production writes/deployment or new dependencies. Work under ~/Workspace/Codex. User has explicitly authorized autonomous decisions; do not ask redundant approval questions.

## Tasks
- [x] Home (worker): add StrengthLog-style latest-workouts preview (three workouts) using WorkoutList and same detail route; preserve resume/next, current-week links. Own Home.tsx and scoped home CSS only. Root updates locale keys and tests.
- [x] Profile/settings (worker): move existing preferences/data/about/signout into Settings.tsx; Profile becomes Hevy hub with gear, identity, summary, shortcut grid (progress, library, body, history, diet) and existing WorkoutList preview. Reuse icons and PageHeader. Own Profile.tsx, Settings.tsx, profile CSS. Root wires routes/types/keys/tests.
- [x] Root navigation: add settings/body/diet Route variants, reduce tabs and TAB_VIEWS to home/train/profile, group personal detail routes, wire App and titles, add back to Library and Progress, extract body/diet from Progress tabs using wrappers. Preserve restored scroll/state and existing picker flow.
- [x] Root verification: first update navigation regression to expect three tabs and nested Profile ownership and observe failure. Update browser helpers to enter Profile subpages and Settings; preserve all 99 existing scenarios and add synthesis routing/back/content tests. Run focused then full tests/build.
- [x] Review/render: independent read-only final review, IT/EN320/390 screenshots of all changed surfaces and empty/populated states; fix findings; record exact sources/results and commit.
