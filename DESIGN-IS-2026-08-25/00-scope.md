# Scope

## Audited product

The complete Overload PWA in this repository: authentication, history, training/routines, routine editor, exercise library and detail, active workout, summary, workout detail, progress/body/diet, profile, and import/export, including the global navigation, active-workout banner, rest timer, dialogs, toast, inputs, and empty/loading/error states.

## Primary audience and task

Independent strength trainees, primarily using a phone in the gym. Salvatore is the first demanding real-world user, not a product-specific persona encoded into defaults. The load-bearing task is completing a live workout quickly and safely: read the next exercise, recall technique and prior performance, enter weight/reps, complete a set, recover, add an observation, and finish without losing state.

## Constraints

- Existing React/TypeScript/Zustand/Dexie/Firebase PWA stack.
- Offline-first behavior and current workout persistence are non-negotiable.
- Italian-first, English-complete copy.
- Preserve the Overload name and its graphite/volt athletic identity.
- Every program, routine, warm-up, target, and progression input must be user-owned or an explicitly optional starter template.
- Mobile-first, WCAG 2.2 AA, reduced-motion support, no proprietary competitor assets.
- Deploy to the existing Firebase Hosting target after verification.

## References and inputs

- Current source under `src/`, current production build, and Playwright flows under `e2e/`.
- Runtime captures at 390×844 and 1440×1024 collected on 2026-08-25.
- Hevy as the user-pinned primary interaction benchmark. Its published documentation distinguishes reusable routine notes from workout-specific notes; Overload must improve on that clarity by allowing the persistent technique note to be edited wherever it is encountered.
- StrengthLog, Strong, FitNotes, JEFIT, and focused progression apps as secondary pattern references for configurable routines, dashboards, history, and active logging.
- Approved product spec: `docs/superpowers/specs/2026-08-24-overload-design.md`.
