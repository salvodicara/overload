```text
/make-plan Redesign Overload's complete mobile-first application, with the active workout and notes as the load-bearing flow. Current design failed audit at 15/30 with critical gaps in principles #2 useful, #4 understandable, #6 honest, #9 environmentally friendly, and #10 as little design as possible.

Verdict paragraph (quoted from 03-verdict.md):
> REDESIGN — At 15/30, Overload has strong product and brand foundations, but its load-bearing workout and note structures are not understandable or restrained enough to solve with styling alone.

Why redesign and not refine: the total is below 20 and the central note model cannot truthfully represent session-specific observations; structural and data changes are required.

Preserve from current design:
- Graphite/volt tokens, Archivo and JetBrains Mono, direct voice, and dark-first gym suitability (`src/theme/tokens.css:3-29`).
- Local-first active-session persistence, rest timer continuity, and minimized-workout recovery (`src/state/useStore.ts:53-85`, `src/components/ActiveWorkoutBar.tsx:22-43`).
- The core five destinations and existing product capabilities, unless a screen-level audit proves a duplicate route.

Discard:
- Date-keyed “next time” notes masquerading as session notes. Evidence: `src/state/useStore.ts:525-541`. Caused failure on principles #4 and #6.
- One visual chip grammar for both information and actions, including duplicate technique navigation. Evidence: `src/screens/Workout.tsx:99-131`. Caused failure on principles #4 and #10.
- Arbitrary per-screen spacing/type values and active-workout completion controls placed only after the full exercise list. Evidence: `src/theme/tokens.css`, `src/screens/Workout.tsx:288-301`. Caused failure on principles #2, #3, and #10.

Top moves from the audit, verbatim:
1. Principle #4 — Understandable: Replace the ambiguous note model with exactly two user-facing scopes: a global, always-editable “Tecnica” note per exercise and a “Questa sessione” note saved with its workout. Evidence: `01-evidence.md#4-understandable`.
2. Principle #2 — Useful: Make the live workout the product’s fastest surface: sticky completion, aligned previous values, touch-first numeric entry, and no redundant technique action. Evidence: `01-evidence.md#2-useful`.
3. Principle #10 — As little design as possible: Establish one spacing/type/control system and distinct grammars for metadata versus actions across every screen. Evidence: `01-evidence.md#10-as-little-design-as-possible`.
4. Principle #8 — Thorough: Complete dialog focus/escape/restore behavior, live-region feedback, safe-area handling, visible disabled states, and light-mode contrast. Evidence: `01-evidence.md#8-thorough`.
5. Principle #9 — Environmentally friendly: Split non-primary screens and defer the exercise catalog until an exercise surface needs it. Evidence: `01-evidence.md#9-environmentally-friendly`.

Redesign principles in priority order:
1. Useful — a set is logged with one thumb and no scroll detour.
2. Understandable — every note declares whether it persists across exercises or belongs to this workout.
3. As little design as possible — one visual grammar, no duplicate actions, no tiny ornamental labels.

Deliverables for the plan:
- New screen/system architecture and a mobile-first active-workout flow, compared with the current path.
- Backward-compatible data migration/fallback for existing routine notes and imported dated notes.
- Full state checklist: empty, loading, error, success, focus, disabled, offline, active rest, resumed workout.
- Tests for note scope, same-day sessions, persistence/reload, workout detail, import/export, keyboard/touch flow, and regressions across every route.
- Cutover criteria: existing data remains readable, all tests pass, two bounded visual QA rounds close, production deploy succeeds.

Anti-patterns to guard against:
- Porting the old card structure under new CSS.
- Keeping both note models visible indefinitely.
- Copying Hevy's visual composition or proprietary assets instead of its interaction discipline.
- Letting mobile density create sub-12px task text or sub-touch-size controls.
```
