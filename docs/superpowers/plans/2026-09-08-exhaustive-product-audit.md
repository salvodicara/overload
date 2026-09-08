# Exhaustive product audit implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute evidence-led repairs with independent review.

**Goal:** Inspect every shipped screen and core data boundary, correct demonstrated defects, and account for coverage without equating passing tests with usability certainty.

**Architecture:** Preserve existing three-tab navigation and established workout/food-diary patterns. Inventory first, reproduce failures, repair their shared cause at the narrowest appropriate boundary, then verify the stable combined code.

**Tech Stack:** React, TypeScript, Zustand, Dexie, Firebase, Vitest, Playwright.

**Spec:** PRODUCT.md and the user's request for a comprehensive audit, including prior personal workflows.

## Global constraints

- Keep Home / Train / Profile, graphite/volt styling, Italian and English, Android installed PWA.
- Preserve personal data; production checks are read-only. All mutation/fault tests use synthetic local accounts.
- Reuse the existing isolated worktree under ~/Workspace/Codex; baseline55053b1 has364unit and118E2E passing.
- Existing authorization covers fixes, push and deployment. Do not ask again for routine decisions.
- Never claim zero unknown defects, formal accessibility certification, or physical-device verification without evidence.
- Read-only investigations may run independently. Implementation ownership is serialized across shared files; root owns useStore and integration tests.

### Task1: Complete surface and state inventory

Files: src/screens/*.tsx, src/components/*.tsx, src/App.tsx, src/hooks/*.ts; reports under ~/Workspace/Codex/overload-qa/deep-{training,personal,browse}-audit.md.

- [x] Enumerate every route from src/state/useStore.ts and every screen/component file; assign one audit owner per surface.
- [x] Read each assigned source in full and inspect entry/actions/options/exit/empty/error/pending/long text/narrow layout states. Record source-only versus browser evidence for every surface.
- [x] Reproduce suspected failures with synthetic data and record expected behavior, actual behavior, affected files and severity.
- [x] Map each actionable change to existing product grammar or official reference behavior before repair.

### Task2: Audit data and lifecycle boundaries

Files: src/state/useStore.ts; src/lib/{db,sync,session,activeWorkout,workoutTiming,workoutEditing,progression,routines,routinePlan,foodDiary,foodImport,foodCatalog,importer,hevyCsv,exporter,migrate}.ts.

- [x] Inspect every write/transition for validation, ownership, duplicate occurrence identity, ordering, failure/retry and persistence.
- [x] Add executable regressions for demonstrated domain defects before implementation. Run `pnpm exec vitest run <affected test file>` and record the failing assertion.
- [x] Repair the cause in existing boundaries; run affected tests and review all callers for behavior compatibility.

### Task3: Repair demonstrated surface failures

Files: only screens/components/styles named by confirmed findings; relevant domain tests and e2e/core.spec.ts.

- [x] For each finding, append exact reproduction/repair/verification to the audit record before code changes.
- [x] Use existing pending/error/empty/validation/focus patterns; keep user input and prevent unintended navigation or duplicated writes.
- [x] Browser-check each repaired action with failure, recovery and realistic synthetic content; independent reviewer checks correctness and product intent.

### Task4: Whole-app visual and interaction verification

Files: local QA scripts/reports and e2e/core.spec.ts; no new product features.

- [x] Batch every route and material dialog with empty/populated cases at320/390px, Italian/English and both themes; inspect captures and run overflow/accessible-name/focus diagnostics.
- [x] Include long names, large quantities, enlarged text, keyboard access, repeated exercises, reload, interrupted writes and cold catalogue failure.
- [x] Resolve all confirmed findings from the batch; classify limitations honestly and avoid speculative score claims.
- [x] Freeze source. Run `pnpm test`, `pnpm build`, `pnpm exec playwright test`; inspect all results. Re-run affected checks after fixes and final suite when integration changed.

### Task5: Review and authorized release

Files: docs/superpowers/2026-09-08-exhaustive-product-audit-results.md.

- [x] Independent whole-diff review; reconcile all discovered findings with fixed/tested/not-reproduced/external-limit evidence.
- [x] Commit and push isolated branch, fast-forward main only if safe, push main.
- [x] Deploy existing Firebase Hosting build, compare published hashes with build, verify real login and offline shell read-only.
- [x] Report actual coverage and findings; no absolute quality guarantee.
