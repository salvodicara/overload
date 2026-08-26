# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web, delivered as an installable PWA.

## Stack

Vite, React, TypeScript, Zustand, Dexie, i18next, Firebase Auth/Firestore/Hosting, and vite-plugin-pwa.

## Users

Overload is for independent strength trainees, from beginners adapting a starter template to experienced lifters running their own program. The primary interaction happens on a phone between sets, often one-handed, under time pressure, with imperfect connectivity and limited attention.

## Product Purpose

Overload makes strength training easy to execute and review: prepare a reusable routine, see prior performance, log sets quickly, preserve durable technique cues, capture session observations, and retain an exportable history. Success means a complete workout can be run without paper, data loss, ads, social distractions, coaching, or a paid tier.

## Positioning

The useful workout-logging discipline of Hevy and StrengthLog, rebuilt as a private, local-first, configurable tool with understandable progression guidance and no feed, public profile, challenge, community, subscription, or paywall.

## Operating Context

The app is installed as a PWA and used during live training, between sets, during technique review, and later when inspecting history. The active workout and rest timer survive refreshes. A warmed install can reuse its cached app shell and exercise catalog offline, while a first-ever offline visit cannot load resources it has never cached. Local changes sync in the background when connectivity returns. Italian is the primary language and English is fully supported.

## Shipped Capabilities and Constraints

- The active workout is the highest-priority surface. Set logging, previous values, progression suggestions, rest timing, and recovery after interruption remain immediate.
- Optional Full Body and Push / Pull / Legs packs provide neutral starting points. Users own their programs, routines, preparation, warm-up sets, set targets, rest periods, starting loads, increments, tracking modes, and exercise order.
- Weighted working-set guidance uses the most recent completed working sets. It repeats the prior load until all prescribed sets reach the top of the rep range, then applies the configured increment.
- Exercises support weight and reps, reps only, or duration tracking. The interface accepts and displays kg or lb; canonical stored weights remain kilograms.
- Notes have exactly two current scopes. Technique belongs to the exact exercise occurrence inside a routine; the same exercise can therefore carry different cues in different routines or positions. This session is saved with the completed workout and appears in the exercise journal. Imported historical entries remain readable in that journal.
- Home prioritizes one useful next action, current-week training, recent activity, and meaningful progress without becoming a social feed.
- Training progress, body measurements, and kcal/protein records remain compact operational tools rather than coaching surfaces.
- The version-2 JSON backup contains workouts, routines, programs, exercise notes, measurements, nutrition days, custom exercises, and settings. CSV export is a flat report of completed sets with date, routine, exercise, weight in kilograms, and reps.
- IndexedDB is authoritative locally. Firestore mirrors records within the authenticated user's account with last-write-wins timestamps.
- The exercise catalog, Italian instructions, and public-domain demonstration media are shipped with the repository. Catalog data becomes available offline after it has been cached online.
- No competitor assets, proprietary copy, or exact visual trade dress are reused. Competitors are interaction references only.
- Personal workout data never belongs in the repository.

## Brand Commitments

The product name is Overload. Preserve its direct voice, dark-first gym suitability, graphite neutral system, volt accent, Archivo display/body character, JetBrains Mono for compact numeric data, five-tab navigation, and equal-quality light mode. The interface should recede during training and become explanatory during review.

## Evidence Boundaries

The repository contains neutral starter packs, a local exercise catalog with public-domain media, Italian exercise instructions, import compatibility for Hevy workout CSV and version-1 JSON backups, unit and end-to-end tests, and Firebase configuration. No testimonials, commercial claims, public user metrics, or health outcomes should be invented.

## Product Principles

1. Logging a set must be faster than thinking about the interface.
2. Every piece of data must reveal its scope and survive the context in which it was created.
3. The interface recedes during training and becomes explanatory during review.
4. Mobile ergonomics are the default; larger screens enhance rather than redefine the product.
5. Users own their data and training configuration.
6. Accessibility, interruption recovery, and truthful export boundaries are product behavior, not polish.

## Accessibility and Inclusion

Meet WCAG 2.2 AA for the web UI. Preserve visible focus and logical keyboard order, support reduced motion and system theme, keep controls usable at mobile touch sizes, synchronize the document language with the selected locale, and never rely on color alone for state.
