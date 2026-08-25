# Verdict: REDESIGN

**REDESIGN — At 15/30, Overload has strong product and brand foundations, but its load-bearing workout and note structures are not understandable or restrained enough to solve with styling alone.**

## Preserve

- Graphite/volt tokens, Archivo and JetBrains Mono, direct voice, and dark-first gym suitability (`src/theme/tokens.css:3-29`).
- Local-first active-session persistence, rest timer continuity, and minimized-workout recovery (`src/state/useStore.ts:53-85`, `src/components/ActiveWorkoutBar.tsx:22-43`).
- The core five destinations and existing product capabilities, unless a screen-level audit proves a duplicate route.

## Discard

- Date-keyed “next time” notes masquerading as session notes (`src/state/useStore.ts:525-541`).
- One visual chip grammar for both information and actions, including duplicate technique navigation (`src/screens/Workout.tsx:99-131`).
- Arbitrary per-screen spacing/type values and active-workout completion controls placed only after the full exercise list (`src/theme/tokens.css`, `src/screens/Workout.tsx:288-301`).
- Personal comeback templates and global phase assumptions presented as the default product (`src/data/templates.ts`, `src/lib/progression.ts`).
- A history-only Home and read-only warm-up prescriptions (`src/screens/History.tsx`, `src/screens/RoutineEditor.tsx`).

## Highest-leverage moves

1. **Principle #4 — Understandable:** Replace the ambiguous note model with exactly two user-facing scopes: a global, always-editable “Tecnica” note per exercise and a “Questa sessione” note saved with its workout. Evidence: `01-evidence.md#4-understandable`.
2. **Principle #2 — Useful:** Make the live workout the product’s fastest surface: sticky completion, aligned previous values, touch-first numeric entry, and no redundant technique action. Evidence: `01-evidence.md#2-useful`.
3. **Principle #10 — As little design as possible:** Establish one spacing/type/control system and distinct grammars for metadata versus actions across every screen. Evidence: `01-evidence.md#10-as-little-design-as-possible`.
4. **Principle #8 — Thorough:** Complete dialog focus/escape/restore behavior, live-region feedback, safe-area handling, visible disabled states, and light-mode contrast. Evidence: `01-evidence.md#8-thorough`.
5. **Principle #9 — Environmentally friendly:** Split non-primary screens and defer the exercise catalog until an exercise surface needs it. Evidence: `01-evidence.md#9-environmentally-friendly`.
