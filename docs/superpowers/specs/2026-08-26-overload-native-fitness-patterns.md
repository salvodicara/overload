# Overload Native Fitness Patterns Specification

**Status:** Approved 2026-08-26

## Product rule

Overload follows established interaction patterns from Hevy and comparable strength-training apps whenever a familiar convention exists. It may adapt those patterns to Overload's visual language, but it must not invent a competing grammar for routine organization, period navigation, exercise history, or contextual actions.

## Program lifecycle

- A program owns its routines. Deleting a program deletes every routine currently contained in it instead of moving those routines into the standalone section.
- Completed workout history survives program and routine deletion.
- The confirmation names the program and states the number of routines that will be deleted.
- Local IndexedDB state and Firestore state use the same cascade semantics and retain account-owner fencing.
- Installing, deleting, and reinstalling a ready-made program must never leave orphaned or duplicate routines.

## Train interaction grammar

- The whole program header is the accordion trigger. A single down/right chevron communicates collapsed state.
- A conventional three-dot overflow button opens program actions. It is visually and semantically distinct from the accordion control.
- Only one program is expanded at a time. The suggested program is expanded initially.
- The Create sheet presents two list rows, each with its own short contextual subtitle:
  - **Routine / Scheda:** one reusable workout containing exercises, sets, and rest.
  - **Program:** an ordered group of routines.
- Remove the detached explanatory footer from the Create sheet.

## Home training overview

- Home answers "How much did I train?"; Progress answers "How am I improving?".
- A `Week / Month / Year` segmented control changes the aggregation period.
- Swiping left or right directly on the overview changes the selected period, matching fitness and calendar apps. Future periods cannot be selected.
- Previous/next icon buttons remain available as unobtrusive accessible fallbacks for keyboard and assistive technology.
- Every period shows workouts, working sets, volume, duration, and comparison with the preceding equivalent period.
- The selected metric has one compact trend chart. Week uses daily points, month uses weekly points, and year uses monthly points.
- Week retains tappable trained days. Month adds a compact calendar whose trained days open the latest workout for that day. Year remains an aggregate trend rather than a dense calendar.
- Recent workouts stay below the overview; exercise-, record-, and muscle-specific analytics stay in Progress.

## Exercise detail

- The top of the screen stays identity-first: media, localized exercise name, muscle, and equipment.
- A compact performance summary follows, showing the latest working performance and record chips without expanding a long session feed.
- Routine-specific technique never appears as global exercise content. It lives only on each `RoutineExercise` occurrence and may differ across days in the same program.
- Instructions remain compact and immediately useful.
- A clear action opens Progress with the current exercise preselected.
- The journal/history preview is collapsed by default, reports its entry count, and reveals entries progressively in batches of five.
- The full historical workout list and charts remain in Progress; Exercise detail avoids duplicating that screen.

## Language and accessibility

- Every visible and assistive string is localized in Italian and English, including menu labels, subtitles, period labels, chart alternatives, deletion counts, and empty states.
- Touch targets remain at least 44 px. Accordion and journal state use native `aria-expanded`/`aria-controls`; overflow actions have an explicit accessible name.
- Swipe is an enhancement, never the only way to navigate.
- Dialogs and bottom sheets use a visually opaque surface. Underlying content must not bleed through the panel at normal or increased screenshot brightness.

## Verification

- Develop each behavior from failing unit or browser coverage.
- Verify cascade deletion, template reinstall, single-open accordions, overflow menu semantics, localized Create rows, period aggregation, swipe boundaries, month-day navigation, Progress deep-linking, and collapsed journal batching.
- Run i18n parity, unit tests, TypeScript/build, browser QA in both languages, Impeccable inspection, Ponytail review, and final phone screenshots.
- Screenshots are the final visual source of truth. Code inspection alone cannot approve opacity, contrast, stacking, spacing, clipping, or responsive layout.
