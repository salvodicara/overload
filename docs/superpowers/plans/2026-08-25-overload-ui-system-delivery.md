# Overload UI System and Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply one accessible mobile-first visual system to every Overload screen, remove remaining personal copy and UI clutter, reduce startup weight, complete cross-screen QA, integrate, and deploy production.

**Architecture:** Recalibrate the existing CSS-variable system and introduce only two shared structural primitives: PageHeader and BottomSheet. Use route-level React lazy loading and screen-triggered catalog loading. Polish screens in bounded groups, then run fresh Vercel guideline, Impeccable, browser, accessibility, performance, and production checks.

**Tech Stack:** React 19, TypeScript, CSS variables, i18next, Vite, Playwright, Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-08-25-overload-general-redesign.md`

## Global Constraints

- Complete both data-generalization and workout-experience plans first.
- Preserve graphite/volt, Archivo, JetBrains Mono, dark/light system modes, and five-tab IA.
- Spacing scale: 4, 8, 12, 16, 24, 32, 40.
- Type scale: 12, 14, 16, 20, 28, 36.
- Controls are 48px minimum where task-critical and 44px minimum for secondary icon buttons.
- Motion intensity is 2: feedback and state transitions only, always reduced-motion safe.
- WCAG 2.2 AA, safe areas, visible labels, focus visibility, and touch targets are non-negotiable.
- Do not add a design system, animation library, chart library, or generic component framework.
- No social, challenge, news, meal advice, comeback copy, or personal support voice.

---

### Task 1: Semantic shell and calibrated design tokens

**Files:**

- Modify: `src/theme/tokens.css`
- Modify: `src/App.tsx`
- Modify: `src/screens/Login.tsx`
- Modify: `src/screens/Home.tsx`
- Modify: `src/screens/History.tsx`
- Modify: `src/screens/RoutineEditor.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `src/components/Nav.tsx`
- Modify: `src/components/ActiveWorkoutBar.tsx`
- Modify: `src/components/RestBar.tsx`
- Modify: `src/components/RestWatcher.tsx`
- Modify: `e2e/core.spec.ts`

**Interfaces:**

- Produces semantic classes: `.app-main`, `.skip-link`, `.page`, `.page-title`, `.section-title`, `.meta`, `.panel`, `.list-group`, `.field`, `.filter-pill`, `.action-link`.
- App shell contains one `<main id="main-content">`; skip link targets it.

- [ ] **Step 1: Add failing shell accessibility checks**

```ts
test('app shell exposes landmarks and skip navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip to content|vai al contenuto/i })).toBeFocused();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm e2e --grep "app shell exposes"`

Expected: FAIL because the skip link and a single consistent shell landmark do not exist across authenticated, unauthenticated, loading, and error states.

- [ ] **Step 3: Implement the shell and token scale**

Define semantic spacing/type variables from the exact global scales. Replace light semantic colors so text on `--good-soft` and `--warn-soft` reaches at least 4.5:1. Add `scroll-padding-top`, `scroll-padding-bottom`, `touch-action: manipulation`, `:focus-visible`, and disabled background/border changes. Remove `.nav-dot`; active navigation uses accent icon and ink text only. App owns the one `<main>` landmark in every auth/loading/error route; flatten existing inner `<main>` elements in Home, History, and RoutineEditor into semantic screen roots. Make toast `role="status" aria-live="polite"`, and retain rest timer semantics.

- [ ] **Step 4: Run shell e2e, i18n, and build**

Run: `pnpm e2e --grep "app shell exposes" && pnpm i18n && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/theme/tokens.css src/App.tsx src/screens/Login.tsx src/screens/Home.tsx src/screens/History.tsx src/screens/RoutineEditor.tsx src/i18n/it.json src/i18n/en.json src/components/Nav.tsx src/components/ActiveWorkoutBar.tsx src/components/RestBar.tsx src/components/RestWatcher.tsx e2e/core.spec.ts
git commit -m "feat: establish the accessible app shell"
```

### Task 2: Shared PageHeader and BottomSheet primitives

**Files:**

- Create: `src/components/PageHeader.tsx`
- Create: `src/components/BottomSheet.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/screens/Train.tsx`
- Modify: `src/screens/RoutineEditor.tsx`
- Modify: `src/screens/Workout.tsx`
- Modify: `src/screens/WorkoutDetail.tsx`
- Modify: `src/screens/Library.tsx`
- Modify: `e2e/core.spec.ts`

**Interfaces:**

- `PageHeader({ title, eyebrow?, back?, action?, sticky? })` renders a semantic header and optional back/action controls.
- `BottomSheet({ open, title, onClose, children, initialFocusRef?, closeOnScrim? })` owns `role=dialog`, focus containment, Escape, initial focus, and restoration.

- [ ] **Step 1: Write a failing BottomSheet behavior test**

```ts
test('sheet traps focus, closes on Escape, and restores its trigger', async ({ page }) => {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  const trigger = page.getByRole('button', { name: /\+ (create|crea)/i });
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(':focus')).toHaveCount(1);
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
```

- [ ] **Step 2: Verify the chosen test is RED**

Run: `pnpm e2e --grep "sheet traps focus"`

Expected: FAIL because the shared primitive does not exist.

- [ ] **Step 3: Implement the primitives and replace all five sheet implementations**

BottomSheet captures `document.activeElement` when opening, focuses the explicit initial ref or first focusable control, cycles Tab/Shift+Tab across visible enabled controls, closes on Escape, and restores the captured element after close. Scrim click closes only when `closeOnScrim` is true. PageHeader normalizes title, back, action, sticky behavior, and safe-area padding without hiding native history behavior. The structural replacement must preserve Workout's two note scopes and owner-safe save receipts, WorkoutDetail's warm-up/working/session/imported-note grouping and owner-safe deletion, and RoutineEditor's Technique persistence and draft hydration behavior.

- [ ] **Step 4: Run focus tests, e2e, and build**

Run: `pnpm test && pnpm e2e && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PageHeader.tsx src/components/BottomSheet.tsx src/theme/tokens.css src/screens/Train.tsx src/screens/RoutineEditor.tsx src/screens/Workout.tsx src/screens/WorkoutDetail.tsx src/screens/Library.tsx e2e/core.spec.ts
git commit -m "feat: unify page headers and accessible sheets"
```

### Task 3: Login, Home, History, Train, and navigation polish

**Files:**

- Modify: `src/screens/Login.tsx`
- Modify: `src/screens/Home.tsx`
- Modify: `src/screens/History.tsx`
- Modify: `src/components/WorkoutList.tsx`
- Modify: `src/screens/Train.tsx`
- Modify: `src/components/Nav.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`

**Interfaces:**

- Uses calibrated semantic classes and PageHeader; no new data API.

- [ ] **Step 1: Capture baseline mobile dark/light screenshots outside the repo**

Run the dev E2E server and save Login, empty Home, populated Home, History, and Train at 390×844 plus Home at 1440×1024 to a `mktemp -d` directory.

Expected: evidence directory is outside the worktree and `git status --short` remains unchanged.

- [ ] **Step 2: Apply the visual hierarchy**

Login uses one strong Overload wordmark, short value copy, one primary Google action, and a quiet recovery action. Home uses one accent next-action panel, a plain week metric band/consistency strip, and grouped recent activity. Train separates program labels from routine rows and uses action buttons only where an action exists. Refine History's existing month grouping into a clear grouped-list hierarchy instead of recreating it. Navigation labels remain 12px minimum and active state has no decorative dot.

- [ ] **Step 3: Replace personal/support copy**

Change sign-in failure to a neutral retry message in both languages. Ensure no title or CTA wraps at 320px, no visible string contains personal program language, and all labels are functional rather than motivational filler.

- [ ] **Step 4: Verify this screen group**

Run: `pnpm i18n && pnpm e2e && pnpm build`

Expected: PASS. Re-capture the same screenshots outside the repo and inspect dark/light/mobile/desktop.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Login.tsx src/screens/Home.tsx src/screens/History.tsx src/components/WorkoutList.tsx src/screens/Train.tsx src/components/Nav.tsx src/theme/tokens.css src/i18n/it.json src/i18n/en.json
git commit -m "style: refine entry and training surfaces"
```

### Task 4: Library and Exercise Detail polish

**Files:**

- Modify: `src/screens/Library.tsx`
- Modify: `src/screens/ExerciseSheet.tsx`
- Modify: `src/components/ExerciseMedia.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`

**Interfaces:**

- Uses PageHeader, BottomSheet, semantic fields/filters/panels, and Technique/journal APIs.

- [ ] **Step 1: Capture the screen group outside the repo**

Capture Library loading, populated Library, no results, custom exercise sheet, Exercise Detail without media, with media/video, Technique editor, and Journal at 390×844 in dark and light.

- [ ] **Step 2: Recompose Library**

Make search and filters one sticky search region with persistent search label available to assistive technology. Filter pills use native pressed state and 44px height. Results become compact media rows with muscle metadata, not nested cards and chips. The custom exercise action remains visible after results and its form includes name, muscle group, and tracking type.

- [ ] **Step 3: Recompose Exercise Detail**

Use PageHeader, a stable media ratio, title/alternate name, plain metadata, latest performance, Technique panel, instructions, deferred video, and Journal. Preserve the owner-safe Technique save receipt, stale/error behavior, stable workout journal IDs/links, and all tracking/unit formats. Stop auto-running an infinite crossfade when reduced motion is requested; use a static first frame.

- [ ] **Step 4: Verify this screen group**

Run: `pnpm i18n && pnpm e2e && pnpm build`

Expected: PASS, no horizontal overflow, labels ≥12px, and same dark/light hierarchy.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Library.tsx src/screens/ExerciseSheet.tsx src/components/ExerciseMedia.tsx src/theme/tokens.css src/i18n/it.json src/i18n/en.json
git commit -m "style: refine exercise discovery and detail"
```

### Task 5: Progress, body, and nutrition polish/generalization

**Files:**

- Modify: `src/screens/Progress.tsx`
- Modify: `src/screens/ProgressBody.tsx`
- Modify: `src/screens/ProgressDiet.tsx`
- Modify: `src/components/LineChart.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `scripts/check-i18n.mjs`

**Interfaces:**

- Consumes unit formatters and tracking metadata.
- Nutrition remains kcal/protein only; meal examples are removed.

- [ ] **Step 1: Add a failing copy regression test**

Extend `scripts/check-i18n.mjs` with this exact check:

```js
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
```

Delete `diet.meals`, `diet.meal1Title/Body`, `diet.meal2Title/Body`, and `diet.meal3Title/Body` from both locale files in the GREEN step; keep `diet.today`, `diet.targets`, `diet.kcalTarget`, `diet.proteinTarget`, `diet.protein`, and a rewritten neutral `diet.hint`.

- [ ] **Step 2: Run the copy test to verify RED**

Run: `pnpm i18n`

Expected: FAIL after the checker is extended because personal keys still exist.

- [ ] **Step 3: Generalize and align progress surfaces**

Remove meal example state/UI/copy and numeric target placeholders. Nutrition inputs use persistent labels and optional user targets. Body copy describes weekly average as a trend, not a bulk tool, and weight follows the selected unit. Training progress adapts the local `topSets()` selection, chart, and labels to weight, repetitions, or duration data. Replace three cramped metric cards with a plain aligned metric band and keep one main chart.

- [ ] **Step 4: Verify this screen group**

Run: `pnpm i18n && pnpm test && pnpm e2e && pnpm build`

Expected: PASS; capture empty/one/many states at mobile dark/light outside the repo.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Progress.tsx src/screens/ProgressBody.tsx src/screens/ProgressDiet.tsx src/components/LineChart.tsx src/theme/tokens.css src/i18n/it.json src/i18n/en.json scripts/check-i18n.mjs
git commit -m "style: generalize progress and nutrition"
```

### Task 6: Profile and truthful import/export polish

**Files:**

- Create: `src/components/ExportRows.tsx`
- Modify: `src/screens/Profile.tsx`
- Modify: `src/screens/ImportExport.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `e2e/core.spec.ts`

**Interfaces:**

- Consumes `Settings.unit`, full backup V2, and version-1/2 import.
- Export rows render in both Profile and Import/Export; no empty export panel.

- [ ] **Step 1: Add failing settings/export e2e checks**

```ts
test('profile switches units and import export exposes complete backup', async ({ page }) => {
  await page.getByRole('button', { name: /profile|profilo/i }).click();
  await page.getByRole('button', { name: 'lb' }).click();
  await expect(page.getByText(/lb/).first()).toBeVisible();
  await page.getByRole('button', { name: /import|importa/i }).click();
  await expect(
    page.getByRole('button', { name: /complete backup|backup completo/i }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /csv/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm e2e --grep "profile switches units"`

Expected: FAIL because unit controls are absent and ImportExport has an empty export card.

- [ ] **Step 3: Recompose the settings/data screens**

Remove program start. Add one kg/lb segmented control with full labels. Keep sync state in text, not color alone. Make each settings row a native control with clear label/value hierarchy. Extract `ExportRows` from the ImportExport route into the shared component, then render it in both Profile and ImportExport's export group so Profile does not statically import the route module. Show version-2 collection counts in preview, disable import while busy with a visible progress label, and retain valid error toast.

- [ ] **Step 4: Verify this screen group**

Run: `pnpm e2e --grep "profile switches units" && pnpm i18n && pnpm test && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExportRows.tsx src/screens/Profile.tsx src/screens/ImportExport.tsx src/theme/tokens.css src/i18n/it.json src/i18n/en.json e2e/core.spec.ts
git commit -m "style: clarify settings and data ownership"
```

### Task 7: Route splitting and catalog deferral

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/state/useStore.ts`
- Modify: `src/lib/exercises.ts`
- Create: `src/hooks/useCatalog.ts`
- Modify: `src/components/WorkoutList.tsx`
- Modify: `src/components/RestBar.tsx`
- Modify: `src/components/RestWatcher.tsx`
- Modify: `src/screens/Login.tsx`
- Modify: `src/screens/Home.tsx`
- Modify: `src/screens/Train.tsx`
- Modify: `src/screens/RoutineEditor.tsx`
- Modify: `src/screens/Workout.tsx`
- Modify: `src/screens/Summary.tsx`
- Modify: `src/screens/WorkoutDetail.tsx`
- Modify: `src/screens/Progress.tsx`
- Modify: `src/screens/Library.tsx`
- Modify: `src/screens/ExerciseSheet.tsx`
- Modify: `src/screens/ImportExport.tsx`
- Modify: `vite.config.ts` if chunk naming requires a stable split

**Interfaces:**

- Store produces idempotent `ensureCatalog(): Promise<void>`.
- `useCatalog(required = true)` triggers loading in visible exercise-name/search screens.
- App uses `React.lazy` for non-Home routes and a screen-shaped Suspense fallback.

- [ ] **Step 1: Record the production baseline**

Run: `pnpm build`

Expected baseline: approximately 1.03MB uncompressed initial JS, a roughly 600KB app chunk, and eager 1MB catalog request as recorded by the audit.

- [ ] **Step 2: Implement idempotent screen-triggered loading**

Remove eager `loadCatalog` from the `setUser` boot path while preserving every account-generation fence. `ensureCatalog` returns immediately when ready, otherwise shares the existing catalog promise, registers custom exercises after resolve, and sets `catalogReady`. Home requests the catalog only when it has workouts to name; Train does not need it until Routine Editor or Workout opens. Audit every listed catalog consumer and stage the hook only where exercise names or search are visible. Schedule an idle prefetch after Home's useful paint using `requestIdleCallback` with a 2s timeout fallback, canceling on unmount.

- [ ] **Step 3: Lazy-load route modules**

Keep Login and Home eager. Lazy-load Train, Profile, Workout, Summary, WorkoutDetail, Progress, Library, ExerciseSheet, ImportExport, RoutineEditor, and History. Use one minimal skeleton matching page header and two content rows; preserve active-route recovery under Suspense.

- [ ] **Step 4: Verify chunk and runtime behavior**

Run: `pnpm test && pnpm e2e && pnpm build`

Expected: all tests PASS, no application chunk exceeds 500KB, and a cold empty Home does not request `/data/exercises.json` before idle prefetch or an exercise-dependent screen.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/state/useStore.ts src/lib/exercises.ts src/hooks/useCatalog.ts src/components/WorkoutList.tsx src/components/RestBar.tsx src/components/RestWatcher.tsx src/screens vite.config.ts
git commit -m "perf: split routes and defer the exercise catalog"
```

### Task 8: Documentation and full preflight

**Files:**

- Modify: `README.md`
- Modify: `PRODUCT.md`
- Review: all visible i18n strings and all changed UI files

**Interfaces:**

- Documentation describes the shipped generic product, neutral progression, two note scopes, full backup, units, and deployment.

- [ ] **Step 1: Update product documentation**

Remove seeded comeback and phase-aware claims. Describe neutral templates, editable preparation/warm-ups, history-based double progression, Technique/This session, kg/lb display, complete JSON backup, privacy, and no social/paywall.

- [ ] **Step 2: Run mechanical visual-copy checks**

Run: `! rg -n -i 'Operazione Rientro|\bbulk\b|\bmassa\b|\bsurplus\b|\bwhey\b|tell me|dimmelo|phase1|deload' src/i18n README.md PRODUCT.md && ! rg -n 'programStart(Date)?' src --glob '!src/lib/types.ts' --glob '!src/lib/__tests__/**'`

Expected: both scoped searches return no visible-product matches. Historical fixture data, type compatibility fields, tests, and implementation identifiers are excluded deliberately instead of weakening the product-copy check.

- [ ] **Step 3: Run Design Taste and Impeccable preflight manually**

Confirm design read/dials, one accent, one radius rule, button/input contrast, no duplicate CTA intent, no decorative nav dot, no tiny labels, both themes, reduced motion, empty/loading/error/success, and no new dependency. Record any remediation directly in the relevant files.

- [ ] **Step 4: Run full local verification**

Run: `pnpm i18n && pnpm test && pnpm e2e && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add README.md PRODUCT.md src e2e
git commit -m "docs: describe the generalized Overload product"
```

### Task 9: Whole-repository Ponytail simplicity audit

**Files:**

- Review: complete repository, production dependencies, source, tests, build configuration, and changed documentation
- Create ignored evidence: `.superpowers/sdd/2026-08-25-overload-ui-system-delivery/task-9-ponytail-audit.md`
- Modify only when the audit demonstrates a behavior-preserving simplification: relevant source/test/config files

**Interfaces:**

- Ponytail Audit produces a ranked delete/simplify/replace report before code changes.
- Ponytail applies only evidence-backed cuts; no speculative abstraction, dependency, or feature change.

- [ ] **Step 1: Record a clean behavioral baseline**

Run: `pnpm i18n && pnpm test && pnpm e2e && pnpm build && git diff --check`

Expected: all commands exit 0 before simplicity changes.

- [ ] **Step 2: Run Ponytail Audit over the whole repository**

Inspect every production module, test helper, dependency, route, style layer, and build/deploy configuration. Rank findings by deletion/simplification value and risk. Explicitly protect account-owner fences, local-write barriers, Technique sequencing, routine draft durability, backup V1/V2 compatibility, journal identity, and tracking/unit boundaries. Record justified non-findings as well as actionable cuts.

- [ ] **Step 3: Apply the smallest useful cuts with TDD**

For each accepted finding, first prove the preserved behavior or defect boundary with a focused test, then remove dead code, collapse needless indirection, or use the platform/library primitive already present. Reject any cut that merely shortens code while obscuring concurrency, accessibility, persistence, or product intent. Do not force changes when the audit finds no worthwhile simplification.

- [ ] **Step 4: Re-run complete verification and independent review**

Run: `pnpm i18n && pnpm test && pnpm e2e && pnpm build && pnpm exec prettier --check . && git diff --check`

Expected: all commands exit 0; independent review confirms both behavior preservation and genuine simplicity gain.

- [ ] **Step 5: Commit only justified changes**

If production changes exist, commit the exact reviewed files with `refactor: simplify the shipped app`. If none exist, record `changes: none` in the ignored audit and advance without an empty commit.

### Task 10: Fresh external UI/a11y review and production deployment

**Files:**

- Review: complete built app and Firebase configuration
- Modify: `firebase.json`
- Modify: `playwright.config.ts` if needed to guarantee worktree-local E2E
- Modify only if review finds a defect: relevant source/test files

**Interfaces:**

- Produces verified production deployment and final branch reconciliation evidence.

- [ ] **Step 1: Fetch the current Vercel Web Interface Guidelines**

Fetch `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`, review every relevant rule against the changed files, and fix all actionable findings. Use primary official guidance only.

- [ ] **Step 2: Run two bounded browser-QA rounds**

Before either round, prove the Playwright server belongs to this worktree. Do not accept `reuseExistingServer` when port 5199 is served from another checkout; stop only the verified stale process or use a worktree-specific port/fail-fast configuration. Round 1 covers all routes/states at 390×844 dark/light and representative 1440×1024 desktop. Round 2 rechecks only remediated screens plus 320px active workout, mobile landscape, keyboard-only navigation, reduced motion, offline reload, and active-session recovery. Store every capture outside the repository and confirm clean git status.

- [ ] **Step 3: Run final verification from a clean tree**

Run: `pnpm i18n && pnpm test && pnpm e2e && pnpm build && git status --short`

Expected: all commands exit 0 and status contains only intentional committed state (empty after final commit).

- [ ] **Step 4: Integrate and deploy**

Use the finishing-development-branch skill. Add Firebase Hosting cache headers so `index.html`, `sw.js`, and `registerSW.js` revalidate, hashed assets are long-lived immutable, and baseline `X-Content-Type-Options`/`Referrer-Policy` headers are present without breaking Firebase Auth, Google sign-in, or embedded exercise video. Fast-forward or merge `codex/mobile-ui-notes` into `main` without rewriting unrelated history, push `origin/main`, rebuild from the integrated revision, assert `dist/index.html`, `dist/sw.js`, and `dist/data/exercises.json` exist, then deploy only `hosting,firestore:rules` to `overload-sdc`. Do not run the unpinned `fetch-media.mjs --all` during release: the complete media set is already tracked and a fresh upstream clone would introduce unreviewed artifacts. Do not delete user branches or worktrees without separate evidence and authorization.

- [ ] **Step 5: Smoke-test production and record evidence**

Open the deployed URL and verify login shell, Home, routine editing, warm-up, active workout, Technique/This session, finish/history/journal, unit switch, backup download/import preview, offline reload, and both locales. Confirm the deployed revision matches the pushed main commit. Commit any production-only fix with a focused regression test, redeploy, and repeat this step.

- [ ] **Step 6: Deliver a result-only visual gallery**

Capture the deployed Italian mobile experience with realistic data across Login, Home, Train, Routine Editor, active Workout, both note scopes, Summary, History, Workout Detail, Exercise Detail/Journal, Library, Progress, Nutrition, Profile, and Import/Export. Include representative dark/light views where the theme materially changes the result. Store the final images under `~/Workspace/Codex` outside the repository and present them with the live URL; keep the user-facing handoff focused on the product result, not implementation details.
