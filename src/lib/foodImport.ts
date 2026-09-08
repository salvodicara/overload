import { NUTRIENT_META, validateFoodEntries, type Food, type FoodEntry } from './foodDiary';

export class FoodImportError extends Error {
  constructor(
    public code: 'invalid_import' | 'unknown_food',
    public path: string,
    message: string,
    public foodId?: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'FoodImportError';
  }
}

function invalid(path: string, message: string): never {
  throw new FoodImportError('invalid_import', path, message);
}
function object(value: unknown, path: string, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid(path, 'Expected an object.');
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result))
    if (!allowed.includes(key)) invalid(`${path}.${key}`, 'Unknown field.');
  return result;
}
function text(value: unknown, path: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    invalid(path, 'Expected nonempty text.');
  return value.trim();
}

/** RFC-style quoted fields: commas, escaped quotes and newlines are data inside quotes. */
function csvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (source[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closedQuote = true;
      }
      continue;
    }
    if (char === ',' || char === '\n' || char === '\r') {
      row.push(field);
      field = '';
      closedQuote = false;
      if (char !== ',') {
        rows.push(row);
        row = [];
        if (char === '\r' && source[i + 1] === '\n') i++;
      }
      continue;
    }
    if (closedQuote) invalid('csv', 'Unexpected character after a closing quote.');
    if (char === '"') {
      if (field.length) invalid('csv', 'Quote must begin a field.');
      quoted = true;
    } else field += char;
  }
  if (quoted) invalid('csv', 'Unterminated quoted field.');
  if (field.length || row.length || closedQuote) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function inputRows(source: string): unknown[] {
  if (source.length > 2_000_000) invalid('file', 'File exceeds 2 MB of text.');
  const clean = source.replace(/^\uFEFF/, '').trim();
  if (clean.startsWith('{') || clean.startsWith('[') || clean.startsWith('```')) {
    const fence = clean.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fence?.[1] ?? clean);
    } catch {
      invalid('file', 'Invalid JSON.');
    }
    const envelope = object(parsed, 'file', ['format', 'version', 'entries']);
    if (envelope.format !== 'overload-food-log' || envelope.version !== 1)
      invalid('file', 'Expected overload-food-log version 1.');
    if (!Array.isArray(envelope.entries)) invalid('entries', 'Expected an array.');
    return envelope.entries;
  }
  const rows = csvRows(clean);
  const header = rows.shift();
  if (
    header?.length !== 4 ||
    header.some((field, index) => field !== ['date', 'meal', 'foodId', 'quantity'][index])
  )
    invalid('csv.header', 'Expected date,meal,foodId,quantity in this order.');
  return rows.map((row, index) => {
    if (row.length !== 4) invalid(`csv[${index + 2}]`, 'Expected four fields.');
    const [date, meal, foodId, quantity] = row;
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(quantity))
      invalid(`csv[${index + 2}].quantity`, 'Expected a positive decimal number.');
    return { date, meal, foodId, quantity: Number(quantity) };
  });
}

async function hash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function customFood(value: unknown, path: string): Promise<Food> {
  const item = object(value, path, ['name', 'nameIt', 'brand', 'basis', 'nutrients']);
  const name = text(item.name, `${path}.name`);
  if (item.basis !== 'g' && item.basis !== 'ml') invalid(`${path}.basis`, 'Use g or ml.');
  const raw = object(item.nutrients, `${path}.nutrients`, Object.keys(NUTRIENT_META));
  const nutrients: Food['nutrients'] = {};
  for (const key of Object.keys(raw).sort()) {
    const value = raw[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9)
      invalid(
        `${path}.nutrients.${key}`,
        'Expected a finite nonnegative number. Omit unknown nutrients.',
      );
    nutrients[key as keyof typeof nutrients] = value;
  }
  const snapshot: Omit<Food, 'id'> = {
    name,
    ...(item.nameIt === undefined ? {} : { nameIt: text(item.nameIt, `${path}.nameIt`) }),
    ...(item.brand === undefined ? {} : { brand: text(item.brand, `${path}.brand`) }),
    basis: item.basis,
    nutrients,
    source: 'import' as const,
  };
  return { id: `import-food:${await hash(snapshot)}`, ...snapshot };
}

/** Parse only; callers preview, then atomically add all returned days after confirmation. */
export async function parseFoodImport(
  source: string,
  catalog: Food[] = [],
): Promise<{ days: Array<{ date: string; entries: FoodEntry[] }>; count: number }> {
  const rows = inputRows(source);
  if (!rows.length || rows.length > 5000) invalid('entries', 'Expected 1–5000 entries.');
  const foods = new Map(catalog.map((food) => [food.id, food]));
  const days = new Map<string, FoodEntry[]>();
  const occurrences = new Map<string, number>();
  for (const [index, value] of rows.entries()) {
    const path = `entries[${index}]`;
    const item = object(value, path, ['date', 'meal', 'foodId', 'food', 'quantity']);
    const date = text(item.date, `${path}.date`, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      invalid(`${path}.date`, 'Expected a real YYYY-MM-DD date.');
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(item.meal as string))
      invalid(`${path}.meal`, 'Unknown meal.');
    if (
      typeof item.quantity !== 'number' ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100000
    )
      invalid(`${path}.quantity`, 'Expected quantity greater than 0 and at most 100000.');
    if ((item.foodId === undefined) === (item.food === undefined))
      invalid(path, 'Provide exactly one of foodId or food.');
    let food: Food;
    if (item.foodId !== undefined) {
      const id = text(item.foodId, `${path}.foodId`, 500);
      const found = foods.get(id);
      if (!found)
        throw new FoodImportError('unknown_food', `${path}.foodId`, 'Unknown catalog food ID.', id);
      food = structuredClone(found);
    } else food = await customFood(item.food, `${path}.food`);
    // Catalog IDs identify the same input on retry even if provider metadata has changed.
    const identity = await hash({
      date,
      meal: item.meal,
      foodId: food.id,
      quantity: item.quantity,
    });
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    const entry = {
      id: `food-import:${identity}:${occurrence}`,
      food,
      quantity: item.quantity,
      meal: item.meal,
    };
    let validated: FoodEntry[];
    try {
      validated = validateFoodEntries([entry]);
    } catch {
      invalid(path, 'Food snapshot does not match the supported diary format.');
    }
    const entries = days.get(date) ?? [];
    entries.push(validated[0]);
    if (entries.length > 500) invalid(path, 'A day may contain at most 500 imported entries.');
    days.set(date, entries);
    if (days.size > 366) invalid('entries', 'An import may cover at most 366 days.');
  }
  return { days: [...days].map(([date, entries]) => ({ date, entries })), count: rows.length };
}

export const FOOD_IMPORT_GUIDE = `Food log import v1
JSON: {"format":"overload-food-log","version":1,"entries":[...]}
Each entry requires date (real YYYY-MM-DD), meal (breakfast/lunch/dinner/snack), quantity (>0, at most 100000), and exactly one of foodId or food.
foodId must exactly match an available catalog ID. CSV supports catalog IDs only, with this exact header: date,meal,foodId,quantity. Quote fields containing commas, quotes or newlines; double embedded quotes.
A custom food is {"name":"...","basis":"g","nutrients":{"kcal":100,"proteinG":5}}. Optional nameIt and brand are allowed. basis must be g or ml; nutrients are per 100 g or 100 ml. Nutrient keys and units: ${Object.entries(
  NUTRIENT_META,
)
  .map(([key, meta]) => `${key} (${meta.unit})`)
  .join(
    ', ',
  )}. Omit unknown nutrients; zero means a measured zero. Custom snapshots are unverified imported data, never USDA-verified.
Each entry quantity is grams or millilitres according to its food basis, never servings. No density conversion is inferred. A file permits up to 5000 entries, 366 days and 500 entries per day. Imports add entries after preview and preserve existing data. Retrying identical rows does not duplicate them; repeated identical rows within one file represent separate portions.
`;

/** A plain importable file, without generator integration or user nutrition data. */
export function buildFoodImportExample(catalog: Food[] = []): string {
  return JSON.stringify(
    {
      format: 'overload-food-log',
      version: 1,
      entries: [
        {
          date: new Date().toLocaleDateString('sv'),
          meal: 'lunch',
          quantity: 100,
          ...(catalog.length
            ? { foodId: catalog[0].id }
            : {
                food: {
                  name: 'Example food (replace label values)',
                  basis: 'g',
                  nutrients: { kcal: 100, proteinG: 5 },
                },
              }),
        },
      ],
    },
    null,
    2,
  );
}
