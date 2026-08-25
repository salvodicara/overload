# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite, React, TypeScript, Zustand, Dexie, i18next, Firebase Auth/Firestore/Hosting, and an installable offline-first PWA.

## Users

The primary audience is independent strength trainees, from beginners following a simple template to experienced lifters running their own program. Salvatore is the first demanding real-world user, not a special case encoded into the product. The interaction happens mostly on a phone between sets, often one-handed, under time pressure, with imperfect connectivity and limited attention.

## Product Purpose

Overload makes progressive strength training easy to execute and review: start a reusable routine, see useful prior performance, log sets quickly, preserve technique cues and session observations, and own the resulting history. Success means a complete workout can be run without paper, data loss, ads, social distractions, or a paid tier.

## Positioning

The useful workout-logging discipline of Hevy and StrengthLog, rebuilt as a private, local-first and fully configurable tool with progression guidance and no feed, ads, paywall, or community layer.

## Operating Context

The app is installed as a PWA and used during live training, between sets, during technique review, and later when inspecting workout history. It must remain useful offline, keep an active workout and rest timer across refreshes, and sync in the background when connectivity returns. Italian is the primary language; English remains fully supported.

## Capabilities and Constraints

- The active workout is the most frequently used and highest-priority surface.
- Set logging, previous values, progression suggestions, rest timing, and workout recovery must remain immediate.
- Notes have two explicit scopes: a persistent personal technique note for an exercise, editable whenever the exercise is visible; and a note for that exercise in the current session, saved with the completed workout and reviewable in the journal.
- Routines, programs, warm-ups, set targets, rest periods, starting loads, increments, and exercise order are user-owned configuration. No personal training plan or phase is assumed globally.
- The Home screen is a contextual dashboard: it prioritizes the next useful action, current-week training, recent activity, and meaningful progress without becoming a social feed.
- Starter templates are optional, neutral examples. Personal routines may remain readable for existing users but are never presented as defaults for everyone.
- Progression guidance is history-based and understandable. It does not silently apply a personalized comeback or deload calendar to every user.
- Existing routine notes and imported Hevy exercise notes must remain readable through backward-compatible migration or fallback behavior.
- IndexedDB is authoritative locally; Firestore mirrors per-user records with last-write-wins timestamps.
- No Hevy assets, copy, or proprietary media may be reused. Hevy is an interaction benchmark, not a source to clone.
- Personal workout data never belongs in the repository.

## Brand Commitments

The product name is Overload. Preserve its direct, no-nonsense voice, dark-first gym suitability, graphite neutral system, volt accent, Archivo display/body character, and JetBrains Mono for compact numeric data. Hevy is the primary usability reference; StrengthLog is a secondary reference. Social and motivational-feed conventions are explicitly excluded.

## Evidence on Hand

The repository contains a legacy seeded eight-week comeback program, a local exercise catalog with public-domain media, Italian exercise instructions, imported Hevy-history support, progression logic, unit and end-to-end tests, and a deployed Firebase configuration. The comeback program is existing user data and migration evidence, not the generic product model. No testimonials, commercial claims, or public user metrics should be invented.

## Product Principles

1. Logging a set must be faster than thinking about the interface.
2. Every piece of data must reveal its scope and survive the context in which it was created.
3. The interface recedes during training and becomes explanatory during review.
4. Mobile ergonomics are the default; larger screens enhance rather than redefine the product.
5. Own the data, avoid distractions, and make recovery from interruption routine.

## Accessibility & Inclusion

Meet WCAG 2.2 AA for the web UI, preserve visible focus and logical keyboard order, respect reduced motion and system theme, keep controls usable at mobile touch sizes, and avoid relying on color alone for state.
