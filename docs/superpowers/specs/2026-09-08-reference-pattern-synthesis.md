# Reference pattern synthesis (supersedes five-tab design)

User approved an evidence-based synthesis of Hevy, Strong and StrengthLog, and authorized autonomous implementation. Retain Overload typography, colors, accessibility and bug fixes. No new dependencies or speculative product features.

Primary navigation: Home, Train, Profile. Home uses StrengthLog's next-program-workout, quick summary linking to full statistics, and latest-workouts preview linking to the single log. Train retains Hevy/Strong routine folders, clear create/edit/start, live set logging. Profile follows Hevy's personal training hub: identity, summary, Statistics, Exercises, Measurements, Calendar/history, recent completed workouts. A gear opens a separate Settings screen holding preferences/data/account. Nutrition is a separate personal detail reachable from Profile, based on Strong's measurements/macros model.

Progress becomes a nested Statistics page containing training analytics only. Body and nutrition are separate nested pages, reusing existing implementations. Exercise-specific full history/charts remain in existing ExerciseSheet. Library is nested in Profile and remains available in routine/live pickers. All nested destinations have back navigation. Bottom navigation highlights Profile for personal details and Train for exercise pickers. No independent duplicate calendar or analytical state. No social feed. Home's recent-workout preview uses the existing WorkoutList and the same detail route as Profile/history.

References verified on 2026-09-08:
- https://www.hevyapp.com/hevy-tutorial/
- https://www.hevyapp.com/features/gym-progress/
- https://www.hevyapp.com/features/gym-routines/
- https://help.strongapp.io/article/239-profile-widgets
- https://help.strongapp.io/article/105-about-templates
- https://help.strongapp.io/article/237-about-exercise-detail
- https://help.strengthlog.com/help-article/the-home-screen/

Verification: focused regressions first; update existing browser paths to actual nested destinations rather than removing coverage. Unit/build/full E2E, narrow Italian and English dark/light screenshots, nested back-state checks. Keep isolated codex/hevy-ux-review branch; no production deployment.
