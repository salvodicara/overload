import { expect, test, type Page } from '@playwright/test';

const NEUTRAL_ROUTINE = /full body a/i;
const DOM_RECT_SUBPIXEL_EPSILON_PX = 0.01;

function expectAtLeast48PxGeometry(actualPx: number): void {
  expect(actualPx).toBeGreaterThanOrEqual(48 - DOM_RECT_SUBPIXEL_EPSILON_PX);
}

export async function installNeutralTemplate(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page
    .getByRole('button', { name: /^(use|usa)$/i })
    .first()
    .click();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
}

export async function startNeutralWorkout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /start full body a|inizia full body a/i }).click();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
}

export async function openNeutralRoutineEditor(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /edit full body a|modifica full body a/i }).click();
  await expect(page.getByRole('heading', { name: /edit routine|modifica scheda/i })).toBeVisible();
}

export async function completeAndFinishOneSet(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^(set 1|serie 1)$/i })
    .first()
    .click();
  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();
}

async function applyRapidRoutineEdits(page: Page): Promise<void> {
  await page.evaluate(() => {
    const setValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
      const prototype =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const preparation = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Warm-up"]',
    );
    const tracking = document.querySelector<HTMLSelectElement>('select[aria-label="Tracking"]');
    if (!preparation || !tracking) throw new Error('routine editor controls missing');
    setValue(preparation, '5 min easy bike');
    tracking.value = 'duration';
    tracking.dispatchEvent(new Event('change', { bubbles: true }));
    const workingSets = document.querySelector<HTMLInputElement>(
      'input[aria-label="Working sets"]',
    );
    const addWarmup = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Add warm-up set'),
    );
    if (!workingSets || !addWarmup) throw new Error('duration controls missing');
    setValue(workingSets, '4');
    addWarmup.click();
  });
}

async function installAdaptiveWorkoutFixture(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('overload');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        const routine = await new Promise<unknown>((resolve, reject) => {
          const request = database
            .transaction('routines', 'readonly')
            .objectStore('routines')
            .get('full-body-a');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        database.close();
        return Boolean(routine);
      }),
    )
    .toBe(true);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const routine = await new Promise<{
      id: string;
      exercises: Array<{
        exerciseId: string;
        sets: number;
        repMin: number;
        repMax: number | null;
        restSec: number;
        tracking?: 'weight_reps' | 'reps' | 'duration';
        warmupSets?: Array<{ weightKg?: number; reps?: number; durationSec?: number }>;
      }>;
      updatedAt: number;
    }>((resolve, reject) => {
      const request = database
        .transaction('routines', 'readonly')
        .objectStore('routines')
        .get('full-body-a');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const [weighted, repetitions, timed] = routine.exercises;
    routine.exercises = [
      {
        ...weighted,
        sets: 2,
        tracking: 'weight_reps',
        warmupSets: [{ weightKg: 20, reps: 5 }],
      },
      {
        ...repetitions,
        sets: 1,
        tracking: 'reps',
        warmupSets: [{ reps: 4 }],
      },
      {
        ...timed,
        sets: 1,
        repMin: 30,
        repMax: 45,
        tracking: 'duration',
        warmupSets: [{ durationSec: 15 }],
      },
    ];
    routine.updatedAt = Date.now();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['routines', 'workouts', 'settings'], 'readwrite');
      transaction.objectStore('routines').put(routine);
      transaction.objectStore('settings').put({
        id: 'settings',
        locale: 'en',
        unit: 'lb',
        updatedAt: Date.now(),
      });
      transaction.objectStore('workouts').put({
        id: 'adaptive-previous',
        routineId: routine.id,
        dayLabel: 'Full Body A',
        date: '2026-08-24',
        startTs: 100,
        sets: [
          {
            exerciseId: weighted.exerciseId,
            weightKg: 10,
            reps: 5,
            done: true,
            kind: 'warmup',
          },
          { exerciseId: weighted.exerciseId, weightKg: 40, reps: 8, done: true },
          { exerciseId: weighted.exerciseId, weightKg: 45, reps: 6, done: true },
          {
            exerciseId: repetitions.exerciseId,
            weightKg: 0,
            reps: 3,
            done: true,
            tracking: 'reps',
            kind: 'warmup',
          },
          {
            exerciseId: repetitions.exerciseId,
            weightKg: 0,
            reps: 12,
            done: true,
            tracking: 'reps',
          },
          {
            exerciseId: timed.exerciseId,
            weightKg: 0,
            reps: 0,
            durationSec: 10,
            done: true,
            tracking: 'duration',
            kind: 'warmup',
          },
          {
            exerciseId: timed.exerciseId,
            weightKg: 0,
            reps: 0,
            durationSec: 35,
            done: true,
            tracking: 'duration',
          },
        ],
        volumeKg: 0,
        updatedAt: 100,
        source: 'app',
      });
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
    database.close();
  });
  await page.reload();
}

async function setStoredLocale(page: Page, locale: 'it' | 'en'): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('overload');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        const routine = await new Promise<unknown>((resolve, reject) => {
          const request = database
            .transaction('routines', 'readonly')
            .objectStore('routines')
            .get('full-body-a');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        database.close();
        return Boolean(routine);
      }),
    )
    .toBe(true);
  await page.evaluate(async (nextLocale) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('settings', 'readwrite');
      transaction.objectStore('settings').put({
        id: 'settings',
        locale: nextLocale,
        unit: 'kg',
        updatedAt: Date.now(),
      });
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
    database.close();
  }, locale);
  await page.reload();
}

type StoredWorkoutJournalFact = {
  id: string;
  startTs: number;
  squatNote: string | null;
};

async function finishWithSessionNote(page: Page, text: string): Promise<void> {
  await startNeutralWorkout(page);
  await page
    .getByRole('button', { name: /^this session|^questa sessione/i })
    .first()
    .click();
  await page.getByLabel(/^this session|^questa sessione/i).fill(text);
  await completeAndFinishOneSet(page);
}

async function createTwoSameDayWorkoutNotes(
  page: Page,
  first: string,
  second: string,
): Promise<void> {
  await finishWithSessionNote(page, first);
  await finishWithSessionNote(page, second);
}

async function openExerciseDetail(
  page: Page,
  query = 'squat',
  name: RegExp = /^(barbell squat legs|squat con bilanciere gambe)$/i,
): Promise<void> {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  await page.getByRole('searchbox').fill(query);
  await page.getByRole('button', { name }).first().click();
}

async function readStoredWorkoutJournalFacts(page: Page): Promise<StoredWorkoutJournalFact[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      const records = await new Promise<
        Array<{
          id: string;
          startTs: number;
          exerciseNotes?: Array<{ exerciseId: string; text: string }>;
        }>
      >((resolve, reject) => {
        const request = database
          .transaction('workouts', 'readonly')
          .objectStore('workouts')
          .getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      return records.map((record) => ({
        id: record.id,
        startTs: record.startTs,
        squatNote:
          record.exerciseNotes?.find((note) => note.exerciseId === 'Barbell_Squat')?.text ?? null,
      }));
    } finally {
      database.close();
    }
  });
}

async function installCompletedWorkoutFixture(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('overload');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        try {
          const routine = await new Promise<unknown>((resolve, reject) => {
            const request = database
              .transaction('routines', 'readonly')
              .objectStore('routines')
              .get('full-body-a');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });
          return Boolean(routine);
        } finally {
          database.close();
        }
      }),
    )
    .toBe(true);

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          ['workouts', 'notes', 'settings', 'customExercises'],
          'readwrite',
        );
        transaction.objectStore('settings').put({
          id: 'settings',
          locale: 'en',
          unit: 'lb',
          updatedAt: 400,
        });
        transaction.objectStore('notes').put({
          id: 'Barbell_Squat',
          technique: 'Brace and drive',
          entries: [{ date: '2026-08-23', text: 'Legacy import' }],
          updatedAt: 400,
        });
        transaction.objectStore('customExercises').put({
          id: 'custom:i',
          name: 'I',
          muscleGroup: 'core',
          updatedAt: 400,
        });
        transaction.objectStore('workouts').put({
          id: 'newest-detail',
          routineId: 'full-body-a',
          dayLabel: 'Full Body A',
          date: '2026-08-25',
          startTs: 100,
          endTs: 1_000,
          sets: [
            {
              exerciseId: 'Barbell_Squat',
              weightKg: 20,
              reps: 5,
              done: true,
              kind: 'warmup',
              tracking: 'weight_reps',
            },
            { exerciseId: 'Barbell_Squat', weightKg: 50, reps: 8, done: true },
            {
              exerciseId: 'Hanging_Leg_Raise',
              weightKg: 0,
              reps: 4,
              done: true,
              kind: 'warmup',
              tracking: 'reps',
            },
            {
              exerciseId: 'Hanging_Leg_Raise',
              weightKg: 0,
              reps: 12,
              done: true,
              kind: 'working',
              tracking: 'reps',
            },
            {
              exerciseId: 'Plank',
              weightKg: 0,
              reps: 0,
              durationSec: 15,
              done: true,
              kind: 'warmup',
              tracking: 'duration',
            },
            {
              exerciseId: 'Plank',
              weightKg: 0,
              reps: 0,
              durationSec: 35,
              done: true,
              kind: 'working',
              tracking: 'duration',
            },
          ],
          volumeKg: 300,
          note: 'Imported coach note',
          exerciseNotes: [
            { exerciseId: 'Barbell_Squat', text: 'Linked observation' },
            { exerciseId: 'Face_Pull', text: 'No-set observation' },
            { exerciseId: 'custom:i', text: 'Short note-only observation' },
          ],
          updatedAt: 400,
          source: 'hevy',
        });
        transaction.objectStore('workouts').put({
          id: 'chronologically-latest',
          routineId: 'full-body-a',
          dayLabel: 'Full Body A',
          date: '2026-08-24',
          startTs: 200,
          endTs: 1_000,
          sets: [
            {
              exerciseId: 'Barbell_Squat',
              weightKg: 40,
              reps: 6,
              done: true,
              kind: 'working',
              tracking: 'weight_reps',
            },
          ],
          volumeKg: 100,
          exerciseNotes: [{ exerciseId: 'Barbell_Squat', text: 'Older observation' }],
          updatedAt: 200,
          source: 'app',
        });
        transaction.objectStore('workouts').put({
          id: 'collection-first',
          routineId: 'full-body-a',
          dayLabel: 'Full Body A',
          date: '2026-08-25',
          startTs: 50,
          endTs: 1_000,
          sets: [
            {
              exerciseId: 'Dumbbell_Bench_Press',
              weightKg: 30,
              reps: 10,
              done: true,
              kind: 'working',
              tracking: 'weight_reps',
            },
          ],
          volumeKg: 300,
          updatedAt: 50,
          source: 'app',
        });
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
    } finally {
      database.close();
    }
  });
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('overload');
  });
  await page.reload();
  await installNeutralTemplate(page);
});

test('home prioritizes the next routine and keeps history secondary', async ({ page }) => {
  await page.getByRole('button', { name: /home/i }).click();
  await expect(
    page.getByRole('heading', { name: /next workout|prossimo allenamento/i }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /start|inizia/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /all history|tutto lo storico/i })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('section[aria-labelledby]')).toHaveCount(3);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});

test('routine preparation and exercise settings remain editable', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  await page.getByRole('textbox', { name: /warm-up|riscaldamento/i }).fill('5 min easy bike');
  await page
    .getByLabel(/tracking|tracciamento/i)
    .first()
    .selectOption('duration');
  await page
    .getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i })
    .first()
    .click();
  await page
    .getByLabel(/technique|tecnica/i)
    .first()
    .fill('Brace before the timer starts');
  await page.getByRole('button', { name: /back|indietro/i }).click();
  await openNeutralRoutineEditor(page);
  await expect(page.getByRole('textbox', { name: /warm-up|riscaldamento/i })).toHaveValue(
    '5 min easy bike',
  );
  await expect(page.getByLabel(/tracking|tracciamento/i).first()).toHaveValue('duration');
  await expect(page.getByLabel(/seconds|secondi/i).first()).toHaveValue('6');
  await expect(page.getByLabel(/technique|tecnica/i).first()).toHaveValue(
    'Brace before the timer starts',
  );
  const firstExercise = page
    .locator('.card')
    .filter({ hasText: /barbell squat|squat con bilanciere/i })
    .first();
  await firstExercise.getByLabel(/tracking|tracciamento/i).selectOption('reps');
  await expect(firstExercise.getByLabel(/load|carico/i)).toHaveCount(0);
  await expect(firstExercise.getByLabel(/seconds|secondi/i)).toHaveCount(0);
  await firstExercise
    .getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i })
    .click();
  await firstExercise
    .getByLabel(/^reps$|^ripetizioni$/i)
    .last()
    .fill('9');
  await firstExercise.getByLabel(/tracking|tracciamento/i).selectOption('duration');
  await expect(firstExercise.getByLabel(/seconds|secondi/i).first()).toHaveValue('6');
  await firstExercise.getByLabel(/tracking|tracciamento/i).selectOption('reps');
  await expect(firstExercise.getByLabel(/^reps$|^ripetizioni$/i).last()).toHaveValue('9');
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByLabel(/working sets|serie di lavoro/i).first()).toHaveJSProperty(
    'offsetHeight',
    48,
  );
  await expect(page.getByLabel(/tracking|tracciamento/i).first()).toHaveJSProperty(
    'offsetHeight',
    48,
  );
});

test('routine editor serializes rapid prescription edits before starting', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  await applyRapidRoutineEdits(page);
  await page.getByRole('button', { name: /start|inizia/i }).click();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('overload_active') ?? 'null')?.ex[0]),
    )
    .toMatchObject({ tracking: 'duration' });
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('overload_active') ?? 'null')?.ex[0]?.sets,
      ),
    )
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'warmup', durationSec: 6, reps: null, weightKg: null }),
      ]),
    );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('overload_active') ?? 'null')?.ex[0]?.sets.filter(
            (set: { kind: string }) => set.kind === 'working',
          ).length,
      ),
    )
    .toBe(4);
});

test('routine editor persists rapid prescription edits after leaving', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  await applyRapidRoutineEdits(page);
  await page.getByRole('button', { name: /back|indietro/i }).click();
  await openNeutralRoutineEditor(page);
  await expect(page.getByRole('textbox', { name: /warm-up|riscaldamento/i })).toHaveValue(
    '5 min easy bike',
  );
  await expect(page.getByLabel(/tracking|tracciamento/i).first()).toHaveValue('duration');
  await expect(page.getByLabel(/working sets|serie di lavoro/i).first()).toHaveValue('4');
  await expect(page.getByLabel(/seconds|secondi/i).first()).toHaveValue('6');
});

test('routine editor preserves optional and canonical prescriptions', async ({ page }) => {
  await expect(
    page.getByRole('button', { name: /edit full body a|modifica full body a/i }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('settings', 'readwrite');
      transaction
        .objectStore('settings')
        .put({ id: 'settings', unit: 'lb', updatedAt: Date.now() });
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
    database.close();
  });
  await page.reload();
  await openNeutralRoutineEditor(page);
  const firstExercise = page
    .locator('.card')
    .filter({ hasText: /barbell squat|squat con bilanciere/i })
    .first();
  await expect(firstExercise.getByLabel(/tracking|tracciamento/i)).toHaveValue('weight_reps');
  await firstExercise.getByLabel(/start weight|peso iniziale/i).fill('220.5');
  await firstExercise.getByLabel(/increment|incremento/i).fill('');
  await firstExercise.getByLabel(/^max$/i).fill('');
  await firstExercise
    .getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i })
    .first()
    .click();
  await firstExercise.getByLabel(/load|carico/i).fill('110.2');
  await firstExercise.getByLabel(/^reps$|^ripetizioni$/i).fill('8');
  await firstExercise
    .getByRole('button', { name: /remove warm-up set|rimuovi serie di riscaldamento/i })
    .click();
  await expect(firstExercise.getByLabel(/load|carico/i)).toHaveCount(0);
  await firstExercise
    .getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i })
    .first()
    .click();
  await firstExercise.getByLabel(/load|carico/i).fill('110.2');
  await firstExercise.getByLabel(/^reps$|^ripetizioni$/i).fill('8');
  await page.getByRole('button', { name: /back|indietro/i }).click();
  await openNeutralRoutineEditor(page);
  const reopenedFirstExercise = page
    .locator('.card')
    .filter({ hasText: /barbell squat|squat con bilanciere/i })
    .first();
  await expect(reopenedFirstExercise.getByLabel(/start weight|peso iniziale/i)).toHaveValue(
    '220.5',
  );
  await expect(reopenedFirstExercise.getByLabel(/increment|incremento/i)).toHaveValue('');
  await expect(reopenedFirstExercise.getByLabel(/^max$/i)).toHaveValue('');
  await expect(reopenedFirstExercise.getByLabel(/load|carico/i)).toHaveValue('110.2');
  await expect(reopenedFirstExercise.getByLabel(/^reps$|^ripetizioni$/i)).toHaveValue('8');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('overload');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        const routine = await new Promise<{
          exercises: Array<{
            incrementKg?: number;
            repMax: number | null;
            startWeightKg?: number;
            warmupSets?: Array<{ weightKg?: number }>;
          }>;
        }>((resolve, reject) => {
          const request = database
            .transaction('routines', 'readonly')
            .objectStore('routines')
            .get('full-body-a');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        database.close();
        return routine.exercises[0];
      }),
    )
    .toMatchObject({
      incrementKg: undefined,
      startWeightKg: 100.01711758721281,
      repMax: null,
      warmupSets: [{ weightKg: 49.98587917510591 }],
    });
});

test('active workout keeps finish and previous values in reach', async ({ page }) => {
  await startNeutralWorkout(page);
  const finish = page.getByRole('button', {
    name: /finish workout|termina allenamento/i,
  });
  await expect(finish).toBeVisible();
  await expect(page.getByText(/previous|precedente/i).first()).toBeVisible();
  await expect(page.locator('.workout-header')).toHaveCSS('position', 'sticky');
  expect(
    await finish.evaluate((button) => {
      const firstExercise = document.querySelector('.exercise-block');
      return firstExercise
        ? Boolean(button.compareDocumentPosition(firstExercise) & Node.DOCUMENT_POSITION_FOLLOWING)
        : false;
    }),
  ).toBe(true);
  await page
    .getByRole('button', { name: /^(set 1|serie 1)$/i })
    .first()
    .click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('active workout keeps localized weighted headings visible', async ({ page }) => {
  await setStoredLocale(page, 'it');
  await startNeutralWorkout(page);

  for (const locale of ['it', 'en'] as const) {
    if (locale === 'en') await setStoredLocale(page, locale);
    const previousLabel = locale === 'it' ? 'Precedente' : 'Previous';
    for (const viewport of [
      { width: 320, height: 700 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      const geometry = await page.evaluate(() => {
        const headings = [
          ...document.querySelectorAll<HTMLElement>(
            '.set-table--weight-reps .set-table__header > :nth-child(2)',
          ),
        ];
        const contentWidth = (element: HTMLElement): number => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getBoundingClientRect().width;
        };
        const controls = [
          ...document.querySelectorAll<HTMLElement>(
            '.set-table--weight-reps .set-row input, .set-table--weight-reps .set-row button',
          ),
        ];
        return {
          headingCount: headings.length,
          headings: headings.map((heading) => ({
            text: heading.textContent,
            clientWidth: heading.clientWidth,
            contentWidth: contentWidth(heading),
          })),
          minControlHeight: Math.min(
            ...controls.map((control) => control.getBoundingClientRect().height),
          ),
          minControlWidth: Math.min(
            ...controls.map((control) => control.getBoundingClientRect().width),
          ),
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      expect(geometry.headingCount).toBe(5);
      expect(geometry.headings.every((heading) => heading.text === previousLabel)).toBe(true);
      expect(geometry.headings.every((heading) => heading.clientWidth >= 66)).toBe(true);
      expect(
        geometry.headings.every((heading) => heading.contentWidth <= heading.clientWidth + 0.5),
      ).toBe(true);
      expectAtLeast48PxGeometry(geometry.minControlHeight);
      expectAtLeast48PxGeometry(geometry.minControlWidth);
      expect(geometry.scrollWidth).toBe(viewport.width);
    }
  }
});

test('active workout adapts rows without shifting working previous values', async ({ page }) => {
  await installAdaptiveWorkoutFixture(page);
  await startNeutralWorkout(page);
  const blocks = page.locator('.exercise-block');
  const weighted = blocks.nth(0);
  const repetitions = blocks.nth(1);
  const timed = blocks.nth(2);

  await expect(weighted.locator('.set-row')).toHaveCount(3);
  const warmupKind = weighted.locator('.set-kind-toggle').first();
  await expect(warmupKind).toHaveText('W');
  await expect(weighted.locator('.set-previous')).toHaveText(['—', '88.2 × 8', '99.2 × 6']);
  await warmupKind.click();
  await expect(warmupKind).toHaveText('1');
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('overload_active') ?? 'null').ex[0].sets[0].kind,
      ),
    )
    .toBe('working');
  await warmupKind.click();
  await expect(warmupKind).toHaveText('W');

  const warmupLoad = weighted.getByLabel(/set 1 load.*lb/i);
  await expect(warmupLoad).toHaveValue('44.1');
  await warmupLoad.click();
  await page.keyboard.type('110.2');
  await expect(warmupLoad).toHaveValue('110.2');
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('overload_active') ?? 'null').ex[0].sets[0].weightKg,
      ),
    )
    .toBeCloseTo(49.9858791751, 8);

  await expect(repetitions.locator('.set-row')).toHaveCount(2);
  await expect(repetitions.locator('input[inputmode="decimal"]')).toHaveCount(0);
  await expect(repetitions.locator('.set-previous')).toHaveText(['—', '12']);
  await expect(repetitions.getByLabel(/set 1 reps/i)).toHaveValue('4');

  await expect(timed.locator('.set-row')).toHaveCount(2);
  await expect(timed.locator('.set-previous')).toHaveText(['—', '35s']);
  await expect(timed.getByLabel(/set 1 seconds/i)).toHaveValue('15');
  await expect(page.getByText(/technique/i)).toHaveCount(3);
  await expect(page.getByRole('button', { name: /barbell squat/i })).toHaveCount(1);

  await weighted.getByRole('button', { name: /^(set 1|serie 1)$/i }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const viewport of [
      { width: 320, height: 700 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      const topMetrics = await page.evaluate(() => {
        const finish = document.querySelector<HTMLElement>('.workout-header__finish');
        const setControls = [
          ...document.querySelectorAll<HTMLElement>('.set-row input, .set-row button'),
        ];
        const rows = [...document.querySelectorAll<HTMLElement>('.set-row')];
        return {
          scrollWidth: document.documentElement.scrollWidth,
          finishHeight: finish?.getBoundingClientRect().height ?? 0,
          minSetControlHeight: Math.min(
            ...setControls.map((control) => control.getBoundingClientRect().height),
          ),
          maxRowRight: Math.max(...rows.map((row) => row.getBoundingClientRect().right)),
          previousClipped: [
            ...document.querySelectorAll<HTMLElement>(
              '.set-table__header > :nth-child(2), .set-previous',
            ),
          ].some((value) => {
            const content = document.createRange();
            content.selectNodeContents(value);
            return content.getBoundingClientRect().width > value.clientWidth + 0.5;
          }),
        };
      });
      expect(topMetrics.scrollWidth).toBe(viewport.width);
      expectAtLeast48PxGeometry(topMetrics.finishHeight);
      expectAtLeast48PxGeometry(topMetrics.minSetControlHeight);
      expect(topMetrics.maxRowRight).toBeLessThanOrEqual(viewport.width);
      expect(topMetrics.previousClipped).toBe(false);

      const finish = page.getByRole('button', {
        name: /finish workout|termina allenamento/i,
      });
      const finishBox = await finish.boundingBox();
      expect(finishBox).not.toBeNull();
      await page.mouse.move(
        (finishBox?.x ?? 0) + (finishBox?.width ?? 0) / 2,
        (finishBox?.y ?? 0) + (finishBox?.height ?? 0) / 2,
      );
      await page.mouse.down();
      await page.waitForTimeout(150);
      const pressedFinish = await finish.evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      });
      await page.mouse.move(0, viewport.height - 1);
      await page.mouse.up();
      expectAtLeast48PxGeometry(pressedFinish.width);
      expectAtLeast48PxGeometry(pressedFinish.height);

      const restButtons = await page.locator('.restbar-btn').evaluateAll((buttons) =>
        buttons.map((button) => {
          const bounds = button.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        }),
      );
      expect(restButtons).toHaveLength(2);
      for (const restButton of restButtons) {
        expectAtLeast48PxGeometry(restButton.width);
        expectAtLeast48PxGeometry(restButton.height);
      }

      await page
        .locator('.workout-actions')
        .evaluate((element) => element.scrollIntoView({ block: 'center' }));
      const bottomMetrics = await page.evaluate(() => {
        const rest = document.querySelector<HTMLElement>('.restbar-inner')?.getBoundingClientRect();
        const actions = document
          .querySelector<HTMLElement>('.workout-actions')
          ?.getBoundingClientRect();
        return {
          restLeft: rest?.left ?? -1,
          restRight: rest?.right ?? Number.POSITIVE_INFINITY,
          actionsBottom: actions?.bottom ?? Number.POSITIVE_INFINITY,
          restTop: rest?.top ?? -1,
        };
      });
      expect(bottomMetrics.restLeft).toBeGreaterThanOrEqual(0);
      expect(bottomMetrics.restRight).toBeLessThanOrEqual(viewport.width);
      expect(bottomMetrics.actionsBottom).toBeLessThan(bottomMetrics.restTop);
    }
  }
});

test('log a workout end to end', async ({ page }) => {
  await startNeutralWorkout(page);

  const checks = page.locator('.setcheck');
  await checks.nth(0).click();
  await expect(page.locator('.restbar')).toBeVisible();
  await checks.nth(1).click();

  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await expect(page.getByText(/kg of volume|kg di volume/i)).toBeVisible();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();
  await expect(page.getByText(/this week|questa settimana/i)).toBeVisible();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
});

test('empty session is discarded, not recorded', async ({ page }) => {
  await startNeutralWorkout(page);
  await page.locator('.iconbtn').first().click();
  await expect(page.getByRole('button', { name: /^(train|allenati)$/i })).toBeVisible();
  await page.getByRole('button', { name: /^home$/i }).click();
  await expect(page.getByText(/no workouts yet|ancora nessun allenamento/i)).toBeVisible();
});

test('routines are fully editable and deletable', async ({ page }) => {
  await page.getByRole('button', { name: /\+ (create|crea)/i }).click();
  await page.getByRole('button', { name: /^(new routine|nuova scheda)$/i }).click();
  await page.getByRole('button', { name: /^(create|crea)$/i }).click();
  await expect(page.getByText(/edit routine|modifica scheda/i)).toBeVisible();
  await page.getByRole('button', { name: /^\+ (exercise|esercizio)$/i }).click();
  await page.getByPlaceholder(/search|cerca/i).fill('squat');
  await page
    .locator('.card', { hasText: /barbell squat/i })
    .first()
    .click();
  await expect(page.getByText(/edit routine|modifica scheda/i)).toBeVisible();
  await expect(page.getByText(/barbell squat/i).first()).toBeVisible();
  await page.getByRole('button', { name: /delete routine|elimina routine/i }).click();
  await page.getByRole('button', { name: /^(delete|elimina)$/i }).click();
  await expect(page.getByRole('button', { name: /\+ (create|crea)/i })).toBeVisible();
});

test('programs group routines and are manageable', async ({ page }) => {
  await page.getByRole('button', { name: /\+ (create|crea)/i }).click();
  await page.getByRole('button', { name: /^(new program|nuovo programma)$/i }).click();
  await page.getByLabel(/routine name|nome/i).fill('Test Program');
  await page.getByRole('button', { name: /^(create|crea)$/i }).click();
  // Empty program invites adding its first routine.
  await page.getByRole('button', { name: /empty program|programma vuoto/i }).click();
  await page.getByLabel(/routine name|nome/i).fill('Day X');
  await page.getByRole('button', { name: /^(create|crea)$/i }).click();
  await expect(page.getByText(/edit routine|modifica scheda/i)).toBeVisible();
  await page
    .getByRole('button', { name: /back|indietro/i })
    .first()
    .click();
  await expect(page.getByText(/test program/i)).toBeVisible();
  await expect(page.getByText(/day x/i)).toBeVisible();
  // Delete the program: routine survives as standalone.
  await page
    .getByRole('button', { name: /test program.*(program options|opzioni programma)/i })
    .click();
  await page.getByRole('button', { name: /delete program|elimina programma/i }).click();
  await page.getByRole('button', { name: /^(delete|elimina)$/i }).click();
  await expect(page.getByText(/test program/i)).toHaveCount(0);
  await expect(page.getByText(/day x/i)).toBeVisible();
});

test('technique persists globally and session notes stay on their workouts', async ({ page }) => {
  await startNeutralWorkout(page);

  const technique = page.getByRole('button', { name: /^technique|^tecnica/i }).first();
  const session = page.getByRole('button', { name: /^this session|^questa sessione/i }).first();
  await expect(technique).toHaveAttribute('aria-expanded', 'false');
  await expect(session).toHaveAttribute('aria-expanded', 'false');
  expect(
    await page.locator('.workout-note__trigger').evaluateAll((triggers) =>
      triggers.every((trigger) => {
        const controlledId = trigger.getAttribute('aria-controls');
        return controlledId !== null && document.getElementById(controlledId) !== null;
      }),
    ),
  ).toBe(true);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(
      await page
        .locator('.workout-note__trigger')
        .evaluateAll((triggers) =>
          triggers.every((trigger) => trigger.getBoundingClientRect().height >= 44),
        ),
    ).toBe(true);
  }

  await technique.click();
  await expect(technique).toHaveAttribute('aria-expanded', 'true');
  expect(
    await page.getByRole('textbox', { name: /^technique|^tecnica/i }).evaluate((editor) => {
      const labelId = editor.getAttribute('aria-labelledby');
      return labelId !== null && document.getElementById(labelId)?.textContent?.trim();
    }),
  ).toBe('Technique');
  await page.getByLabel(/^technique|^tecnica/i).fill('Seat at 4');
  const done = page.getByRole('button', { name: /^done|^fatto/i });
  expect(
    await done.evaluate((button) => button.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  await done.dblclick();
  await expect(done).toHaveCount(0);
  await expect(technique).toHaveAttribute('aria-expanded', 'false');
  await expect(technique).toContainText('Seat at 4');
  expect(
    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('overload');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const note = await new Promise<{ technique?: string } | undefined>((resolve, reject) => {
        const request = database
          .transaction('notes', 'readonly')
          .objectStore('notes')
          .get('Barbell_Squat');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      database.close();
      return note?.technique;
    }),
  ).toBe('Seat at 4');
  expect(
    await page.locator('.workout-note__trigger').evaluateAll((triggers) =>
      triggers.every((trigger) => {
        const controlledId = trigger.getAttribute('aria-controls');
        return controlledId !== null && document.getElementById(controlledId) !== null;
      }),
    ),
  ).toBe(true);

  await session.click();
  await expect(session).toHaveAttribute('aria-expanded', 'true');
  expect(
    await page
      .getByRole('textbox', { name: /^this session|^questa sessione/i })
      .evaluate((editor) => {
        const labelId = editor.getAttribute('aria-labelledby');
        return labelId !== null && document.getElementById(labelId)?.textContent?.trim();
      }),
  ).toBe('This session');
  await page.getByLabel(/^this session|^questa sessione/i).fill('First session');
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('overload_active') ?? 'null')?.ex[0]?.sessionNote,
      ),
    )
    .toBe('First session');

  await page.getByRole('button', { name: /minimize|riduci/i }).click();
  await page.locator('.active-bar').click();
  await expect(session).toContainText('First session');
  await expect(page.locator('.workout-note__context')).toHaveCount(0);

  await completeAndFinishOneSet(page);

  const firstWorkoutNotes = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const records = await new Promise<Array<{ exerciseNotes?: { text: string }[] }>>(
      (resolve, reject) => {
        const request = database
          .transaction('workouts', 'readonly')
          .objectStore('workouts')
          .getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      },
    );
    database.close();
    return records.flatMap((record) => record.exerciseNotes?.map((note) => note.text) ?? []);
  });
  expect(firstWorkoutNotes).toContain('First session');

  await startNeutralWorkout(page);
  await expect(technique).toContainText('Seat at 4');
  await expect(session).toContainText(/how this exercise felt|com'è andato/i);
  await session.click();
  await expect(page.getByLabel(/^this session|^questa sessione/i)).toHaveValue('');
  await expect(page.locator('.workout-note__context')).toContainText('First session');
  await page.getByLabel(/^this session|^questa sessione/i).fill('Second session');
  await completeAndFinishOneSet(page);

  const sessionNotes = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const records = await new Promise<Array<{ exerciseNotes?: { text: string }[] }>>(
      (resolve, reject) => {
        const request = database
          .transaction('workouts', 'readonly')
          .objectStore('workouts')
          .getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      },
    );
    database.close();
    return records.flatMap((record) => record.exerciseNotes?.map((note) => note.text) ?? []);
  });
  expect(sessionNotes).toEqual(expect.arrayContaining(['First session', 'Second session']));
  expect(
    sessionNotes.filter((text) => text === 'First session' || text === 'Second session'),
  ).toHaveLength(2);
});

for (const locale of ['it', 'en'] as const) {
  test(`exercise journal links session observations to distinct workouts (${locale})`, async ({
    page,
  }) => {
    await setStoredLocale(page, locale);
    await createTwoSameDayWorkoutNotes(page, 'First session', 'Second session');

    const workouts = (await readStoredWorkoutJournalFacts(page)).filter(
      (workout) => workout.squatNote !== null,
    );
    expect(workouts).toHaveLength(2);
    expect(new Set(workouts.map((workout) => workout.id)).size).toBe(2);
    expect(new Set(workouts.map((workout) => workout.startTs)).size).toBe(2);
    expect(workouts.map((workout) => workout.squatNote)).toEqual(
      expect.arrayContaining(['First session', 'Second session']),
    );

    await openExerciseDetail(page);
    await expect(
      page.getByRole('heading', {
        name: locale === 'it' ? 'Squat con bilanciere' : 'Barbell Squat',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText('First session', { exact: true })).toBeVisible();
    const secondSession = page.getByRole('button', { name: /Second session/ });
    await expect(secondSession).toBeVisible();
    expect(
      await secondSession.evaluate((button) => button.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await secondSession.click();
    await expect(page.getByRole('heading', { name: 'Full Body A', exact: true })).toBeVisible();
    await expect(page.getByText('Second session', { exact: true })).toBeVisible();
    await expect(page.getByText('First session', { exact: true })).toHaveCount(0);
  });
}

test('exercise journal links truthful tracking, legacy and note-only workout records', async ({
  page,
}) => {
  await installCompletedWorkoutFixture(page);
  await openExerciseDetail(page);

  await expect(page.getByRole('heading', { name: 'Barbell Squat', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /latest working performance.*lb/i }),
  ).toBeVisible();
  await expect(page.getByText('110.2 × 8', { exact: true })).toBeVisible();
  await expect(page.getByText('44.1 × 5', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Technique', exact: true })).toBeVisible();
  const technique = page.getByRole('button', { name: /^technique/i });
  expect(
    await technique.evaluate((button) => button.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  await technique.click();
  const techniqueEditor = page.getByRole('textbox', { name: /^technique/i });
  await expect(techniqueEditor).toHaveValue('Brace and drive');
  await expect(techniqueEditor).toBeFocused();
  await page.keyboard.press('Tab');
  const techniqueDone = page.getByRole('button', { name: 'Done', exact: true });
  await expect(techniqueDone).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(technique).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Linked observation/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Older observation/ })).toBeVisible();
  await expect(page.getByText('Legacy import', { exact: true })).toBeVisible();
  expect(
    await page
      .getByText('Legacy import', { exact: true })
      .evaluate((entry) => entry.closest('button') === null),
  ).toBe(true);

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    expect(
      await page
        .getByRole('button', { name: /Linked observation/ })
        .evaluate((button) => button.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole('button', { name: /Linked observation/ }).click();
  await expect(page.getByRole('heading', { name: 'Full Body A', exact: true })).toBeVisible();
  await expect(page.getByText('661.4', { exact: true })).toBeVisible();
  await expect(page.getByText('lb of volume', { exact: true })).toBeVisible();
  const squat = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: 'Barbell Squat', exact: true }),
  });
  await expect(squat.getByRole('heading', { name: 'Warm-up sets' })).toBeVisible();
  await expect(squat.getByLabel('Warm-up set 1', { exact: true })).toContainText(
    /W\s*· 44\.1 lb × 5 reps/,
  );
  await expect(squat.getByRole('heading', { name: 'Working sets' })).toBeVisible();
  await expect(squat.getByLabel('Working set 1', { exact: true })).toContainText(
    /1\s*· 110\.2 lb × 8 reps/,
  );

  const repetitions = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: 'Hanging Leg Raise', exact: true }),
  });
  await expect(repetitions.getByLabel('Warm-up set 1', { exact: true })).toContainText(
    /W\s*· 4 reps/,
  );
  await expect(repetitions.getByLabel('Working set 1', { exact: true })).toContainText(
    /1\s*· 12 reps/,
  );
  const duration = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: 'Plank', exact: true }),
  });
  await expect(duration.getByLabel('Warm-up set 1', { exact: true })).toContainText(
    /W\s*· 15 seconds/,
  );
  await expect(duration.getByLabel('Working set 1', { exact: true })).toContainText(
    /1\s*· 35 seconds/,
  );

  const noteOnly = page.locator('section.card').filter({ hasText: 'Face Pull' });
  await expect(noteOnly.getByRole('heading', { name: 'This session' })).toBeVisible();
  await expect(noteOnly.getByText('No-set observation', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Imported workout note' })).toBeVisible();
  await expect(page.getByText('Imported coach note', { exact: true })).toBeVisible();
  const shortExercise = page.getByRole('button', { name: 'I', exact: true });
  await expect(shortExercise).toBeVisible();
  await expect(page.getByText('Short note-only observation', { exact: true })).toBeVisible();
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    const target = await shortExercise.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }

  await openExerciseDetail(page, 'hanging leg raise', /hanging leg raise/i);
  await expect(page.getByRole('heading', { name: 'Hanging Leg Raise', exact: true })).toBeVisible();
  await expect(page.getByText('12 reps', { exact: true })).toBeVisible();
  await openExerciseDetail(page, 'plank', /^plank core$/i);
  await expect(page.getByRole('heading', { name: 'Plank', exact: true })).toBeVisible();
  await expect(page.getByText('35 seconds', { exact: true })).toBeVisible();
});

test('exercise journal links summary working metrics to chronological history', async ({
  page,
}) => {
  await installCompletedWorkoutFixture(page);
  await installAdaptiveWorkoutFixture(page);
  await startNeutralWorkout(page);

  const squat = page.locator('.exercise-block').first();
  await squat.getByLabel(/set 2 load.*lb/i).fill('100');
  await squat.getByLabel(/set 2 reps/i).fill('8');
  await squat.getByRole('button', { name: /^set 1$/i }).click();
  await squat.getByRole('button', { name: /^set 2$/i }).click();
  await page.getByRole('button', { name: /finish workout/i }).click();

  await expect(page.locator('.summary-pop .mono.small.muted')).toContainText('1 working set');
  await expect(page.getByText('+579.5 lb vs your last Full Body A', { exact: true })).toBeVisible();
  await expect(page.getByText('800', { exact: true })).toBeVisible();
  await expect(page.getByText('lb of volume', { exact: true })).toBeVisible();
});

test('summary and workout detail preserve canonical kg volume rounding', async ({ page }) => {
  await installAdaptiveWorkoutFixture(page);
  await setStoredLocale(page, 'en');
  await startNeutralWorkout(page);

  const firstSession = page.locator('.exercise-block').first();
  await firstSession.getByLabel(/set 2 load.*kg/i).fill('42.5');
  await firstSession.getByLabel(/set 2 reps/i).fill('3');
  await firstSession.getByLabel(/set 3 load.*kg/i).fill('0');
  await firstSession.getByLabel(/set 3 reps/i).fill('3');
  await firstSession.getByRole('button', { name: /^set 2$/i }).click();
  await firstSession.getByRole('button', { name: /^set 3$/i }).click();
  await page.getByRole('button', { name: /finish workout/i }).click();

  await expect(page.getByText('128', { exact: true })).toBeVisible();
  await expect(page.getByText('kg of volume', { exact: true })).toBeVisible();
  await expect(page.getByText('+128 kg vs your last Full Body A', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('overload');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      try {
        const workouts = await new Promise<Array<{ startTs: number; volumeKg: number }>>(
          (resolve, reject) => {
            const request = database
              .transaction('workouts', 'readonly')
              .objectStore('workouts')
              .getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          },
        );
        return workouts.sort((left, right) => right.startTs - left.startTs)[0]?.volumeKg;
      } finally {
        database.close();
      }
    }),
  ).toBe(127.5);

  await page.getByRole('button', { name: /back home/i }).click();
  await startNeutralWorkout(page);
  const secondSession = page.locator('.exercise-block').first();
  await secondSession.getByLabel(/set 2 load.*kg/i).fill('0');
  await secondSession.getByLabel(/set 2 reps/i).fill('3');
  await secondSession.getByLabel(/set 3 load.*kg/i).fill('0');
  await secondSession.getByLabel(/set 3 reps/i).fill('3');
  await secondSession.getByRole('button', { name: /^set 2$/i }).click();
  await secondSession.getByRole('button', { name: /^set 3$/i }).click();
  await page.getByRole('button', { name: /finish workout/i }).click();

  await expect(page.getByText('−127 kg vs your last Full Body A', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /back home/i }).click();
  await page.getByRole('button', { name: /all history/i }).click();
  await page.locator('main button.card').nth(1).click();
  await expect(page.getByText('128', { exact: true })).toBeVisible();
  await expect(page.getByText('kg of volume', { exact: true })).toBeVisible();
});

test('mid-workout rest tweak can update the routine', async ({ page }) => {
  await startNeutralWorkout(page);
  // Open the rest editor on the first exercise and add 15s.
  await page
    .getByRole('button', { name: /rest |rec /i })
    .first()
    .click();
  await page.getByRole('button', { name: /raise rest|aumenta recupero/i }).click();
  await page.getByRole('button', { name: /^ok$/i }).click();
  await page.locator('.setcheck').first().click();
  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await expect(page.getByText(/update the routine|aggiornare la scheda/i)).toBeVisible();
  await page.getByRole('button', { name: /update routine|aggiorna scheda/i }).click();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();
  // The routine now carries the new rest: start again and check the chip.
  await startNeutralWorkout(page);
  await expect(page.getByRole('button', { name: /2[’′]45|165/ }).first()).toBeVisible();
});

test('no horizontal overflow on any tab', async ({ page }) => {
  for (const tab of [
    /^home$/i,
    /^(train|allenati)$/i,
    /^(exercises|esercizi)$/i,
    /^(progress|progressi)$/i,
    /^(profile|profilo)$/i,
  ]) {
    await page.getByRole('button', { name: tab }).click();
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `overflow on ${tab}`).toBeLessThanOrEqual(0);
  }
});

test('active workout is reachable from any tab via the banner', async ({ page }) => {
  await startNeutralWorkout(page);
  await page.locator('.setcheck').first().click();
  // Minimize the workout, wander to another tab: nothing is lost.
  await page.getByRole('button', { name: /minimize|riduci/i }).click();
  await page.getByRole('button', { name: /^home$/i }).click();
  await expect(page.locator('.active-bar')).toBeVisible();
  await page.locator('.active-bar').click();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
  await expect(page.locator('.setrow.done')).toHaveCount(1);
});

test('home protects an active workout until it is resumed', async ({ page }) => {
  await startNeutralWorkout(page);
  await page.locator('.setcheck').first().click();
  const activeBefore = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('overload_active') ?? 'null'),
  );
  await page.getByRole('button', { name: /minimize|riduci/i }).click();
  await page.getByRole('button', { name: /^home$/i }).click();

  await expect(
    page.getByRole('heading', {
      name: /resume workout in progress|riprendi l'allenamento in corso/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^(start|inizia)$/i })).toHaveCount(0);

  await page
    .locator('section[aria-labelledby="resume-workout"]')
    .getByRole('button', { name: /resume|riprendi/i })
    .click();
  await expect(page.locator('.setrow.done')).toHaveCount(1);
  await expect(page.locator('.setcheck').first()).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('overload_active') ?? 'null')))
    .toEqual(activeBefore);
});

test('hardware back navigates the app', async ({ page }) => {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  await page.getByPlaceholder(/search|cerca/i).fill('barbell squat');
  await page
    .getByRole('button', { name: /^(barbell squat legs|squat con bilanciere gambe)$/i })
    .click();
  await expect(page.getByText(/how to|esecuzione/i)).toBeVisible();
  await page.goBack();
  await expect(page.getByPlaceholder(/search|cerca/i)).toBeVisible();
});

test('workout in progress survives reload', async ({ page }) => {
  await startNeutralWorkout(page);
  await page.locator('.setcheck').first().click();
  await page.reload();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
  await expect(page.locator('.setrow.done')).toHaveCount(1);
});
