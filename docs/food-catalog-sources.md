# Food catalog sources and reproduction

## USDA local catalog

`public/data/foods-usda.json` contains all 7,793 food records with supported nutrients from the official USDA FoodData Central SR Legacy April 2018 CSV archive. All amounts are per **100 grams**, including liquids: no volume conversion or density assumption is applied. The app preserves FDC IDs as `usda:<fdc_id>` and `sourceId`.

- Official download index: https://fdc.nal.usda.gov/download-datasets/
- Exact archive: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
- Archive SHA256: `b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0`
- Retrieved 2026-09-08. The release is historical, not a claim of newly measured data.
- USDA data is public domain: https://fdc.nal.usda.gov/faq/
- Generated asset: 4,051,141 bytes. The raw archive is a build input, not shipped.

Reproduce with `python3 scripts/ingest-food-catalog.py /path/to/FoodData_Central_sr_legacy_food_csv_2018-04.zip`. Keep raw downloads physically under `~/Workspace/Codex`; extraction is streamed from the ZIP and does not write large intermediate CSV files.

The script joins `food.csv` and `food_nutrient.csv` by FDC ID. Its nutrient-ID mapping is explicit and checked against `nutrient.csv`. Supported masses retain USDA units (g, mg, or micrograms), and energy uses nutrient 1008 (kcal). Vitamin A uses RAE, folate uses total folate, vitamin E uses alpha-tocopherol, and vitamin K uses phylloquinone. Salt is **not calculated from sodium**; absent fields remain absent. USDA carbohydrate-by-difference and product-label carbohydrate conventions can differ: source facts are retained without invented harmonization.

The English USDA descriptions are preserved. Twenty-one common foods have hand-written Italian display translations preserving raw/cooked, fortified, and other identity distinctions. Broader Italian ingredient/preparation aliases aid search; the remaining descriptions are English. This is not a fully translated 7,793-food database. No nutrient amount is translated, estimated, or AI-generated.

`loadFoodCatalog()` loads and validates the local JSON once, and retries after failures. `searchFoodCatalog(query, locale)` returns up to 60 matches, including Italian aliases and exact source IDs. The PWA must cache `/data/foods-usda.json` after an online load; a first-ever offline visit cannot retrieve an uncached file.

## Open Food Facts barcode lookup

`lookupBarcode(code, signal?)` uses `https://world.openfoodfacts.org/api/v3.6/product/<barcode>` with selected fields and an identifying `X-User-Agent`. No API key or paid account is used. A 12-second timeout and caller cancellation stop a request. Successful results are cached for the current app lifetime; persisted diary entries retain their food snapshot.

The adapter reads the modern `nutrition.aggregated_set` only. It accepts explicit `per: 100g` or `100ml` with `preparation: as_sold`, and keeps that basis. It never infers a basis from packaging weight, beverage categories, or legacy `_100g` fields (which can mean g or ml). Records without a supported explicit basis are unavailable rather than guessed.

Nutrient units are converted only between g/mg/micrograms. IU values, invalid/negative/nonfinite values, inequality bounds and nutrients marked `source: estimate` are omitted. Zero remains zero; missing values remain absent. Calories use explicit kcal. Nutrient definitions remain provider-specific. User-entered source facts can still contain errors; the diary should show source attribution and incomplete coverage.

Live checks on 2026-09-08: a real Chromium page at localhost successfully called the barcode API with CORS and parsed barcode 3017620422003. Legacy text search returned HTTP 503; official Search-a-licious returned valid server-side JSON but omitted `Access-Control-Allow-Origin`, and a real browser fetch failed. Consequently branded text search is **not exposed in the UI**, and `searchBrandedFoods()` explicitly rejects as unavailable. Do not substitute unsupported v2 `search_terms` requests or silently show unrelated results. No proxy was created or deployed.

- API guide, rate limits, attribution and license: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Product schema: https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product/
- Modern nutrition schema explanation: https://blog.openfoodfacts.org/en/news/data-in-open-food-facts
- Official text-search service: https://search.openfoodfacts.org/docs
- Data license: Open Database License (ODbL); individual contents: Database Contents License. No product images are downloaded. Keep source identification and links in UI and exports; USDA local data remains a separate shipped asset.

The documented API limits are 15 product reads/minute/IP and 10 searches/minute/IP. Barcode lookup must be an explicit action, not a request on every typed digit. Deterministic unit tests mock API responses to avoid service load; live checks are bounded connectivity checks, not a service reliability guarantee.
