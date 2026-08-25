# Competitive scope for the Overload redesign

## Positioning brief

Overload is a private, local-first strength-training logger for independent lifters. It should make routines configurable, make live set logging extremely fast, preserve technique and session context, and show useful progress without ads, social feeds, community mechanics, or a paid feature ladder.

## Inclusion method

A product stays in scope when it satisfies at least three of five checks:

1. strength training is a primary job;
2. reusable routines or programs are user-configurable;
3. active set logging is a first-class mobile flow;
4. exercise history, notes, or previous values are visible during or after training;
5. at least two current official sources document the relevant behavior.

Products centered on generic wellness, class booking, social fitness, or coach-client administration are excluded. The purpose is interaction benchmarking, not feature parity or visual cloning.

## Tier 1: direct competitors

### Hevy - 5/5

Closest product model and the user's primary reference. It separates reusable routine notes from workout-specific notes, exposes previous values while logging, and lets saved programs be edited after adoption.

- [Exercise note scopes](https://help.hevyapp.com/hc/en-us/articles/34463684392983-How-do-the-exercise-notes-routine-and-workout-notes-work)
- [Previous workout values](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy)
- [Routine and program library](https://help.hevyapp.com/hc/en-us/articles/36011518408983-How-to-Access-and-Use-Hevy-s-Routine-and-Program-Library)

### Strong - 5/5

Direct benchmark for a flexible logger. Its note model distinguishes workout notes, session exercise notes, and pinned exercise reminders; its template model is explicitly separate from performed workouts.

- [Workout, exercise, and pinned notes](https://help.strongapp.io/article/134-adding-notes)
- [Workout templates](https://help.strongapp.io/article/105-about-templates)
- [Exercise detail and history](https://help.strongapp.io/article/237-about-exercise-detail)

### StrengthLog - 5/5

Direct benchmark for a logger that remains understandable despite broad capability. Its customizable Home combines next programs, quick stats, latest workouts, planned sessions, and selected graphs; templates can retrieve the previous load and be pinned to Home.

- [Home screen widgets and next workouts](https://help.strengthlog.com/help-article/the-home-screen/)
- [Saving and pinning workout templates](https://help.strengthlog.com/help-article/save-a-workout-template/)
- [Official feature overview](https://www.strengthlog.com/)

### FitNotes - 5/5

Direct benchmark for local-feeling, low-friction logging. It supports both on-the-fly workouts and routines, uses persistent exercise notes for setup/defaults, supports set-specific comments, and centers Home on the current training day.

- [Workout tracking, set comments, and exercise notes](https://www.fitnotesapp.com/workout_tracking/)
- [Routines](https://www.fitnotesapp.com/routines/)
- [Home screen](https://www.fitnotesapp.com/home_screen/)

## Tier 2: adjacent competitors

### JEFIT - 5/5

Functionally broad and community-heavy, so it is not a positioning model. It remains useful for plan editing, automatic recall of previous weights, timers, notes, and post-workout insights.

- [Workout logging](https://www.jefit.com/use-case/workout-logging-app)
- [Official FAQ](https://www.jefit.com/support/faq)
- [Routine builder](https://www.jefit.com/build-routine)

### StrongLifts - 4/5

Narrower and more prescriptive than Overload, but a strong reference for one-tap set completion, automatic rest, visible next-workout context, adjustable increments, and warm-up calculation. Its program-specific automation should not become Overload's universal model.

- [App, live logging, warm-up, and progression](https://stronglifts.com/app/)
- [Workout history and notes](https://support.stronglifts.com/article/72-history)
- [Next-workout and consistency widgets](https://support.stronglifts.com/article/186-widget)

## Tier 3: aspirational interaction reference

### Fitbod - 4/5

Its generated-workout positioning is outside Overload's scope. Its exercise detail is still a useful reference for keeping instructions, past performance, rest, and session-linked notes reachable from the live workout without overloading the set row.

- [Exercise notes and their session history](https://help.fitbod.me/hc/en-us/sections/1500000505721-Workout-Schedule-Logging)
- [Exercise detail contents](https://help.fitbod.me/hc/en-us/sections/360001927994-Getting-Started)
- [Saved workouts](https://fitbod.me/blog/saved-workouts/)

## Exclusions

- Nike Training Club, Apple Fitness+, and Freeletics: primarily guided content or coaching rather than a configurable lifting log.
- Strava: activity network and social graph are central to the product model.
- Trainerize and TrueCoach: coach-client administration is a different buyer and workflow.
- Generic habit trackers and calorie apps: insufficient active set-logging overlap.

## Benchmark lenses

The implementation benchmark will compare only these jobs:

- Home as a next-action and recent-progress surface;
- routine/program creation, adoption, copying, and complete editability;
- live set rows, previous values, completion, rest, and finish placement;
- durable technique cues versus session-linked observations;
- exercise detail, history, progress, and data ownership;
- patterns to omit because they add community, coaching, monetization, or needless configuration.
