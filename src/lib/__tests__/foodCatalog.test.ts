import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateFood } from '../foodDiary';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function catalog() {
  vi.resetModules();
  return import('../foodCatalog');
}
const response = (product: unknown) => ({ ok: true, status: 200, json: async () => ({ product }) });
const product = (per: string, nutrients: object) => ({
  code: '3017620422003',
  product_name: 'Example',
  nutrition: { aggregated_set: { per, preparation: 'as_sold', nutrients } },
});

it('loads validated USDA data and finds common foods by Italian name or preparation', async () => {
  const foods = JSON.parse(readFileSync('public/data/foods-usda.json', 'utf8'));
  foods.forEach((food: unknown) => validateFood(food));
  expect(foods.length).toBeGreaterThan(7000);
  expect(foods.find((f: { id: string }) => f.id === 'usda:173944').nutrients).toMatchObject({
    kcal: 89,
    potassiumMg: 358,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => foods })),
  );
  const api = await catalog();
  expect((await api.loadFoodCatalog()).length).toBeGreaterThan(7000);
  expect((await api.searchFoodCatalog('riso','en'))[0].name).toMatch(/^Rice,/);
  expect(
    (await api.searchFoodCatalog('', 'en')).slice(0, 10).some((f) => f.id === 'usda:173944'),
  ).toBe(true);
  expect((await api.searchFoodCatalog('banana', 'it')).some((f) => f.id === 'usda:173944')).toBe(
    true,
  );
  expect(
    (await api.searchFoodCatalog('pollo cotto', 'it')).some((f) => /Chicken.*cooked/i.test(f.name)),
  ).toBe(true);
});

it('times out an unresponsive barcode request instead of leaving the lookup pending', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    (_url: unknown, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(options.signal?.reason));
      }),
  );
  const api = await catalog();
  const pending = api.lookupBarcode('3017620422003');
  const rejected = expect(pending).rejects.toThrow('Food lookup timed out');
  await vi.advanceTimersByTimeAsync(12_000);
  await rejected;
});

it('normalizes explicit millilitre nutrition and micronutrient units without estimating missing values', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      response(
        product('100ml', {
          'energy-kcal': { value: 40, unit: 'kcal', source: 'packaging' },
          calcium: { value: 0.12, unit: 'g', source: 'packaging' },
          'vitamin-b12': { value: 0.4, unit: 'µg', source: 'packaging' },
          phylloquinone: { value: 0.000002, unit: 'g', source: 'packaging' },
          fat: { value: 0, unit: 'g', source: 'packaging' },
          fiber: { value: 2, unit: 'g', source: 'estimate' },
        }),
      ),
    ),
  );
  const food = await (await catalog()).lookupBarcode('3017620422003');
  expect(food).toMatchObject({
    basis: 'ml',
    nutrients: { kcal: 40, calciumMg: 120, vitaminB12Mcg: 0.4, vitaminKMcg: 2, fatG: 0 },
  });
  expect(food?.nutrients.fiberG).toBeUndefined();
  expect(food?.nutrients.proteinG).toBeUndefined();
});

it.each(['serving', '', '1 cup'])('does not guess nutrition basis %s', async (per) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(product(per, { fat: { value: 5, unit: 'g' } }))),
  );
  expect(await (await catalog()).lookupBarcode('3017620422003')).toBeNull();
});

it('excludes nonfinite, negative and unconvertible nutrients', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      response(
        product('100g', {
          fat: { value: -1, unit: 'g' },
          proteins: { value: Infinity, unit: 'g' },
          'vitamin-a': { value: 20, unit: 'IU' },
          salt: { value: 0.5, unit: 'g' },
        }),
      ),
    ),
  );
  expect((await (await catalog()).lookupBarcode('3017620422003'))?.nutrients).toEqual({
    saltG: 0.5,
  });
});

it('returns missing barcode as null but preserves network failures for an honest error state', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 404 })),
  );
  expect(await (await catalog()).lookupBarcode('3017620422003')).toBeNull();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('offline');
    }),
  );
  await expect((await catalog()).lookupBarcode('3017620422003')).rejects.toThrow('offline');
});

it('passes cancellation and rejects invalid barcode without network access', async () => {
  const fetcher = vi.fn(async () => response(null));
  vi.stubGlobal('fetch', fetcher);
  const api = await catalog();
  await expect(api.lookupBarcode('../other')).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  const controller = new AbortController();
  controller.abort();
  await expect(api.lookupBarcode('3017620422003', controller.signal)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
