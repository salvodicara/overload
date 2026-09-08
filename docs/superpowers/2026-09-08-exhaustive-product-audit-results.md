# Comprehensive product audit — 8 September 2026

This audit supersedes the earlier readiness claim. Baseline `55053b1` passed 364 unit tests and 118 browser scenarios, but the adversarial review still found defects. Passing that suite did not establish that all interactions, failures or data transitions had been checked.

## Method and product decisions

All 25 screen modules, both hooks and shared interactive components were inventoried and read. Three independent investigations covered training, personal data/nutrition, and browsing/navigation. The integration review traced persistence, synchronization, import/export, account ownership, session identity, progress and historical recomputation. Confirmed failures received focused regressions or browser reproductions, followed by a combined source freeze and complete verification.

The product keeps Home / Train / Profile and the existing Archivo, graphite and volt styling. No new navigation model was invented. Preparing routines, using previous results while logging, opening technique notes, timing rests, and reviewing history follow established workout-log patterns. Nutrition keeps a dated diary with meals, portions, food search, saved meals and imports.

Reference basis: [Hevy tutorial](https://www.hevyapp.com/hevy-tutorial/), [Strong templates](https://help.strongapp.io/article/105-about-templates), [StrengthLog home screen](https://help.strengthlog.com/help-article/the-home-screen/), and [Hevy duration correction](https://www.hevyapp.com/help/adjust-the-duration-workout/). These inform interaction conventions; this is an adaptation to Overload's personal, non-social scope, not a claim of visual or feature identity with those products.

## Findings and resolution ledger

### Training

| ID | Demonstrated problem | Result and verification |
|---|---|---|
| T1 | Invalid routine counts, ranges and loads autosaved without feedback | Invalid drafts remain editable, last valid routine stays durable, Start is blocked, validation is visible. Domain and browser regression. |
| T2 | Repeated exercise inherited another occurrence's reps, rest and previous results | Exact occurrence/tracking identity; target reps and rest snapshot at start; explicit legacy fallback. Session/progression/previous tests and browser reload probe. |
| T3 | Negative loads, fractional reps and empty timed sets could complete/save | Validate completion and final persistence, with actionable feedback. Unit and browser regression. |
| T4 | Replacement exercise could edit the original routine's technique | Only linked occurrences expose that routine note; replacements retain session notes. Focused browser and caller regression. |
| T5 | Edits and repeated Finish raced a pending save; completion could steal navigation | Freeze active edits, deduplicate completion, retain session/route ownership, use session start day across midnight. Deferred-write tests and browser pending checks. |
| T6 | Goal-type changes retained incompatible warmups | Convert compatible targets, remove weight-only values where irrelevant, validate before saving. Unit and browser checks. |
| T7 | Summary Apply had no failure/lock contract and could apply another workout's proposal | Proposal belongs to workout and base routine revision; Apply/dismiss lock and retry feedback; protect newer edits. Concurrency tests and browser reproduction. |
| T8 | Delayed Start/Delete navigated after leaving; unsaved drafts vanished on reload | Route/mount/account guards, delete feedback, persistent account-scoped failed/invalid drafts and saved-copy cleanup. Reload and unit regressions. |
| T9 | Reinstalling a partial template overwrote retained customizations | Install missing members only. Regression preserves edited day A while restoring day B. |
| T10 | Editing after starting/stopping rest erased or revived its deadline | Active object and persisted timer share the same state. Reload and edit/stop regressions. |
| T11 | Historical editor could only add weight/reps exercises | Existing Goal type choice added to picker; timed rows persist seconds without fake repetitions. Prior values filter by tracking and occurrence. Unit and browser 45-second Plank regression. |

### Personal data, nutrition and access

| ID | Demonstrated problem | Result and verification |
|---|---|---|
| P1 | Malformed backup records could be accepted then crash rendering | Collection/record validation before atomic restore; reject malformed measurements, dates, settings and other record shapes. Parser, persistence and browser regression. |
| P2 | Older manual-nutrient autosave acknowledgment discarded newer typing | Controlled/versioned blur-save retains newer draft and saves it on next blur. Delayed 100→200 browser probe. |
| P3 | Food/measurement inputs remained editable while an older submitted snapshot saved | Freeze submitting fieldsets and retain failed values. Pending browser probes. |
| P4 | Measurement delete failure was hidden behind its modal | Error and retry remain inside the active confirmation dialog. Browser rejection probe. |
| P5 | Import completion forced Home after leaving the import screen | Route/mount/account guard suppresses stale navigation. Browser delayed completion. |
| P6 | Settings write failure was unhandled | Pending/error feedback and retry, including targets. Browser rejection/recovery. |
| P7 | Compact nutrients presented incomplete totals without indication | Partial coverage remains visible in compact and expanded views. Render test and browser fixture. |
| P8 | Extremely small saved-meal quantity crashed preview | Validate scaling before computing preview; invalid amount remains correctable. Underflow browser probe. |
| P9 | Manual nutrient bounds disagreed with food snapshots | Consistent supported range for new values; readable legacy totals remain correctable. Boundary/import tests. |
| P10 | Huge body measurements rendered Infinity | Finite supported measurement range at import and write boundaries. Tests and browser validation. |
| P11 | Weekly body average included future records | Average excludes dates after today. Regression test and browser fixture. |
| P12 | CSV export omitted timed-set data | Preserve tracking, duration_sec and set_kind after the existing five columns. Export regression. |
| P13 | Manual history displayed food-derived aggregates as manual entries | History uses actual manual entries/totals only. Browser fixture. |
| P14 | Login cache reset failed silently; cancelled Google popup redirected | Recoverable reset feedback and correct cancellation handling. Browser reset failure and Firebase cancellation tests. |

### Browsing and shared navigation

| ID | Demonstrated problem | Result and verification |
|---|---|---|
| B1 | Deleting a workout triggered render navigation and a Back trap | Explicit missing-record state in Detail/Summary; guarded single deletion return. Browser regression. |
| B2 | Repeated Save as routine/Repeat clicks duplicated writes; errors were silent | Shared pending lock, retained form/error, stale-route guard including store-level Repeat. Browser delayed/rejected actions. |
| B3 | Back returned long lists to 0 or clamped to short detail height | Track outgoing entry identity; restore scroll after destination layout commit. History1000 px and Library700 px probes. |
| B4 | Previous account/deleted filter IDs silently hid valid history | Account-bound navigation/reset plus unavailable-filter normalization. Browser account/filter regressions. |
| B5 | Failed exercise catalogue left an indefinite spinner hiding local history | Explicit failure/retry with locally available performance still visible. Offline/retry browser regression. |
| B6 | Long workout label overflowed exercise detail at320 px | Existing shared wrap/min-width treatment verified against long unbroken labels after integration. Narrow browser regression. |
| B7 | Custom exercise goal selection was ignored in active picker | Pass selected tracking through Add and Replace. Caller and browser regressions. |
| B8 | Technique textarea accepted changes while an older draft saved | Freeze the pending textarea and retain retry behavior. Browser regression. |

### Enlarged text

A late browser pass reproduced measurement-form overflow at 320 px with doubled text (371 px document width in the regression). Explicit shrinkable grid tracks preserve the narrow layout; the regression now fits 320 px. Italian and English enlarged-form checks were repeated.

### Data integrity findings from integration and independent review

- Durable deletion markers prevent old cloud copies from resurrecting deleted workouts, routines, folders and measurements. Cascading folder deletion is atomic.
- Reconciliation re-reads local records after network latency inside its local transaction, preserving intervening edits.
- Atomic remote revision comparison prevents an older queued request overwriting a newer edit or deletion. Ordinary local saves do not wait indefinitely for connectivity. The remote adapter uses [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions); offline failures remain local and retry on reconciliation.
- Local writes monotonically advance each record's revision, including same-millisecond edits and future-dated restored/synced revisions. Reinstall/import preserves collision safety.
- Restore supersedes local deletion markers with the actual persisted revision. A newer cloud conflict is reported through partial-restore feedback instead of falsely reporting complete cloud restoration.
- PR calculation consistently compares prior workouts, including earlier sessions on the same day. Editing/deleting history recalculates affected facts and advances their revisions; increasing sets within the first session does not invent a historical PR.
- Hevy imports retain timed/reps-only and warmup rows, support English month names and pounds, reject impossible calendar dates, and ignore impossible end-before-start timestamps while preserving the workout.

## Complete surface coverage

Source inspection covered each module below; browser evidence is recorded separately so reading code is not counted as executing an interaction.

| Area | Screen modules and important shared controls |
|---|---|
| Main and browsing | Home, Train, Profile, History, Progress, Library, ExerciseSheet; Nav, PageHeader, TrainingOverview, WorkoutList, LineChart, ExerciseMedia |
| Preparation | RoutineDetail, RoutineEditor, RoutineImport; RoutinePrescription, NoteEditor, BottomSheet |
| Gym and history | Workout, Summary, WorkoutDetail, WorkoutEditor; RestBar, RestWatcher, ActiveWorkoutBar |
| Personal and nutrition | PersonalMetrics, ProgressBody, ProgressDiet, NutritionTotals, FoodDiary, FoodEntryEditor, FoodLogImport; FoodNutrients, FoodBarcode, BlurNumberInput |
| Access and maintenance | Login, Settings, ImportExport; RestAlertSettings, ExportRows; catalogue and per-surface state hooks |

The final browser matrix contains **396 successful captures across 99 named route/dialog states**, plus 8 explicit keyboard/focus records. Primary combinations were EN/light and IT/dark at 320 and 390 CSS pixels; Home, diary, Library and custom-exercise dialog also ran in EN/dark and IT/light at both widths. This is not a full Cartesian combination of every state, language and theme.

All route families and major dialogs were rendered, including missing records, empty/populated data, plan/backup previews, calendar selection, note editors, pending/error regressions and workout review confirmations. Four representative forms were checked with doubled computed text size. Latest captures show no document overflow or JavaScript errors; all harness selector misses were resolved and excluded until successful recapture. Representative screenshots were visually inspected; remaining images were checked programmatically, not individually judged by eye.

The detailed local evidence inventory is [final-whole-app-matrix.md](/Users/salvatoredicara/Workspace/Codex/overload-qa/final-whole-app-matrix.md), with linked screenshots and machine-readable records. Independent discovery and remediation reports are retained alongside it as deep-training-audit.md, deep-personal-audit.md and deep-browse-audit.md. Reproducible committed browser regressions live in e2e/core.spec.ts, e2e/browseRegression.spec.ts and e2e/deepSessionRegression.spec.ts.

## Final verification and release

- `pnpm test`: **419 passed in 52 files**.
- `pnpm build`: passed TypeScript, 651 aligned IT/EN translation keys, and production/PWA build.
- `pnpm exec playwright test`: **132 passed**, fresh server and frozen sources, 3.3 minutes.
- Impeccable detector over screens/components/theme: no findings. This static detector is supplementary, not evidence of usability on its own.
- Independent review findings were corrected and rechecked, including remote restore conflict reporting and historical Previous tracking compatibility.
- Release destination: existing Firebase Hosting project overload-sdc, https://overload-sdc.web.app. Source revision `fa9a99f` was pushed to codex/hevy-ux-review and main, then deployed successfully on 8 September 2026. Read-only production smoke passed: index, service worker, manifest and food catalogue hashes match the tested build; login screen renders; offline reload and all 7,793 cached food records remain available; no runtime errors or document overflow in that smoke. No personal records were modified by the verification.

## Practical limits

This is an expert cognitive walkthrough, code review and synthetic browser/fault-injection exercise, not a first-time-user study or a guarantee of zero undiscovered defects. Every screen was inventoried; not every possible combination of data, OS state and external service was executed.

The user's physical Android PWA, actual background/closed-app alarm delivery, camera scanning and Google account interaction require real-device verification. The user explicitly reserved the alarm test. Production smoke is read-only; synthetic accounts are used for data mutation tests. No live two-device Firestore fault test is implied by mocked adapter tests. Large-dataset browser checks use synthetic records; they do not establish unlimited-capacity or formal accessibility certification.
