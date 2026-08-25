# Evidence

## 1. Innovative

- Active sessions and their rest timer survive refresh/PWA eviction through local persistence (`src/state/useStore.ts:53-85`, `src/state/useStore.ts:315-337`, `src/state/useStore.ts:468-478`).
- A minimized workout remains reachable from every tab through a persistent banner (`src/App.tsx:117-125`, `src/components/ActiveWorkoutBar.tsx:22-43`).

## 2. Useful

- Weight, reps, and completion are directly editable in each exercise card (`src/screens/Workout.tsx:230-280`).
- A representative three-set exercise requires 16 controls; a seven-exercise seeded workout renders about 3,371px before its finish controls in the 390px capture.
- Prior work is compressed into one prose line instead of aligned set-by-set values (`src/screens/Workout.tsx:92-93`, `src/screens/Workout.tsx:161-165`).
- The model exposes `Workout.note`, but native UI cannot author it (`src/lib/types.ts:9-22`, `src/screens/WorkoutDetail.tsx:101-105`).
- `Routine.warmup` is displayed during training but has no editor, so a core prescription is effectively hard-coded after template adoption (`src/lib/types.ts:36-44`, `src/screens/Workout.tsx:82-86`, `src/screens/RoutineEditor.tsx`).
- Home is a weekly total followed by the full history list; it provides no contextual next action when routines exist (`src/screens/History.tsx`).

## 3. Aesthetic

- One coherent graphite/volt token system, two type families, semantic colors, and shared radii exist (`src/theme/tokens.css:3-29`).
- Runtime/source inspection found 17 spacing values and 16 type sizes; labels as small as 10–11.5px appear in navigation, chips, and set headings (`src/theme/tokens.css:97-99`, `src/theme/tokens.css:310-318`, `src/theme/tokens.css:371-380`, `src/theme/tokens.css:474-501`).
- Mobile layout avoids horizontal overflow, but long titles and metadata wrap unpredictably in the active workout capture.

## 4. Understandable

- `RoutineExercise.note` is routine-scoped and read-only during a workout (`src/lib/types.ts:24-44`, `src/screens/Workout.tsx:160`).
- `ExerciseNote.entries` is global by exercise and date, while the UI calls it both “nota per la prossima volta” and “diario” (`src/lib/types.ts:46-52`, `src/i18n/it.json:224-253`).
- Same-day editing overwrites the existing date entry, so it is not actually session-scoped (`src/state/useStore.ts:525-541`).
- `.chip` is used for both static metadata and actions in at least 23 source locations; the exercise name and “Tecnica” chip can navigate to the same place (`src/screens/Workout.tsx:99-131`).

## 5. Unobtrusive

- Bottom navigation is hidden during the workout, leaving the task as the focus (`src/components/Nav.tsx:21-28`).
- The visual chrome is quiet, but the repeated chips, note/history affordances, inputs, and row actions create dense control fields in every exercise card (`src/screens/Workout.tsx:95-283`).

## 6. Honest

- “Backup completo (JSON)” serializes only workouts, routines, and settings while the local model also stores folders, notes, measurements, nutrition, and custom exercises (`src/lib/exporter.ts:7-15`, `src/lib/db.ts:4-12`, `src/i18n/it.json:157`).
- “Nota per la prossima volta” edits a global last entry and can overwrite another note from the same day (`src/i18n/it.json:248-253`, `src/state/useStore.ts:525-536`).
- No forced continuity, hidden cost, false scarcity, or confirmshaming was found; destructive actions have confirmation dialogs.
- The universal “program start” UI activates an eight-week comeback/deload phase model, even though most user programs do not share that lifecycle (`src/screens/Train.tsx`, `src/screens/Profile.tsx`, `src/lib/progression.ts:20-39`).

## 7. Long-lasting

- Native HTML controls, system theme support, a restrained palette, and typography optimized for numeric work are durable foundations (`src/theme/tokens.css:3-71`, `src/theme/tokens.css:152-304`).
- The dense card-plus-chip treatment and mixed tiny uppercase/mono labels are recognizable contemporary app conventions rather than product-specific structure.

## 8. Thorough

- Empty, loading, error, success, focus, and disabled states all exist, but disabled styling relies mainly on opacity (`src/theme/tokens.css:300-304`).
- Dialogs declare `role="dialog"` and `aria-modal`, but do not trap focus, handle Escape, or restore focus (`src/screens/Workout.tsx:303-315`, `src/screens/WorkoutDetail.tsx:115-133`).
- Toasts lack live-region semantics (`src/App.tsx:53-66`).
- Light-mode good and warning banners measure 3.76:1 and 4.27:1, below 4.5:1 for normal text (`src/theme/tokens.css:31-49`).

## 9. Environmentally friendly

- Initial JavaScript is 1,030,790 bytes uncompressed / about 308KB gzip, and the eager exercise catalog adds about 1,001,472 bytes before the primary home task. Vite reports a 600KB app chunk.
- No route-level code splitting exists (`src/App.tsx:10-21`).
- Nonessential motion is gated by `prefers-reduced-motion`; no normal idle animation runs on home/train (`src/theme/tokens.css:578-693`).

## 10. As little design as possible

- Exercise-name and technique-chip navigation are duplicates, while informational and actionable chips share the same visual grammar (`src/screens/Workout.tsx:99-131`).
- The active workout’s DOM order places finish/abandon after every set control, creating a long keyboard path (`src/screens/Workout.tsx:88-315`).
- A strict base spacing/type scale is absent despite shared tokens (`src/theme/tokens.css:24-29`, runtime computed-style inventory).
- A personal “Operazione Rientro” pack is offered alongside generic templates, and global phase logic adds a product subsystem where history-based double progression is sufficient (`src/data/templates.ts`, `src/data/seedRoutine.ts`, `src/lib/progression.ts`).

## Runtime measurements and gaps

- 390×844: no horizontal overflow; numeric inputs were approximately 104×41px, completion controls 60×46px, and the open note editor 324×50px.
- Only one landmark (`nav`) exists; no `main`, `header`, or skip link was found.
- Real iPhone/Safari, VoiceOver, axe, and throttled production measurements were not part of the baseline audit.
