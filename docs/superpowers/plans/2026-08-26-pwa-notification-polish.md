# PWA Notification and Product Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove stale rest notifications and finish Overload's browser, desktop, PWA, motion, metadata, and icon presentation.

**Architecture:** Encapsulate tagged notification lifecycle helpers, then derive every browser/PWA asset from one Overload master mark. Finish with bounded Impeccable and browser-QA passes.

**Tech Stack:** Notifications API, service worker registration, Vite PWA, React, CSS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-overload-workout-lifecycle-parity.md`

## Global Constraints

- Notification cleanup is best effort and never blocks workout state.
- Preserve graphite/volt identity and equal-quality light/dark modes.
- Meet WCAG 2.2 AA and `prefers-reduced-motion`.
- Screenshots, not code inspection, are final visual authority.

---

### Task 1: Tagged rest-notification lifecycle

**Files:**
- Modify: `src/lib/audio.ts`
- Modify: `src/components/RestWatcher.tsx`
- Modify: `src/state/useStore.ts`
- Test: `src/lib/__tests__/audio.test.ts`

**Interfaces:**
- Produces: `REST_NOTIFICATION_TAG`, `closeRestNotifications()`, `notifyRestOver(title, body)`.

- [ ] **Step 1: Write failing tests that mock `showNotification`, `getNotifications`, and `Notification.close`; assert old notifications close before replacement and on explicit cleanup**
- [ ] **Step 2: Run `pnpm vitest run src/lib/__tests__/audio.test.ts`; expect FAIL**
- [ ] **Step 3: Implement tagged close/show helpers with `requireInteraction: false`, timestamp/data expiry, and guarded errors**

```ts
export async function closeRestNotifications(): Promise<void> {
  const registration = await navigator.serviceWorker?.ready;
  const notifications = await registration?.getNotifications({ tag: REST_NOTIFICATION_TAG });
  notifications?.forEach((notification) => notification.close());
}
```

- [ ] **Step 4: Close on visibility/focus, stop, new timer, and notification replacement; schedule a short best-effort relevance timeout after show**
- [ ] **Step 5: Run focused tests and build; expect PASS**
- [ ] **Step 6: Commit `fix: clear expired rest notifications`**

### Task 2: App mark, favicon, and manifest

**Files:**
- Create: `public/icons/overload-mark.svg`
- Create: generated `public/icons/favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`
- Modify: generated `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- Modify: `index.html`
- Modify: `vite.config.ts`
- Modify: `src/App.tsx`
- Test: `src/lib/__tests__/appShell.test.tsx`

**Interfaces:**
- Produces: one visual master mark and route-aware `document.title` values.

- [ ] **Step 1: Add failing shell tests for favicon, Apple icon, application metadata, theme colors, manifest entries, and route-aware titles**
- [ ] **Step 2: Run the focused test; expect missing metadata/assets**
- [ ] **Step 3: Create the minimal graphite/volt Overload mark, inspect it at 16, 32, 180, 192, and 512 px, then generate raster derivatives from the master**
- [ ] **Step 4: Add explicit favicon/Apple metadata, manifest scope/start URL/icon purposes, and localized route titles**
- [ ] **Step 5: Run build and inspect generated manifest/assets; expect correct paths and no unsafe-zone clipping**
- [ ] **Step 6: Commit `feat: finish Overload browser and PWA identity`**

### Task 3: Final interaction and responsive polish

**Files:**
- Modify: `src/theme/tokens.css`
- Modify only screen/component files with defects found by the bounded audit
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: all completed product surfaces.
- Produces: final phone/desktop interaction quality and regression coverage.

- [ ] **Step 1: Load Impeccable craft floor and polish references, then run its detector once over changed UI targets**
- [ ] **Step 2: Run one browser-QA capture pass covering required mobile/desktop, light/dark, long-note, large-value, empty/loading/error, and reduced-motion states**
- [ ] **Step 3: Batch-fix hierarchy, overflow, hover/focus, touch geometry, animation, and desktop-width defects shown by evidence**
- [ ] **Step 4: Run one confirmation screenshot pass and stop polishing after it passes**
- [ ] **Step 5: Run `pnpm i18n`, `pnpm test`, `pnpm build`, and full `pnpm e2e`; expect PASS**
- [ ] **Step 6: Commit `style: complete final product polish`**

### Task 4: Release evidence

**Files:**
- Create: `artifacts/screenshots/2026-08-26-workout-lifecycle-final/` screenshots
- Modify: release documentation only if the repository already tracks equivalent evidence

**Interfaces:**
- Produces: user-facing screenshots and deployable build.

- [ ] **Step 1: Capture Home week/month/year, History list/calendar, active workout, technique/session notes, workout detail/editor, routine-update sheet, browser favicon, and installed-PWA states**
- [ ] **Step 2: Verify screenshots against the approved specification and ensure no debug/test data leaks outside the E2E profile**
- [ ] **Step 3: Run the verification-before-completion checklist and inspect `git diff --check` and repository status**
- [ ] **Step 4: Commit screenshot evidence separately from code**
- [ ] **Step 5: Merge and deploy only after every gate is green, then smoke-test the hosted PWA**
