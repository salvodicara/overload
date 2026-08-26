import { afterEach, expect, it, vi } from 'vitest';

type CatalogRow = {
  id: string;
  name: string;
  equipment?: string;
  primaryMuscles: string[];
  instructions: string[];
  images: string[];
};

const PUBLIC_ROW: CatalogRow = {
  id: 'public-row',
  name: 'Public row',
  primaryMuscles: ['abdominals'],
  instructions: [],
  images: [],
};

function response(rows: CatalogRow[], ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    json: vi.fn(async () => rows),
  } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function freshCatalog() {
  vi.resetModules();
  return import('../exercises');
}

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock('react');
  vi.doUnmock('../../state/useStore');
  vi.unstubAllGlobals();
});

it('shares one public request between concurrent catalog consumers', async () => {
  const request = deferred<Response>();
  const fetchMock = vi.fn(() => request.promise);
  vi.stubGlobal('fetch', fetchMock);
  const { loadCatalog } = await freshCatalog();

  const first = loadCatalog();
  const second = loadCatalog();
  expect(fetchMock).toHaveBeenCalledOnce();

  request.resolve(response([PUBLIC_ROW]));
  await expect(first).resolves.toBe(await second);
});

it('rejects an unsuccessful catalog response without parsing it', async () => {
  const failed = response([], false);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => failed),
  );
  const { loadCatalog } = await freshCatalog();

  await expect(loadCatalog()).rejects.toThrow('503');
  expect(failed.json).not.toHaveBeenCalled();
});

it('clears a failed in-flight request so a later consumer can retry', async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(response([PUBLIC_ROW]));
  vi.stubGlobal('fetch', fetchMock);
  const { getCatalog, loadCatalog } = await freshCatalog();

  await expect(loadCatalog()).rejects.toThrow('offline');
  const loaded = await loadCatalog();
  expect(loaded).toBe(getCatalog());
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('makes a custom exercise name and search available before the public fetch', async () => {
  const { exerciseName, registerCustomExercises, searchExercises } = await freshCatalog();

  registerCustomExercises([{ id: 'custom:carry', name: 'Suitcase carry', muscleGroup: 'core' }]);

  expect(exerciseName('custom:carry', 'en')).toBe('Suitcase carry');
  expect(searchExercises('suitcase', null, 'en').map((exercise) => exercise.id)).toEqual([
    'custom:carry',
  ]);
});

it('keeps only the newest account custom rows when the public request resolves', async () => {
  const request = deferred<Response>();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => request.promise),
  );
  const { loadCatalog, registerCustomExercises, searchExercises } = await freshCatalog();

  registerCustomExercises([{ id: 'custom:a', name: 'Account A row', muscleGroup: 'core' }]);
  const loading = loadCatalog();
  registerCustomExercises([{ id: 'custom:b', name: 'Account B row', muscleGroup: 'back' }]);
  request.resolve(response([PUBLIC_ROW]));
  await loading;

  expect(searchExercises('Account A', null, 'en')).toEqual([]);
  expect(searchExercises('Account B', null, 'en').map((exercise) => exercise.id)).toEqual([
    'custom:b',
  ]);
  expect(searchExercises('Public row', null, 'en').map((exercise) => exercise.id)).toEqual([
    'public-row',
  ]);
});

it('keeps aggregate custom muscle groups in their selected filters', async () => {
  const { registerCustomExercises, searchExercises } = await freshCatalog();
  registerCustomExercises([
    { id: 'custom:back', name: 'Back row', muscleGroup: 'back' },
    { id: 'custom:legs', name: 'Legs row', muscleGroup: 'legs' },
    { id: 'custom:arms', name: 'Arms row', muscleGroup: 'arms' },
  ]);

  expect(searchExercises('', 'back', 'en').map((exercise) => exercise.id)).toEqual(['custom:back']);
  expect(searchExercises('', 'legs', 'en').map((exercise) => exercise.id)).toEqual(['custom:legs']);
  expect(searchExercises('', 'arms', 'en').map((exercise) => exercise.id)).toEqual(['custom:arms']);
});

it('localizes every upstream equipment value instead of rendering raw catalog English', async () => {
  const { equipmentLabelKey } = await freshCatalog();

  expect(equipmentLabelKey('machine')).toBe('library.equipment.machine');
  expect(equipmentLabelKey('other')).toBe('library.equipment.other');
  expect(equipmentLabelKey('e-z curl bar')).toBe('library.equipment.ezCurlBar');
  expect(equipmentLabelKey('unknown upstream value')).toBe('library.equipment.other');
});

it('ranks bilingual token-order and conservative typo matches', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      response([
        {
          ...PUBLIC_ROW,
          id: 'Barbell_Squat',
          name: 'Barbell Squat',
          primaryMuscles: ['quadriceps'],
        },
        {
          ...PUBLIC_ROW,
          id: 'Dumbbell_Bench_Press',
          name: 'Dumbbell Bench Press',
          primaryMuscles: ['chest'],
        },
        {
          ...PUBLIC_ROW,
          id: 'Seated_Cable_Rows',
          name: 'Seated Cable Rows',
          primaryMuscles: ['middle back'],
        },
      ]),
    ),
  );
  const { loadCatalog, searchExercises } = await freshCatalog();
  await loadCatalog();

  expect(searchExercises('bilanciere squat', null, 'it')[0]?.id).toBe('Barbell_Squat');
  expect(searchExercises('panca manubri', null, 'en')[0]?.id).toBe('Dumbbell_Bench_Press');
  expect(searchExercises('bilancerie', null, 'it')[0]?.id).toBe('Barbell_Squat');
  expect(searchExercises('pulley', null, 'en')[0]?.id).toBe('Seated_Cable_Rows');
  expect(searchExercises('totally unrelated', null, 'it')).toEqual([]);
});

it('cancels overlapping retry timers when the catalog consumer unmounts', async () => {
  vi.useFakeTimers();
  const request = deferred<void>();
  const ensureCatalog = vi.fn(() => request.promise);
  let online = () => {};
  let cleanup = () => {};
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    addEventListener: (name: string, listener: () => void) => {
      if (name === 'online') online = listener;
    },
    removeEventListener: vi.fn(),
  });
  vi.resetModules();
  vi.doMock('react', () => ({
    useEffect: (effect: () => void | (() => void)) => {
      cleanup = effect() ?? (() => {});
    },
  }));
  vi.doMock('../../state/useStore', () => ({
    useStore: (select: (state: unknown) => unknown) =>
      select({ ensureCatalog, catalogReady: false }),
  }));
  const { useCatalog } = await import('../../hooks/useCatalog');

  useCatalog();
  online();
  request.reject(new Error('offline'));
  await Promise.resolve();
  await Promise.resolve();
  cleanup();
  await vi.advanceTimersByTimeAsync(500);

  expect(ensureCatalog).toHaveBeenCalledTimes(2);
});
