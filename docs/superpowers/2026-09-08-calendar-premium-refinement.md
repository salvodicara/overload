# Calendar and whole-app visual refinement

## Scope and interaction contract

Preserve Overload's Archivo/graphite/volt identity and Home, Train, Profile navigation. Review every screen role for hierarchy and consistency rather than introduce a new visual architecture. User authorized implementation and release.

Reference: [Hevy's official calendar guide](https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features) describes Profile calendar, highlighted completed dates and opening a workout from a date. [StrengthLog's calendar guide](https://help.strengthlog.com/help-article/calendar-events/) similarly gives dates contextual content. These support familiar date-to-detail navigation; this change does not claim pixel-identical competitor layouts.

- Home: horizontal native scrolling between weeks, accessible arrow alternatives, date interval, current-week return and selected-week handoff to Statistics.
- History: horizontal native scrolling between months, dates open the single workout directly or a dismissible day agenda. The monthly list remains stable. Remove the day-filter toggle and Show whole month reset.
- Future periods and dates are unavailable because this surface records completed training, not planned sessions.
- Native browser scrolling owns movement and vertical pan. Adjacent virtual pages are inert; commit the new period only after release and scroll settling.

## Whole-app visual decisions

Review inventory: 24 screen source files, 25 roles including food add/edit. Home, History, Train, Profile, Settings, Login, RoutineDetail, RoutineEditor, Workout, WorkoutEditor, WorkoutDetail, Summary, Library, ExerciseSheet, Progress, PersonalMetrics, ProgressBody, FoodDiary, FoodEntryEditor, FoodLogImport, NutritionTotals, ProgressDiet, RoutineImport and ImportExport. Dialog samples include save meal, exercise picker, workout deletion and duration editing.

1. Common compact back/title/action headers for inner screens; retain branded top-level titles and completion moment. Long names wrap.
2. Ordinary form labels, names and choices use the reading typeface; numeric inputs retain tabular/mono figures. Editor labels follow shared hierarchy.
3. Nutrition puts Add food next to each meal, Save meal below recorded entries and import/manual totals in a quieter utility row.
4. Food search modes use the existing inset segmented treatment.
5. Preserve purposeful differences: dense workout set tables, horizontally scrollable metric filters, overview charts versus detailed chart cards. Do not add decorative charts to suggest sophistication.
6. Keep exercise instructions immediately available: the user explicitly consults technique frequently. Preserve the existing journal disclosure and library search/filter structure rather than hide primary instructional content for a shorter screenshot.

Review artifacts and responsive screenshots are under `~/Workspace/Codex/overload-qa/premium-visual-review.md` and `premium-final/`. Those are local evidence, not application content.

## Verification

Independent review found a missing touch dismissal in the newly introduced day agenda. Added explicit Done and scrim dismissal, with close/reopen regression. Reviewer independently verified native drag commits after release, recentering, and selected-week handoff to Statistics.

The previous device-specific repeated-tap anomaly was not reproduced in Chromium; the ambiguous filter/selection interaction was removed. Automated browser coverage is not a physical Android PWA device test.

Release verification results are recorded below after completion.

- Unit: 419/419 tests in52 files passed on final source.
- Build: passed,654 matching locale keys.
- Browser regression: full134-test run had132 passes and two obsolete test expectations. Updated the Home heading selector and made the empty-session test actually finish (including its unchecked-set confirmation), rather than minimize. History/Home/calendar/completion rerun:16 passes; final corrected empty-session test:1 pass. All134 scenarios therefore have passing evidence across these runs; no claim of a single final134/134 run.
- Empty unfiltered History now says No workouts yet rather than No workouts match these filters.
- Visual confirmation:124 captures across31 states and four locale/theme/width combinations, plus8 settled viewport pager captures. No document overflow, JavaScript errors, unresolved translation keys or harness failures. Changed surfaces visually inspected; not every capture received individual visual judgment.
- Full-page screenshots with animation disabling produced incorrect native pager paint; normal settled viewport captures confirmed correct calendar geometry and display. Use the latter as evidence.
- Remaining nonblocking composition limit: a deliberately long routine title at IT320 spans five lines but remains readable. Physical Android PWA interaction and background alarms remain device checks.
