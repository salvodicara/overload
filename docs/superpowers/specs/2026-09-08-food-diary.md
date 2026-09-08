# Guided food diary

User authorized a simple food-based diary and imports, explicitly copying established leader patterns. Alarm changes are deferred while the user tests the installed Android PWA. Exercise navigation stays unchanged; Profile → Exercises is verified.

## Product design

Keep Nutrition under Profile. Diary opens on today with day navigation/date, compact calorie/macronutrient totals, four familiar meal groups (breakfast/lunch/dinner/snack), and Add food per group. Add opens search/recent/saved choices; select a food, enter grams or millilitres according to the database basis, review calculated amounts and save. Entries can be edited/deleted; meals can be saved and reused. Nutrient detail is secondary and reports known subtotals/incomplete coverage, never missing-as-zero. Existing manual daily totals remain preserved as an explicit manual entry when a day first receives food entries.

References: Cronometer food search → quantity → diary group (https://support.cronometer.com/hc/en-us/articles/360018193011-Add-a-Food); MacroFactor saved meals/recipes (https://help.macrofactorapp.com/en/articles/239-save-a-meal-for-later-use). Preserve Overload tokens, typography and touch targets, IT/EN, both themes, narrow mobile.

## Data and import

Use existing USDA public-domain data for generic foods and Open Food Facts API for barcode lookup. Preserve provider/source IDs and distinguish g/ml without guessing density. No paid API or account keys required. Logged foods contain immutable snapshots, so source changes cannot rewrite history. A documented format and importable example plus JSON/CSV file/paste supports externally prepared logs; parse → resolve exact IDs → readable preview → atomic additive confirmation. Unknown food IDs and invalid quantities/dates are rejected; retries do not duplicate entries. Backups preserve diary entries, saved meals and legacy nutrition.

## Implementation boundary

NutritionDay embeds entries and derived nutrient summary to retain existing account-scoped sync. Food and nutrient domain owns validation, scaling, totals and legacy transition. Settings may retain saved meal snapshots using the existing settings sync. Pure domain tests cover units, partial nutrients, negatives, legacy preservation; store tests cover account ownership and concurrent edits. Browser tests cover add/edit/reopen, reuse, import, invalid input, empty/offline states. Source freezes before final verification. Branded text search was investigated but is not exposed because the provider rejects browser CORS; no proxy deployment is introduced.
