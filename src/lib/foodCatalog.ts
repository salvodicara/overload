import { NUTRIENT_META, validateFood, type Food, type NutrientKey } from './foodDiary';

let localCatalog: Promise<Food[]> | undefined;
export async function loadFoodCatalog(): Promise<Food[]> {
  localCatalog ??= fetch('/data/foods-usda.json')
    .then(async (response) => {
      if (!response.ok) throw new Error('food.catalogUnavailable');
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('food.catalogInvalid');
      return data.map((food) => validateFood(food));
    })
    .catch((error) => {
      localCatalog = undefined;
      throw error;
    });
  return localCatalog;
}

// Search aliases, not translations of food identity or nutrition.
const italian: Record<string, string> = {
  pollo: 'chicken',
  petto: 'breast',
  tacchino: 'turkey',
  manzo: 'beef',
  maiale: 'pork',
  vitello: 'veal',
  agnello: 'lamb',
  pesce: 'fish',
  salmone: 'salmon',
  tonno: 'tuna',
  merluzzo: 'cod',
  gamberi: 'shrimp',
  uovo: 'egg',
  uova: 'egg',
  albume: 'white',
  riso: 'rice',
  avena: 'oat',
  farina: 'flour',
  pane: 'bread',
  integrale: 'whole',
  patate: 'potato',
  patata: 'potato',
  latte: 'milk',
  greco: 'greek',
  formaggio: 'cheese',
  parmigiano: 'parmesan',
  burro: 'butter',
  olio: 'oil',
  oliva: 'olive',
  fagioli: 'beans',
  ceci: 'chickpeas',
  lenticchie: 'lentils',
  piselli: 'peas',
  mela: 'apple',
  mele: 'apple',
  banane: 'banana',
  arancia: 'orange',
  arance: 'orange',
  fragole: 'strawberries',
  mirtilli: 'blueberries',
  pera: 'pear',
  pere: 'pear',
  uva: 'grapes',
  pesca: 'peach',
  ananas: 'pineapple',
  pomodoro: 'tomato',
  pomodori: 'tomato',
  carote: 'carrot',
  zucchine: 'zucchini',
  spinaci: 'spinach',
  lattuga: 'lettuce',
  cipolla: 'onion',
  aglio: 'garlic',
  funghi: 'mushroom',
  peperoni: 'pepper',
  mandorle: 'almond',
  noci: 'walnut',
  arachidi: 'peanut',
  nocciole: 'hazelnut',
  miele: 'honey',
  zucchero: 'sugar',
  cioccolato: 'chocolate',
  cacao: 'cocoa',
  caffe: 'coffee',
  te: 'tea',
  acqua: 'water',
  succo: 'juice',
  crudo: 'raw',
  cruda: 'raw',
  crudi: 'raw',
  cotto: 'cooked',
  cotta: 'cooked',
  cotti: 'cooked',
  cotte: 'cooked',
  bollito: 'boiled',
  bollita: 'boiled',
  bollite: 'boiled',
  arrosto: 'roasted',
  fritto: 'fried',
  grigliato: 'grilled',
  secco: 'dry',
  secchi: 'dry',
  senza: 'without',
  sale: 'salt',
};
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export async function searchFoodCatalog(query: string, locale: string): Promise<Food[]> {
  const foods = await loadFoodCatalog();
  const words = normalize(query)
    .split(' ')
    .filter((word) => word && !['di', 'con', 'e', 'a', 'il', 'la'].includes(word));
  return foods
    .filter((food) => {
      const text = normalize([food.id, food.name, food.nameIt ?? ''].join(' '));
      return words.every(
        (word) => text.includes(word) || (italian[word] && text.includes(italian[word])),
      );
    })
    .sort((a, b) => {
      const head = words[0] ? (italian[words[0]] ?? words[0]) : '';
      const primary = (food: Food) => Number(normalize(food.name.split(',')[0]) === head);
      const exact = primary(b) - primary(a);
      if (head && exact) return exact;
      const localized = Number(Boolean(b.nameIt)) - Number(Boolean(a.nameIt));
      if ((!words.length || locale.startsWith('it')) && localized) return localized;
      return a.name.length - b.name.length || a.name.localeCompare(b.name);
    })
    .slice(0, 60);
}

const offNutrients: Partial<Record<NutrientKey, string>> = {
  kcal: 'energy-kcal',
  proteinG: 'proteins',
  carbsG: 'carbohydrates',
  fatG: 'fat',
  saturatedFatG: 'saturated-fat',
  fiberG: 'fiber',
  sugarG: 'sugars',
  saltG: 'salt',
  calciumMg: 'calcium',
  ironMg: 'iron',
  magnesiumMg: 'magnesium',
  potassiumMg: 'potassium',
  zincMg: 'zinc',
  sodiumMg: 'sodium',
  vitaminAMcg: 'vitamin-a',
  vitaminCMg: 'vitamin-c',
  vitaminDMcg: 'vitamin-d',
  vitaminEMg: 'vitamin-e',
  vitaminKMcg: 'vitamin-k',
  vitaminB1Mg: 'vitamin-b1',
  vitaminB2Mg: 'vitamin-b2',
  vitaminB3Mg: 'vitamin-pp',
  vitaminB6Mg: 'vitamin-b6',
  vitaminB12Mcg: 'vitamin-b12',
  folateMcg: 'vitamin-b9',
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function parseProduct(value: unknown, code: string): Food | null {
  const product = record(value);
  const set = record(record(product.nutrition).aggregated_set);
  // Explicit modern denominator only: legacy _100g can mean either 100g or 100ml.
  const basis = set.per === '100g' ? 'g' : set.per === '100ml' ? 'ml' : null;
  if (
    !basis ||
    set.preparation !== 'as_sold' ||
    typeof product.product_name !== 'string' ||
    !product.product_name.trim()
  )
    return null;
  const nutrients: Food['nutrients'] = {};
  const values = record(set.nutrients);
  const grams: Record<string, number> = { g: 1, mg: 0.001, ug: 0.000001, mcg: 0.000001 };
  for (const [key, offKey] of Object.entries(offNutrients) as [NutrientKey, string][]) {
    const nutrient = record(
      values[offKey] ?? (key === 'vitaminKMcg' ? values.phylloquinone : undefined),
    );
    if (nutrient.source === 'estimate' || ['<', '>', '≤', '≥'].includes(String(nutrient.modifier)))
      continue;
    if (
      typeof nutrient.value !== 'number' ||
      !Number.isFinite(nutrient.value) ||
      nutrient.value < 0
    )
      continue;
    const target = NUTRIENT_META[key].unit;
    const unit = String(nutrient.unit).replace(/[µμ]/g, 'u').toLowerCase();
    const factor =
      target === 'kcal'
        ? unit === 'kcal'
          ? 1
          : undefined
        : grams[unit] === undefined
          ? undefined
          : grams[unit] / grams[target];
    if (factor === undefined) continue;
    const amount = nutrient.value * factor;
    if (Number.isFinite(amount) && amount >= 0 && amount <= 1e9) nutrients[key] = amount;
  }
  if (!Object.keys(nutrients).length) return null;
  return validateFood({
    id: 'off:' + code,
    name: product.product_name,
    basis,
    nutrients,
    source: 'openfoodfacts',
    sourceId: code,
    ...(typeof product.product_name_it === 'string' && product.product_name_it.trim()
      ? { nameIt: product.product_name_it }
      : {}),
    ...(typeof product.brands === 'string' && product.brands.trim()
      ? { brand: product.brands.slice(0, 300) }
      : {}),
  });
}

const barcodeCache = new Map<string, Food>();
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Food | null> {
  if (!/^\d{8,14}$/.test(code)) throw new Error('food.invalidBarcode');
  signal?.throwIfAborted();
  const cached = barcodeCache.get(code);
  if (cached) return structuredClone(cached);
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Food lookup timed out', 'TimeoutError')),
    12_000,
  );
  try {
    const url = new URL('https://world.openfoodfacts.org/api/v3.6/product/' + code);
    url.searchParams.set('fields', 'code,product_name,product_name_it,brands,nutrition');
    const origin = typeof location === 'undefined' ? 'personal food diary' : location.origin;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'X-User-Agent': 'Overload/0.1 (' + origin + ')' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('food.lookupUnavailable');
    const data = record(await response.json());
    const food = parseProduct(data.product, code);
    if (food) barcodeCache.set(code, food);
    return food ? structuredClone(food) : null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
