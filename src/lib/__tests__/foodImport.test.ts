import { describe, expect, it } from 'vitest';
import { buildFoodImportExample, parseFoodImport } from '../foodImport';

const food = {
  id: 'usda:rice',
  name: 'Rice',
  basis: 'g' as const,
  nutrients: { kcal: 130, proteinG: 2.7 },
  source: 'usda' as const,
  sourceId: 'rice',
};
const row = (patch = {}) => ({
  date: '2026-09-08',
  meal: 'lunch',
  foodId: food.id,
  quantity: 80,
  ...patch,
});
const json = (entries: unknown[]) =>
  JSON.stringify({ format: 'overload-food-log', version: 1, entries });

describe('food log import', () => {
  it('resolves exact catalog snapshots and keeps missing nutrients absent', async () => {
    const result = await parseFoodImport(json([row()]), [food]);
    expect(result.count).toBe(1);
    expect(result.days[0].entries[0]).toMatchObject({ food, quantity: 80, meal: 'lunch' });
    expect(result.days[0].entries[0].food).not.toBe(food);
    expect(result.days[0].entries[0].food.nutrients.fatG).toBeUndefined();
  });
  it('accepts explicitly custom snapshots without claiming a provider', async () => {
    const entry = {
      date: '2026-09-08',
      meal: 'snack',
      quantity: 150,
      food: { name: 'My drink', basis: 'ml', nutrients: { kcal: 30 } },
    };
    const result = await parseFoodImport(json([entry]));
    expect(result.days[0].entries[0].food).toMatchObject({
      name: 'My drink',
      basis: 'ml',
      source: 'import',
    });
    expect(result.days[0].entries[0].food.sourceId).toBeUndefined();
  });
  it('has stable IDs on retry and reordering, while identical rows remain separate', async () => {
    const a = await parseFoodImport(json([row(), row(), row({ date: '2026-09-07' })]), [food]);
    const b = await parseFoodImport(json([row({ date: '2026-09-07' }), row(), row()]), [food]);
    const ids = (result: typeof a) =>
      result.days.flatMap((day) => day.entries.map((entry) => entry.id)).sort();
    expect(new Set(ids(a)).size).toBe(3);
    expect(ids(a)).toEqual(ids(b));
  });
  it('supports strict CSV quoting, BOM, CRLF and trailing newline', async () => {
    const quoted = { ...food, id: 'usda:a,"b\nc' };
    const result = await parseFoodImport(
      '\uFEFFdate,meal,foodId,quantity\r\n2026-09-08,lunch,"usda:a,""b\nc",80\r\n',
      [quoted],
    );
    expect(result.days[0].entries[0].food.id).toBe(quoted.id);
  });
  it.each([
    row({ date: '2026-02-30' }),
    row({ quantity: 0 }),
    row({ quantity: -2 }),
    row({ quantity: 100001 }),
    row({ quantity: '80' }),
    row({ meal: 'brunch' }),
    row({ extra: true }),
    {
      date: '2026-09-08',
      meal: 'lunch',
      quantity: 1,
      food: { name: 'X', basis: 'oz', nutrients: { kcal: 2 } },
    },
    {
      date: '2026-09-08',
      meal: 'lunch',
      quantity: 1,
      food: { name: 'X', basis: 'g', nutrients: { kcal: -1 } },
    },
    {
      date: '2026-09-08',
      meal: 'lunch',
      quantity: 1,
      food: { name: 'X', basis: 'g', nutrients: { invented: 1 } },
    },
    {
      date: '2026-09-08',
      meal: 'lunch',
      quantity: 1,
      food: { name: 'X', basis: 'g', nutrients: {}, source: 'usda' },
    },
  ])('rejects invalid entry %#', async (entry) => {
    await expect(parseFoodImport(json([entry]), [food])).rejects.toThrow();
  });
  it('reports unknown catalog IDs explicitly and rejects whole file', async () => {
    await expect(
      parseFoodImport(json([row(), row({ foodId: 'missing' })]), [food]),
    ).rejects.toMatchObject({ code: 'unknown_food', foodId: 'missing' });
  });
  it.each([
    '"date,meal",foodId,quantity\n2026-09-08,lunch,usda:rice,80',
    'date,meal,foodId,quantity\n2026-09-08,lunch,usda:rice,',
    'date,meal,foodId,quantity\n2026-09-08,lunch,"usda:rice,80',
    'date,meal,foodId,quantity\n2026-09-08,lunch,"usda:rice"x,80',
    'date,meal,foodId,quantity\n2026-09-08,lunch,usda:rice,0x10',
    'date,meal,quantity,foodId\n2026-09-08,lunch,80,usda:rice',
  ])('rejects malformed CSV %#', async (value) => {
    await expect(parseFoodImport(value, [food])).rejects.toThrow();
  });
  it('keeps custom food identity independent of nutrient field order', async () => {
    const custom = (nutrients: Record<string, number>) => ({
      date: '2026-09-08',
      meal: 'snack',
      quantity: 100,
      food: { name: 'Food', basis: 'g', nutrients },
    });
    const a = await parseFoodImport(json([custom({ kcal: 20, proteinG: 1 })]));
    const b = await parseFoodImport(json([custom({ proteinG: 1, kcal: 20 })]));
    expect(a.days[0].entries[0].id).toBe(b.days[0].entries[0].id);
  });
  it('provides directly importable examples with and without catalog', async () => {
    expect((await parseFoodImport(buildFoodImportExample())).count).toBe(1);
    expect((await parseFoodImport(buildFoodImportExample([food]), [food])).count).toBe(1);
  });
  it('rejects overfull days, empty imports, ambiguous references and nonfinite amounts', async () => {
    await expect(parseFoodImport(json([]), [food])).rejects.toThrow();
    await expect(
      parseFoodImport(json(Array.from({ length: 501 }, () => row())), [food]),
    ).rejects.toThrow();
    await expect(
      parseFoodImport(json([row({ food: { name: 'X', basis: 'g', nutrients: {} } })]), [food]),
    ).rejects.toThrow();
    await expect(
      parseFoodImport(json([row()]).replace('"quantity":80', '"quantity":1e999'), [food]),
    ).rejects.toThrow();
  });
  it('rejects imports exceeding the atomic store day limit before preview', async () => {
    const entries = Array.from({ length: 367 }, (_, index) =>
      row({ date: new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10) }),
    );
    await expect(parseFoodImport(json(entries), [food])).rejects.toThrow();
  });
  it('keeps retry IDs stable after catalog metadata changes and accepts micronutrient units', async () => {
    const first = await parseFoodImport(json([row()]), [food]);
    const second = await parseFoodImport(json([row()]), [
      { ...food, name: 'Updated Rice', nutrients: { vitaminB12Mcg: 1, ironMg: 2 } },
    ]);
    expect(first.days[0].entries[0].id).toBe(second.days[0].entries[0].id);
    expect(first.days[0].entries[0].food.name).toBe('Rice');
    expect(second.days[0].entries[0].food.nutrients).toEqual({ vitaminB12Mcg: 1, ironMg: 2 });
  });
});
