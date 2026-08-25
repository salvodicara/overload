# Overload product brief

> Historical discovery brief. This document records the product decisions that led to the current generalized app. `PRODUCT.md` is the current source of truth.

## Original product question

Could an existing private workout logger become useful to independent strength trainees without adding social, coaching, subscription, or engagement machinery?

## Decision

Yes. Preserve the fast local-first training loop, then replace hidden personal assumptions with editable routines, neutral starter packs, history-derived guidance, and explicit data scopes.

## Audience identified

Independent strength trainees who want to run their own workouts from a phone. They may adopt a neutral template or create a routine from scratch, but every prescription remains editable.

## Problem worth solving

During a workout, people need to see what they did last time, record the current set, remember stable technique cues, capture what happened today, and continue after an interruption. Many products surround that loop with social or commercial surfaces. Overload focuses on the private training loop itself.

## Experience principles carried into the product

- Home answers what can be done next, how the current week is going, and what happened recently.
- Programs and routines can be created or adapted without knowledge of the internal data model.
- Preparation, warm-up sets, exercise order, targets, rest, increments, and Technique cues remain editable.
- The active workout keeps its finish action and previous values in reach while preserving a scannable exercise list.
- Technique is the durable note for an exercise. This session is the observation saved with one completed workout. There is no third current note concept.
- The exercise journal combines session observations with compatible imported entries and links each session observation to its workout.
- A complete JSON backup includes every current user-data collection. CSV remains a narrower completed-set report.
- A warmed install preserves the training loop through a connection loss; uncached resources still require an initial online load.

## Scope delivered

1. Generalized templates, progression language, routine editing, and warm-up ownership.
2. Reworked Home as a private operational dashboard.
3. Rebuilt the active workout around fast set entry, previous values, sticky completion, and two clear note scopes.
4. Applied one mobile-first spacing, type, control, action, and status grammar across the app.
5. Preserved compatible workouts, routine notes, imported entries, and existing routines.
6. Made backup, accessibility, loading, offline, and error boundaries explicit and testable.

## Boundaries retained

- No public profiles, feeds, followers, comments, likes, leaderboards, challenges, or community groups.
- No AI coaching, generated programs, medical advice, readiness scoring, or recovery claims.
- No subscription tiers, ads, affiliate recommendations, marketplace features, or engagement notifications.
- No copied competitor branding, assets, proprietary copy, or exact visual trade dress.

## Success criteria retained

- A new user can create or adopt a routine and edit its preparation and warm-up sets without hidden defaults.
- A returning user can start the next workout from Home and log a set one-handed without searching for another control block.
- Two sessions on the same day retain distinct exercise observations.
- Compatible note and routine data remains readable after migration.
- Primary controls meet touch-size, focus, contrast, and keyboard expectations.
- Production checks cover every route, warmed-cache offline recovery, import/export, and both supported languages.

## Risks addressed

- Migration ambiguity: compatible legacy fields remain readable until their content has a clear current destination.
- Dashboard bloat: Home presents one next action, a compact week view, and recent history instead of duplicating analytics.
- Workout density: alignment and disclosure carry hierarchy without shrinking text or multiplying chips.
- Feature creep: the product prefers direct improvements to existing flows over new subsystems or dependencies.
