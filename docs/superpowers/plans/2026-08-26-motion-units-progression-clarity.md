# Motion, Units, and Progression Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Overload's time navigation, route motion, weight formatting, and next-routine/progression language match established fitness-app and platform conventions.

**Architecture:** Reuse the existing React state, CSS motion system, and native View Transitions API with a no-motion fallback; add no dependencies. Keep historical values factual and routine-scoped, while progression hints remain explicit recommendations with a localized rationale.

**Tech Stack:** React 19, TypeScript, Zustand, CSS, i18next, Vitest, Playwright.

**Spec:** `docs/research/2026-08-26-fitness-units-motion-progression.md`

## Global Constraints

- Preserve the existing dark-first Overload identity and five-tab navigation.
- Match Hevy/Strong/Fitbod information grammar without copying proprietary assets or trade dress.
- Italian and English strings must remain in parity.
- Respect `prefers-reduced-motion` and WCAG 2.2 AA.
- Add no motion or formatting dependency.
- Verify behavior in code and visually at mobile viewport size.

---

### Task 1: Weight and progression language

**Files:**

- Modify: `src/lib/__tests__/format.test.ts`
- Modify: `src/lib/format.ts`
- Modify: `src/screens/Progress.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`

**Interfaces:**

- Consumes: `formatPreviousSet(set, tracking, unit)` and existing unit helpers.
- Produces: unit-bearing standalone results such as `50 kg × 8`, compact progress values, and the label `Prossima` / `Up next`.

- [ ] Change the formatter test expectations to require `kg` or `lb` for weighted standalone results.
- [ ] Run `npm test -- src/lib/__tests__/format.test.ts` and confirm the weighted cases fail because the unit is absent.
- [ ] Add the unit through the existing `weightLabel` helper; keep reps-only and duration formatting unchanged.
- [ ] Remove the redundant localized word `reps` from standalone weighted Progress values while keeping the unit.
- [ ] Rename the routine badge from `Consigliata` / `Suggested` to `Prossima` / `Up next`.
- [ ] Run the focused tests and `npm run i18n`.

### Task 2: Calendar direct-manipulation motion

**Files:**

- Modify: `src/screens/Home.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `e2e/core.spec.ts`

**Interfaces:**

- Consumes: `shiftPeriod(anchor, unit, amount)` and the existing swipe/keyboard behavior.
- Produces: a bounded period page that follows horizontal pointer movement, settles in the temporal direction, snaps back below threshold, and fade-transitions to today.

- [ ] Extend the existing Home e2e test to assert pointer movement changes the period page transform before release and that `Oggi` uses the today transition state.
- [ ] Run the focused Playwright test and confirm it fails because the page does not follow the pointer.
- [ ] Track pointer displacement with capture, cap it to the temporal surface, and preserve vertical page scrolling.
- [ ] Key the period content by period and animate incoming adjacent periods in the correct direction; use fade-through for `Oggi`.
- [ ] Add a reduced-motion path that removes spatial translation.
- [ ] Run the focused Home tests.

### Task 3: App navigation motion grammar

**Files:**

- Create: `src/lib/navigationMotion.ts`
- Create: `src/lib/__tests__/navigationMotion.test.ts`
- Modify: `src/state/useStore.ts`
- Modify: `src/theme/tokens.css`

**Interfaces:**

- Produces: `routeMotion(from, to): 'peer' | 'forward'` and `transitionRoute(kind, update): void`.
- Consumes: the existing route union and Zustand `nav`/`popstate` updates.

- [ ] Write unit tests proving tab-to-tab navigation is peer motion and tab/list-to-detail navigation is forward motion.
- [ ] Run the focused test and confirm it fails because the helper does not exist.
- [ ] Implement the smallest pure route classifier and a native View Transitions wrapper with a synchronous fallback.
- [ ] Apply peer fade-through to tab switches, directional motion to detail entry, and reverse motion on browser Back.
- [ ] Remove the generic vertical entrance from routed screens so it does not conflict with the navigation grammar.
- [ ] Add a reduced-motion fade-only path and rerun focused tests.

### Task 4: Visual and regression verification

**Files:**

- Modify only files identified by the bounded visual inspection.

**Interfaces:**

- Consumes: the completed UI and existing Playwright fixtures.
- Produces: mobile screenshots and a verified release candidate.

- [ ] Run Prettier on changed source/test files.
- [ ] Run `npm test`, `npm run build`, and focused e2e tests.
- [ ] Run the Impeccable detector once over changed UI targets.
- [ ] Capture mobile screenshots for Home current/past period, Train expanded/collapsed, exercise detail, Progress, and an active workout.
- [ ] Fix all visible defects in one bounded batch and capture one confirmation round.
- [ ] Run the Ponytail pass over the final diff, removing abstractions or duplication that do not earn their place.
- [ ] Re-run full verification and review the final git diff.
