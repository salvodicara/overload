# Coherent fitness UX

> Navigation organization superseded by [reference synthesis](./2026-09-08-reference-pattern-synthesis.md).


Preserve Overload's graphite/volt palette, Archivo typography, light/dark themes, private local-first scope, and existing workout/routine editing. Use Hevy's separation of reusable routines, personal history/calendar and exercise statistics. No social feed is introduced.

Home: next/resumable workout, current-week consistency, compact weekly totals, direct links to history and progress. No full historical calendar, multi-period analytics or duplicated workout feed.
History: one canonical list/calendar destination, accessible from Profile and Home shortcuts. Default list, optional monthly calendar with visible previous/next buttons, swipe with vertical-scroll protection, current-day and trained/selected states. Calendar selection filters the list to the month or selected day; multiple same-day sessions remain accessible. Search and filters agree with date markers. Back restores month/filter context. Sort chronologically before pagination, by workout date before timestamps. Preserve all saved sessions.
Progress: owns aggregate week/month/year charts and per-exercise statistics; body and nutrition remain secondary segments. No calendar duplication. Durations use active durationSec, with timestamp fallback.
Profile: personal summary, history entry, then preferences and data controls. Navigation highlights the owning destination consistently for history and its editors.
Train/library/workout/editors: audit existing flows, preserve established compact set-table pattern and fix demonstrated defects. No new custom interactions or dependencies.

Validation: existing unit baseline; focused regression tests for month scope, pagination ordering, duration and navigation; complete unit/build/e2e checks; rendered Italian/English phone screens in both themes, desktop check, empty/populated states and touch/keyboard controls. Use synthetic data only. No production deployment in this task.

References: https://www.hevyapp.com/features/gym-consistency/ ; https://www.hevyapp.com/features/gym-routines/ ; https://www.hevyapp.com/features/gym-progress/
