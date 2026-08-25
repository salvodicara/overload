# Overload product brief

## Product Lens verdict

**GO.** The working core is valuable, but the current product encodes one person's comeback plan and exposes three overlapping kinds of notes. A focused redesign can turn it into a general strength logger without adding social, coaching, or subscription complexity.

## Who it is for

Independent strength trainees who want to run their own workouts from a phone. They may start from a neutral template or build a routine from scratch, but they expect every prescription to be editable.

Salvatore remains the first high-frequency user and the quality bar for mobile ergonomics. His routines, start weights, warm-ups, and progression phases are data, not product defaults.

## Problem worth solving

During a workout, people need to see what they did last time, record the current set, remember stable technique cues, capture what happened today, and continue after an interruption. Existing products often solve this with social layers, paid tiers, or excessive feature surface. Overload should solve only the private training loop and solve it unusually well.

## Ten-star experience

- Home immediately answers: what can I do next, how is this week going, and what did I do recently?
- A routine can be created or adapted without knowing the app's internal model.
- Warm-up, exercise order, targets, rest, increments, and technique cues are always editable.
- The active workout keeps the finish action and previous set values in reach while leaving the exercise list scannable.
- “Technique” means the durable note for an exercise. “This session” means the note saved with this workout. There is no third user-facing note concept.
- The exercise journal combines past session observations with legacy imported entries and links each observation to its workout.
- A complete local backup is actually complete, and a refresh or offline period never loses the active workout.

## Scope of this redesign

1. Generalize templates, progression copy, routine editing, and warm-up ownership.
2. Turn Home from a history list into a useful private dashboard.
3. Rebuild the active workout around fast set entry, previous values, sticky completion, and two clear note scopes.
4. Apply one mobile-first spacing, type, control, action, and status grammar to every screen.
5. Preserve and migrate existing workouts, routine notes, imported Hevy notes, and personal routines.
6. Fix the backup claim, accessibility gaps, initial payload, and critical empty/loading/error states.

## Explicit non-goals

- Public profiles, feeds, followers, comments, likes, leaderboards, challenges, or community groups.
- AI coaching, generated programs, medical advice, readiness scoring, or recovery claims.
- Subscription tiers, ads, affiliate recommendations, marketplace features, or engagement notifications.
- Copying competitor branding, assets, proprietary copy, or exact visual trade dress.

## Measures of success

- A new user can create or adopt a routine and edit its warm-up without hidden defaults.
- A returning user can start the next workout from Home and log a set one-handed without scrolling to another control block.
- Two sessions on the same day retain distinct exercise notes.
- Existing note and routine data remains readable after the migration.
- Every primary control meets touch-size, focus, contrast, and keyboard expectations.
- Production smoke tests complete for all routes, offline recovery, import/export, and both supported languages.

## Main risks and responses

- **Migration ambiguity:** retain legacy fields as read-only fallback until their content has a clear destination.
- **Dashboard bloat:** show one next action, a compact week view, and recent history; do not create a second analytics screen.
- **Workout density:** use alignment and disclosure, not smaller text or more chips.
- **Feature creep:** prefer changes to existing types and screens over new subsystems or dependencies.
