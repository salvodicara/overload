# Food diary implementation plan

**Goal:** Food-based nutrition tracking with guided entry and safe imports.
**Architecture:** Existing NutritionDay records embed immutable food snapshots; local-first atomic edits and current account isolation. Providers are adapters; screen uses shared domain types.
**Spec:** ../specs/2026-09-08-food-diary.md

- [x] Domain/store: nutrient keys/units, foods, diary entries, legacy migration, atomic add/update/remove/import, saved meals, backup validation. Targeted tests.
- [x] Catalog: attributable USDA generic foods, Italian discovery aliases, OFF search/barcode adapter, validation, timeouts and offline behavior. Provider tests.
- [x] Import: strict JSON/CSV format, downloadable AI kit using real catalog IDs, exact resolution and stable import entry IDs. Parser tests.
- [x] UI: daily meals and totals, guided search/quantity, edit/remove, saved meal reuse, import preview and micronutrient detail. Preserve manual-total access and existing targets.
- [x] Integrate and independently review; add E2E scenarios, batched IT/EN 320/390 theme QA, freeze source, full tests/build, document and commit.

Ruling: user approval in the current turn and persistent autonomy authorizes implementation; no redundant design approval. Reuse available agents because the session previously reached the fresh-agent limit. Root owns UI/i18n/E2E; agents own named independent modules and communicate type contracts.
