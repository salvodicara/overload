import { expect, test, type Locator, type Page } from '@playwright/test';
import type { BackupV1, BackupV2 } from '../src/lib/importer';
import type { Workout } from '../src/lib/types';

const NEUTRAL_ROUTINE = /full body a/i;
const DOM_RECT_SUBPIXEL_EPSILON_PX = 0.01;

function expectAtLeast48PxGeometry(actualPx: number): void {
  expect(actualPx).toBeGreaterThanOrEqual(48 - DOM_RECT_SUBPIXEL_EPSILON_PX);
}

function expectAtLeast44PxGeometry(actualPx: number): void {
  expect(actualPx).toBeGreaterThanOrEqual(44 - DOM_RECT_SUBPIXEL_EPSILON_PX);
}

type RouteFrame = {
  animation: string;
  translateY: number;
  scrollY: number;
  view: 'exercise' | 'library' | 'other';
};

async function startRouteFrameTrace(page: Page): Promise<void> {
  await page.evaluate(() => {
    const trace = { active: true, frames: [] as RouteFrame[] };
    const sample = () => {
      const screen = document.querySelector<HTMLElement>('.screen');
      if (screen) {
        const style = getComputedStyle(screen);
        trace.frames.push({
          animation: style.animationName,
          translateY: new DOMMatrixReadOnly(style.transform).m42,
          scrollY: window.scrollY,
          view: document.querySelector('.exercise-detail')
            ? 'exercise'
            : document.querySelector('.library-screen')
              ? 'library'
              : 'other',
        });
      }
      if (trace.active) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    Object.assign(window, { __routeFrameTrace: trace });
  });
}

async function stopRouteFrameTrace(page: Page): Promise<RouteFrame[]> {
  return page.evaluate(() => {
    const state = window as unknown as {
      __routeFrameTrace: { active: boolean; frames: RouteFrame[] };
    };
    state.__routeFrameTrace.active = false;
    return state.__routeFrameTrace.frames;
  });
}

export async function installNeutralTemplate(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /^(explore|esplora)$/i }).click();
  const explore = page.getByRole('dialog', { name: /explore programs|esplora programmi/i });
  await explore
    .getByRole('button', { name: /^(use|usa)$/i })
    .first()
    .click();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: /start full body b|inizia full body b/i }),
  ).toBeVisible();
}

test('Train keeps one program accordion open and separates ready-made programs', async ({
  page,
}) => {
  const fullBody = page.getByRole('button', {
    name: /full body a\/b.*2 (routines|schede)/i,
  });
  await expect(fullBody).toHaveAttribute('aria-expanded', 'true');
  const programHeading = fullBody.locator('xpath=..');
  const programOptions = programHeading.getByRole('button', {
    name: /full body a\/b.*(program options|opzioni programma)/i,
  });
  await expect(programOptions).toBeVisible();
  await expect(programOptions.locator('svg circle')).toHaveCount(3);
  const fullBodySection = fullBody.locator('xpath=../..');
  const fullBodyContent = fullBodySection.locator('.train-program__content');
  const fullBodyChevron = fullBody.locator('.train-program__chevron');
  await expect(fullBodyContent).toHaveAttribute('aria-hidden', 'false');
  await expect(fullBodyContent).not.toHaveAttribute('hidden', '');
  await expect(fullBodyChevron).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  expect(
    await fullBodyContent.evaluate((element) => getComputedStyle(element).transitionDuration),
  ).not.toBe('0s');

  await page.getByRole('button', { name: /^(explore|esplora)$/i }).click();
  const explore = page.getByRole('dialog', { name: /explore programs|esplora programmi/i });
  await expect(explore.getByText(/push \/ pull \/ legs/i)).toBeVisible();
  await explore.getByRole('button', { name: /^(use|usa)$/i }).click();

  const ppl = page.getByRole('button', {
    name: /push \/ pull \/ legs.*3 (routines|schede)/i,
  });
  await expect(ppl).toHaveAttribute('aria-expanded', 'true');
  await expect(fullBody).toHaveAttribute('aria-expanded', 'false');
  await expect(fullBodyContent).toHaveAttribute('aria-hidden', 'true');
  await expect(fullBodyChevron).not.toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await fullBody.click();
  await expect(fullBody).toHaveAttribute('aria-expanded', 'true');
  await expect(ppl).toHaveAttribute('aria-expanded', 'false');
});

test('Train keeps its empty-state divider clear of the explore-programs card', async ({ page }) => {
  await page
    .getByRole('button', { name: /full body a\/b.*(program options|opzioni programma)/i })
    .click();
  await page.getByRole('button', { name: /delete program|elimina programma/i }).click();
  await page.getByRole('button', { name: /^(delete|elimina)$/i }).click();

  const gap = await page.locator('.train-empty, .train-explore').evaluateAll((elements) => {
    const [empty, explore] = elements.map((element) => element.getBoundingClientRect());
    return explore.top - empty.bottom;
  });

  expect(gap).toBeGreaterThanOrEqual(24);
});

test('the same exercise keeps a different technique note in each routine', async ({ page }) => {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction('routines', 'readwrite');
    const store = transaction.objectStore('routines');
    const get = (id: string) =>
      new Promise<{
        id: string;
        exercises: Array<{ exerciseId: string; note?: string }>;
      }>((resolve, reject) => {
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    const routineA = await get('full-body-a');
    const routineB = await get('full-body-b');
    routineA.exercises[0].note = 'Cue specifica del Giorno A';
    routineB.exercises[0].exerciseId = routineA.exercises[0].exerciseId;
    routineB.exercises[0].note = 'Cue specifica del Giorno B';
    store.put(routineA);
    store.put(routineB);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();

  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /start full body a|inizia full body a/i }).click();
  await expect(page.locator('.workout-coach-note').first()).toBeHidden();
  await page
    .getByRole('button', { name: /^technique and notes|^tecnica e note/i })
    .first()
    .click();
  await expect(page.locator('.workout-coach-note').first()).toBeVisible();
  await expect(page.locator('.workout-coach-note').first()).toContainText(
    'Cue specifica del Giorno A',
  );
  await expect(page.getByText('Cue specifica del Giorno B')).toHaveCount(0);

  await page.getByText(/more .*actions|altre azioni/i).click();
  await page.getByRole('button', { name: /^(abandon|abbandona)$/i }).click();
  await page
    .getByRole('dialog', { name: /abandon this workout|abbandonare l'allenamento/i })
    .getByRole('button', { name: /^(abandon|abbandona)$/i })
    .click();
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /start full body b|inizia full body b/i }).click();
  await expect(page.locator('.workout-coach-note').first()).toBeHidden();
  await page
    .getByRole('button', { name: /^technique and notes|^tecnica e note/i })
    .first()
    .click();
  await expect(page.locator('.workout-coach-note').first()).toContainText(
    'Cue specifica del Giorno B',
  );
  await expect(page.getByText('Cue specifica del Giorno A')).toHaveCount(0);
});

export async function startNeutralWorkout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /start full body a|inizia full body a/i }).click();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
  const loads = page.getByRole('spinbutton', { name: /load|carico/i });
  for (let index = 0; index < (await loads.count()); index += 1) {
    const input = loads.nth(index);
    if ((await input.inputValue()) === '') await input.fill('0');
  }
}

export async function openNeutralRoutineEditor(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /edit full body a|modifica full body a/i }).click();
  await expect(page.locator('.route-fallback')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /routine name|nome scheda/i })).toBeVisible();
}

test('editing a uniform prescription replaces imported per-set targets cleanly', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction('routines', 'readwrite');
    const store = transaction.objectStore('routines');
    const routine = await new Promise<{
      exercises: Array<{
        sets: number;
        setTargets?: Array<{ repMin: number; repMax: number; startWeightKg: number }>;
      }>;
    }>((resolve, reject) => {
      const request = store.get('full-body-a');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    routine.exercises[0].sets = 3;
    routine.exercises[0].setTargets = [
      { repMin: 5, repMax: 5, startWeightKg: 80 },
      { repMin: 8, repMax: 10, startWeightKg: 70 },
      { repMin: 8, repMax: 10, startWeightKg: 70 },
    ];
    store.put(routine);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  await openNeutralRoutineEditor(page);
  await page
    .getByRole('spinbutton', { name: /working sets|serie di lavoro/i })
    .first()
    .fill('2');

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('overload');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        const routine = await new Promise<{
          exercises: Array<{ sets: number; setTargets?: unknown[] }>;
        }>((resolve, reject) => {
          const request = database
            .transaction('routines', 'readonly')
            .objectStore('routines')
            .get('full-body-a');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        database.close();
        return {
          sets: routine.exercises[0].sets,
          hasSetTargets: 'setTargets' in routine.exercises[0],
        };
      }),
    )
    .toEqual({ sets: 2, hasSetTargets: false });
});

export async function completeAndFinishOneSet(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^(set 1|serie 1)$/i })
    .first()
    .click();
  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();
}

async function setRoutineExerciseGoal(page: Page, exercise: Locator, goal: RegExp): Promise<void> {
  await exercise.getByRole('button', { name: /exercise options|opzioni esercizio/i }).click();
  await page
    .getByRole('dialog', { name: /exercise options|opzioni esercizio/i })
    .getByRole('button', { name: /goal type|tipo di obiettivo/i })
    .click();
  await page
    .getByRole('dialog', { name: /goal type|tipo di obiettivo/i })
    .getByRole('button')
    .filter({ has: page.getByText(goal) })
    .click();
}

async function applyRapidRoutineEdits(page: Page): Promise<void> {
  await setRoutineExerciseGoal(page, page.locator('.routine-exercise').first(), /^time$|^tempo$/i);
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
    if (!preparation) throw new Error('routine editor controls missing');
    setValue(preparation, '5 min easy bike');
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
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('.route-fallback')).toHaveCount(0);
}

type StoredWorkoutJournalFact = {
  id: string;
  startTs: number;
  squatNote: string | null;
};

async function finishWithSessionNote(page: Page, text: string): Promise<void> {
  await startNeutralWorkout(page);
  await page
    .getByRole('button', { name: /^technique and notes|^tecnica e note/i })
    .first()
    .click();
  await page
    .getByRole('button', { name: /^(edit note|modifica nota)$/i })
    .first()
    .click();
  await page.getByLabel(/^today's note|^nota di oggi/i).fill(text);
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

async function installCoreSurfaceFixture(page: Page): Promise<void> {
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
              .get('full-body-b');
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
      const fullBodyB = await new Promise<{
        id: string;
        name: string;
        folderId?: string;
        exercises: Array<Record<string, unknown>>;
        updatedAt: number;
      }>((resolve, reject) => {
        const request = database
          .transaction('routines', 'readonly')
          .objectStore('routines')
          .get('full-body-b');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const workingExerciseIds = [
        'Barbell_Squat',
        'Dumbbell_Bench_Press',
        'Seated_Cable_Rows',
        'Romanian_Deadlift',
        'Plank',
        'Face_Pull',
      ];
      const workingSets = (count: number) =>
        workingExerciseIds.slice(0, count).map((exerciseId) => ({
          exerciseId,
          weightKg: 20,
          reps: 5,
          done: true,
          kind: 'working',
        }));
      const records = [
        {
          id: 'truthful-august',
          routineId: 'full-body-a',
          dayLabel: 'Truthful August',
          date: '2026-08-24',
          startTs: Date.parse('2026-08-24T12:00:00Z'),
          endTs: Date.parse('2026-08-24T12:45:00Z'),
          sets: [
            {
              exerciseId: 'Barbell_Squat',
              weightKg: 20,
              reps: 5,
              done: true,
              kind: 'warmup',
            },
            {
              exerciseId: 'Barbell_Squat',
              weightKg: 50,
              reps: 5,
              done: true,
              kind: 'working',
            },
            {
              exerciseId: 'Dumbbell_Bench_Press',
              weightKg: 30,
              reps: 8,
              done: true,
              kind: 'working',
            },
            {
              exerciseId: 'Face_Pull',
              weightKg: 15,
              reps: 12,
              done: false,
              kind: 'working',
            },
          ],
          volumeKg: 127.5,
          updatedAt: Date.parse('2026-08-24T12:45:00Z'),
          source: 'app',
        },
        {
          id: 'five-july',
          routineId: 'full-body-a',
          dayLabel: 'Five exercises',
          date: '2026-07-14',
          startTs: Date.parse('2026-07-14T12:00:00Z'),
          endTs: Date.parse('2026-07-14T12:40:00Z'),
          sets: workingSets(5),
          volumeKg: 500,
          updatedAt: Date.parse('2026-07-14T12:40:00Z'),
          source: 'app',
        },
        {
          id: 'six-june',
          routineId: 'full-body-a',
          dayLabel: 'Six exercises',
          date: '2026-06-08',
          startTs: Date.parse('2026-06-08T12:00:00Z'),
          endTs: Date.parse('2026-06-08T12:35:00Z'),
          sets: workingSets(6),
          volumeKg: 600,
          updatedAt: Date.parse('2026-06-08T12:35:00Z'),
          source: 'app',
        },
      ];

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          ['folders', 'routines', 'settings', 'workouts'],
          'readwrite',
        );
        transaction.objectStore('settings').put({
          id: 'settings',
          locale: 'en',
          unit: 'kg',
          updatedAt: Date.now(),
        });
        transaction.objectStore('folders').put({
          id: 'solo-folder',
          name: 'Solo program',
          updatedAt: Date.now(),
        });
        transaction.objectStore('routines').put({
          ...fullBodyB,
          exercises: fullBodyB.exercises.slice(0, 1),
          updatedAt: Date.now(),
        });
        transaction.objectStore('routines').put({
          id: 'solo-routine',
          name: 'Solo routine',
          folderId: 'solo-folder',
          exercises: [
            {
              exerciseId: 'Barbell_Squat',
              sets: 3,
              repMin: 5,
              repMax: 8,
              restSec: 120,
            },
          ],
          updatedAt: Date.now(),
        });
        for (const record of records) transaction.objectStore('workouts').put(record);
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
    } finally {
      database.close();
    }
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function putStoredRow(page: Page, storeName: string, row: unknown): Promise<void> {
  await page.evaluate(
    async ({ name, value }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('overload');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(name, 'readwrite');
        transaction.objectStore(name).put(value);
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
      });
      database.close();
    },
    { name: storeName, value: row },
  );
}

const PROFILE_VOLUME_WORKOUT = {
  id: 'profile-volume',
  routineId: 'full-body-a',
  dayLabel: 'Full Body A',
  date: '2026-08-25',
  startTs: 100,
  endTs: 200,
  sets: [],
  volumeKg: 700,
  updatedAt: 200,
  source: 'app',
} satisfies Workout;

const COMPLETE_BACKUP = {
  version: 2,
  workouts: [PROFILE_VOLUME_WORKOUT],
  routines: [{ id: 'backup-routine', name: 'Imported routine', exercises: [], updatedAt: 1 }],
  folders: [{ id: 'backup-folder', name: 'Imported program', updatedAt: 1 }],
  notes: [{ id: 'Barbell_Squat', entries: [], updatedAt: 1 }],
  measurements: [
    { id: 'backup-measurement', date: '2026-08-24', metric: 'weight', value: 82, updatedAt: 1 },
  ],
  nutrition: [{ id: '2026-08-24', date: '2026-08-24', kcal: 2200, proteinG: 160, updatedAt: 1 }],
  customExercises: [
    { id: 'custom:backup-carry', name: 'Suitcase carry', muscleGroup: 'full body', updatedAt: 1 },
  ],
  settings: { id: 'settings', locale: 'en', unit: 'kg', updatedAt: 1 },
} satisfies BackupV2;

const LEGACY_BACKUP = {
  version: 1,
  workouts: [{ ...PROFILE_VOLUME_WORKOUT, id: 'legacy-workout' }],
  routines: [
    {
      id: 'legacy-routine',
      name: 'Legacy routine',
      exercises: [],
      updatedAt: 1,
    },
  ],
  settings: { id: 'settings', locale: 'en', unit: 'kg', updatedAt: 1 },
} satisfies BackupV1;

async function installProfileSurfaceFixture(page: Page, locale: 'it' | 'en' = 'en'): Promise<void> {
  await putStoredRow(page, 'settings', {
    id: 'settings',
    locale,
    unit: 'kg',
    updatedAt: 300,
  });
  await putStoredRow(page, 'workouts', PROFILE_VOLUME_WORKOUT);
  await page.reload();
}

async function openImportSurface(page: Page, locale: 'it' | 'en' = 'en'): Promise<void> {
  await installProfileSurfaceFixture(page, locale);
  await page.getByRole('button', { name: locale === 'it' ? 'Profilo' : 'Profile' }).click();
  await page
    .getByRole('button', { name: locale === 'it' ? 'Importa o ripristina' : 'Import or restore' })
    .click();
  await expect(page.locator('.route-fallback')).toHaveCount(0);
  await expect(page.getByLabel(locale === 'it' ? 'Scegli un file' : 'Choose a file')).toBeVisible();
}

async function uploadImportFixture(page: Page, name: string, contents: string): Promise<void> {
  await page.locator('input[type="file"]').evaluate(
    (input, file) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([file.contents], file.name, {
          type: file.name.endsWith('.csv') ? 'text/csv' : 'application/json',
        }),
      );
      (input as HTMLInputElement).files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { name, contents },
  );
}

async function installProgressSurfaceFixture(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('overload');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const set = (
      exerciseId: string,
      weightKg: number,
      reps: number,
      extra: Record<string, unknown> = {},
    ) => ({ exerciseId, weightKg, reps, done: true, kind: 'working', ...extra });
    const workout = (
      id: string,
      date: string,
      startTs: number,
      sets: Record<string, unknown>[],
      volumeKg = 0,
    ) => ({ id, date, startTs, sets, volumeKg });
    const workouts = [
      workout(
        'm-old',
        '2026-08-18',
        100,
        [
          set('Barbell_Squat', 250, 1, { kind: 'warmup', isPr: true }),
          set('Barbell_Squat', 50, 5),
          set('Hanging_Leg_Raise', 0, 40, { kind: 'warmup', tracking: 'reps' }),
          set('Hanging_Leg_Raise', 0, 10, { tracking: 'reps' }),
          set('Plank', 300, 1),
        ],
        127.5,
      ),
      workout(
        'z-early',
        '2026-08-25',
        100,
        [
          set('Barbell_Squat', 60, 4, { isPr: true }),
          set('Barbell_Squat', 200, 20, { done: false }),
          set('Hanging_Leg_Raise', 0, 14, { tracking: 'reps' }),
          set('Plank', 0, 0, { durationSec: 35, tracking: 'duration' }),
        ],
        300,
      ),
      workout('a-late', '2026-08-25', 300, [
        set('Barbell_Squat', 55, 8, { isPr: true }),
        set('Plank', 0, 0, { durationSec: 45, tracking: 'duration' }),
      ]),
    ];
    const measurements = [
      { id: 'weight-old', date: '2026-08-24', metric: 'weight', value: 90, updatedAt: 100 },
      { id: 'weight-new', date: '2026-08-25', metric: 'weight', value: 100, updatedAt: 200 },
      { id: 'waist-one', date: '2026-08-25', metric: 'waist', value: 82, updatedAt: 200 },
    ];

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        ['settings', 'workouts', 'measurements', 'nutrition'],
        'readwrite',
      );
      transaction
        .objectStore('settings')
        .put({ id: 'settings', locale: 'en', unit: 'lb', updatedAt: Date.now() });
      for (const name of ['workouts', 'measurements', 'nutrition'])
        transaction.objectStore(name).clear();
      for (const row of workouts) transaction.objectStore('workouts').put(row);
      for (const row of measurements) transaction.objectStore('measurements').put(row);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
    database.close();
  });
  await page.reload();
}

async function expectNarrowTouchTargets(page: Page, controls: Locator): Promise<void> {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const rects = await controls.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expectAtLeast44PxGeometry(rect.width);
      expectAtLeast44PxGeometry(rect.height);
    }
  }
}

async function expectLightAndDarkSurfaces(
  page: Page,
  surface: Locator,
  control: Locator,
): Promise<void> {
  const appearance = (locator: Locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      const contrast = (foreground: string, background: string) => {
        const luminance = (value: string) => {
          const channels = value
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((channel) => {
              const normalized = channel / 255;
              return normalized <= 0.04045
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
            });
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      return {
        background: style.backgroundColor,
        border: style.borderTopColor,
        color: style.color,
        contrast: contrast(style.color, style.backgroundColor),
      };
    });
  const themes = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.evaluate(async () => {
      for (const animation of document.getAnimations()) animation.finish();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      for (const animation of document.getAnimations()) animation.finish();
    });
    themes.push({ surface: await appearance(surface), control: await appearance(control) });
  }
  for (const layer of ['surface', 'control'] as const) {
    expect(themes[0][layer].background, JSON.stringify({ layer, themes })).not.toBe(
      themes[1][layer].background,
    );
    expect(themes[0][layer].border).not.toBe(themes[1][layer].border);
    expect(themes[0][layer].color).not.toBe(themes[1][layer].color);
    expect(themes[0][layer].contrast).toBeGreaterThanOrEqual(4.5);
    expect(themes[1][layer].contrast).toBeGreaterThanOrEqual(4.5);
  }
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

test('app shell exposes landmarks and skip navigation', async ({ page }) => {
  await page.reload();

  const main = page.getByRole('main');
  await expect(main).toHaveCount(1);

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', {
    name: /skip to content|vai al contenuto/i,
  });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(main).toBeFocused();
  expect(
    await main.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2;
    }),
  ).toBe(true);
});

test('browser chrome theme follows the app surface in light and dark modes', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    expect(
      await page.evaluate(() => {
        const theme = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
          .find((meta) => !meta.media || matchMedia(meta.media).matches)
          ?.content.toLowerCase();
        const surface = getComputedStyle(document.documentElement)
          .getPropertyValue('--bg')
          .trim()
          .toLowerCase();
        return { surface, theme };
      }),
    ).toEqual({
      surface: colorScheme === 'light' ? '#f2f3f0' : '#0c0e10',
      theme: colorScheme === 'light' ? '#f2f3f0' : '#0c0e10',
    });
  }
});

test('document language starts in Italian and follows the selected locale', async ({
  page,
  request,
}) => {
  const response = await request.get('/');
  expect(await response.text()).toContain('<html lang="it">');

  await setStoredLocale(page, 'it');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');

  await page.getByRole('button', { name: 'Profilo' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('login keeps one heading and its primary action inside narrow viewports', async ({ page }) => {
  await page.evaluate(async () => {
    const modulePath = '/src/state/useStore.ts';
    const storeModule = (await import(modulePath)) as {
      useStore: { getState(): { setUser(user: null): void } };
    };
    storeModule.useStore.getState().setUser(null);
  });

  const main = page.getByRole('main');
  const signIn = main.getByRole('button', {
    name: /continue with google|continua con google/i,
  });
  await expect(signIn).toBeVisible();
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByText(/tell me|dimmelo|cache|service worker/i)).toHaveCount(0);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    const fit = await signIn.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        right: box.right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        rootWidth: document.documentElement.scrollWidth,
      };
    });
    expect(fit.right).toBeLessThanOrEqual(width);
    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth);
    expect(fit.rootWidth).toBe(width);
  }
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

test('route motion keeps its hierarchy and clears deterministic metadata', async ({ page }) => {
  await page.getByRole('button', { name: /progress|progressi/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-route-motion', 'peer');
  await expect(page.locator('html')).not.toHaveAttribute('data-route-motion', { timeout: 600 });
});

test('exercise navigation never fades the whole screen', async ({ page }) => {
  await page.getByRole('button', { name: /exercises|esercizi/i }).click();
  await page.waitForTimeout(320);
  await page.locator('.library-result').first().click();
  await page.waitForTimeout(40);
  const detailOpacity = await page
    .locator('.exercise-detail')
    .evaluate((screen) => Number(getComputedStyle(screen).opacity));

  await page.goBack();
  await page.waitForTimeout(40);
  const libraryOpacity = await page
    .locator('.library-screen')
    .evaluate((screen) => Number(getComputedStyle(screen).opacity));

  expect({ detailOpacity, libraryOpacity }).toEqual({ detailOpacity: 1, libraryOpacity: 1 });
});

test('route transition never restarts with a vertical entrance', async ({ page }) => {
  await page.getByRole('button', { name: /exercises|esercizi/i }).click();
  await page.waitForTimeout(320);
  await startRouteFrameTrace(page);
  await page.locator('.library-result').first().click();
  await page.waitForTimeout(450);
  const trace = await stopRouteFrameTrace(page);

  expect(trace.some((frame) => frame.animation === 'route-forward-in')).toBe(true);
  expect(Math.max(...trace.map((frame) => Math.abs(frame.translateY)))).toBe(0);

  await startRouteFrameTrace(page);
  await page.goBack();
  await page.waitForTimeout(450);
  const backTrace = await stopRouteFrameTrace(page);

  expect(backTrace.some((frame) => frame.animation === 'route-back-in')).toBe(true);
  expect(Math.max(...backTrace.map((frame) => Math.abs(frame.translateY)))).toBe(0);
});

test('route reaches its target scroll before the first painted frame in both directions', async ({
  page,
}) => {
  await page.getByRole('button', { name: /exercises|esercizi/i }).click();
  await page.waitForTimeout(320);
  await page.locator('.library-result').nth(20).scrollIntoViewIfNeeded();
  await startRouteFrameTrace(page);
  await page.locator('.library-result').nth(20).click();
  await page.waitForTimeout(240);
  const detailScroll = (await stopRouteFrameTrace(page))
    .filter((frame) => frame.view === 'exercise')
    .map((frame) => frame.scrollY);

  expect(detailScroll.length).toBeGreaterThan(0);
  expect(detailScroll).toEqual(detailScroll.map(() => 0));

  await page.evaluate(() => window.scrollTo(0, Math.min(240, document.body.scrollHeight)));
  await startRouteFrameTrace(page);
  await page.goBack();
  await page.waitForTimeout(240);
  const restoredScroll = (await stopRouteFrameTrace(page))
    .filter((frame) => frame.view === 'library')
    .map((frame) => frame.scrollY);

  expect(restoredScroll.length).toBeGreaterThan(0);
  expect(restoredScroll[0]).toBeGreaterThan(0);
  expect(new Set(restoredScroll).size).toBe(1);
});

test('every page navigation keeps one opaque final surface', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => {
    const visual = { fallbackSeen: false, minOpacity: 1, maxOverflow: 0, active: true };
    const observer = new MutationObserver(() => {
      if (document.querySelector('.route-fallback')) visual.fallbackSeen = true;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const sample = () => {
      const screen = document.querySelector<HTMLElement>('.screen');
      if (screen) {
        visual.minOpacity = Math.min(
          visual.minOpacity,
          Number(getComputedStyle(screen).opacity),
        );
      }
      visual.maxOverflow = Math.max(
        visual.maxOverflow,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (visual.active) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    Object.assign(window, { __routeVisual: visual, __routeVisualObserver: observer });
  });

  for (const destination of [
    /train|allenati/i,
    /progress|progressi/i,
    /profile|profilo/i,
    /exercises|esercizi/i,
  ]) {
    await page.getByRole('button', { name: destination }).click();
    await page.waitForTimeout(80);
  }
  await page.locator('.library-result').first().click();
  await expect(page.locator('.exercise-detail')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.library-screen')).toBeVisible();
  await page.waitForTimeout(220);

  const visual = await page.evaluate(() => {
    const state = (
      window as unknown as {
        __routeVisual: {
          fallbackSeen: boolean;
          minOpacity: number;
          maxOverflow: number;
          active: boolean;
        };
        __routeVisualObserver: MutationObserver;
      }
    );
    state.__routeVisual.active = false;
    state.__routeVisualObserver.disconnect();
    return state.__routeVisual;
  });
  expect(visual).toMatchObject({ fallbackSeen: false, minOpacity: 1, maxOverflow: 0 });
});

test('rapid navigation interrupts motion without an unhandled rejection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.getByRole('button', { name: /exercises|esercizi/i }).click();
  await page.getByRole('button', { name: /progress|progressi/i }).click();
  await page.waitForTimeout(350);

  expect(errors).toEqual([]);
});

test('Home week navigator browses earlier progress and opens a completed day', async ({ page }) => {
  await installCoreSurfaceFixture(page);
  await page.getByRole('button', { name: /^home$/i }).click();

  await page.getByRole('button', { name: /2026-08-24.*trained|2026-08-24.*allenato/i }).click();
  await expect(page.getByRole('heading', { name: /truthful august/i })).toBeVisible();
  await page.goBack();
  await page.waitForTimeout(400);

  const overview = page.locator('.home-period-overview');
  const pager = page.locator('.home-period-pager');
  const metrics = page.locator('.week-metrics');
  const chart = page.locator('.line-chart');
  const metricsBefore = await metrics.boundingBox();
  const chartBefore = await chart.boundingBox();
  await pager.dispatchEvent('pointerdown', { clientX: 80, pointerId: 1 });
  await pager.dispatchEvent('pointermove', { clientX: 150, pointerId: 1 });
  await expect
    .poll(() =>
      pager
        .locator('.home-period-pager__page')
        .evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41),
    )
    .toBeGreaterThan(50);
  const metricsDuring = await metrics.boundingBox();
  const chartDuring = await chart.boundingBox();
  expect(Math.abs((metricsDuring?.x ?? 0) - (metricsBefore?.x ?? 0))).toBeLessThan(0.5);
  expect(Math.abs((metricsDuring?.y ?? 0) - (metricsBefore?.y ?? 0))).toBeLessThan(0.5);
  expect(Math.abs((chartDuring?.x ?? 0) - (chartBefore?.x ?? 0))).toBeLessThan(0.5);
  expect(Math.abs((chartDuring?.y ?? 0) - (chartBefore?.y ?? 0))).toBeLessThan(0.5);
  await pager.dispatchEvent('pointerup', { clientX: 240, pointerId: 1 });
  await expect(page.getByText(/17.*23.*aug|17.*23.*ago/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /today|oggi/i })).toBeVisible();
  await expect(page.locator('.home-week-comparison')).toHaveCount(0);
  await expect(page.locator('.week-metric__delta')).toHaveCount(4);
  await page.getByRole('button', { name: /today|oggi/i }).click();
  await expect(page.getByRole('button', { name: /today|oggi/i })).toHaveCount(0);
  await expect(overview.locator('.home-period-content')).toHaveAttribute('data-motion', 'today');
});

test('Home switches training periods and swipes the overview to an earlier period', async ({
  page,
}) => {
  await installCoreSurfaceFixture(page);
  await page.getByRole('button', { name: /^home$/i }).click();

  const periods = page.getByRole('tablist', { name: /training period|periodo di allenamento/i });
  await periods.getByRole('tab', { name: /month|mese/i }).click();
  const overview = page.locator('.home-period-overview');
  await expect(
    overview.getByRole('button', { name: /previous|next|precedente|successiv/i }),
  ).toHaveCount(0);
  const label = page.locator('.home-period-label');
  const currentLabel = await label.textContent();

  const monthPager = page.locator('.home-period-pager');
  await monthPager.dispatchEvent('pointerdown', { clientX: 80, pointerId: 1 });
  await monthPager.dispatchEvent('pointerup', { clientX: 240, pointerId: 1 });

  await expect(label).not.toHaveText(currentLabel ?? '');
  await overview.focus();
  const swipedLabel = await label.textContent();
  await page.keyboard.press('ArrowRight');
  await expect(label).not.toHaveText(swipedLabel ?? '');
  await expect(overview.getByRole('button', { name: /duration|durata/i })).toBeVisible();
  await periods.getByRole('tab', { name: /year|anno/i }).click();
  await expect(page.locator('.home-year-pager')).toContainText('2026');
  await expect(page.locator('.line-chart')).toBeVisible();
});

test('back restores the exact Home month after opening an old workout', async ({ page }) => {
  await installCoreSurfaceFixture(page);
  await page.getByRole('button', { name: /^home$/i }).click();

  const periods = page.getByRole('tablist', { name: /training period|periodo di allenamento/i });
  const monthTab = periods.getByRole('tab', { name: /month|mese/i });
  await monthTab.click();
  const pager = page.locator('.home-period-pager');
  await pager.dispatchEvent('pointerdown', { clientX: 80, pointerId: 1 });
  await pager.dispatchEvent('pointerup', { clientX: 240, pointerId: 1 });
  const oldMonth = await page.locator('.home-period-label').textContent();
  await expect(page.getByRole('button', { name: /five exercises/i })).toBeVisible();

  await page.getByRole('button', { name: /five exercises/i }).click();
  await expect(page.getByRole('heading', { name: /five exercises/i })).toBeVisible();
  await page.goBack();

  await expect(monthTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.home-period-label')).toHaveText(oldMonth ?? '');
  await expect(page.getByRole('button', { name: /five exercises/i })).toBeVisible();
});

test('Home stops at the first meaningful workout period', async ({ page }) => {
  await installCoreSurfaceFixture(page);
  await page.getByRole('button', { name: /^home$/i }).click();
  await page
    .getByRole('tablist', { name: /training period|periodo di allenamento/i })
    .getByRole('tab', { name: /month|mese/i })
    .click();

  const overview = page.locator('.home-period-overview');
  await overview.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const earliestLabel = await page.locator('.home-period-label').textContent();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.home-period-label')).toHaveText(earliestLabel ?? '');

  const pager = page.locator('.home-period-pager');
  await pager.dispatchEvent('pointerdown', { clientX: 40, pointerId: 2 });
  await pager.dispatchEvent('pointermove', { clientX: 240, pointerId: 2 });
  await expect
    .poll(() =>
      pager
        .locator('.home-period-pager__page')
        .evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41),
    )
    .toBeLessThan(80);
  await pager.dispatchEvent('pointerup', { clientX: 240, pointerId: 2 });
  await expect(page.locator('.home-period-label')).toHaveText(earliestLabel ?? '');
});

test('Home compacts extreme metrics and keeps the chart inside a narrow viewport', async ({
  page,
}) => {
  await installCoreSurfaceFixture(page);
  await putStoredRow(page, 'workouts', {
    id: 'extreme-volume',
    routineId: 'full-body-a',
    dayLabel: 'Extreme volume',
    date: '2026-08-26',
    startTs: Date.parse('2026-08-26T12:00:00Z'),
    endTs: Date.parse('2026-08-26T13:00:00Z'),
    sets: [
      {
        exerciseId: 'Barbell_Squat',
        weightKg: 100_000,
        reps: 1_000,
        done: true,
        kind: 'working',
      },
    ],
    volumeKg: 100_000_000,
    updatedAt: Date.parse('2026-08-26T13:00:00Z'),
    source: 'app',
  });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload();
  await page.getByRole('button', { name: /^home$/i }).click();

  const volume = page.locator('.week-metric--volume strong');
  await expect(volume).toContainText(/100M kg/i);
  await expect(volume).toHaveAttribute('aria-label', /100[.,\s]000[.,\s]\d{3} kg/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const chart = await page.locator('.line-chart').boundingBox();
  expect(chart?.x).toBeGreaterThanOrEqual(0);
  expect((chart?.x ?? 0) + (chart?.width ?? 0)).toBeLessThanOrEqual(320);
  await expect(page.getByRole('button', { name: /extreme volume/i })).toContainText(/100M kg/i);
});

test('history groups truthful completed working activity by month', async ({ page }) => {
  await installCoreSurfaceFixture(page);
  await page.getByRole('button', { name: /^home$/i }).click();
  await page.getByRole('button', { name: /all history/i }).click();

  const august = page.getByRole('region', { name: /august 2026/i });
  const july = page.getByRole('region', { name: /july 2026/i });
  const june = page.getByRole('region', { name: /june 2026/i });
  await expect(august.getByRole('heading', { name: /august 2026/i })).toBeVisible();
  await expect(july.getByRole('heading', { name: /july 2026/i })).toBeVisible();
  await expect(june.getByRole('heading', { name: /june 2026/i })).toBeVisible();

  const augustWorkout = august.getByRole('button', { name: /truthful august/i });
  await expect(augustWorkout).toContainText('2 working sets');
  await expect(augustWorkout).toContainText('128 kg');
  await expect(augustWorkout).toContainText('1 × Barbell Squat');
  await expect(augustWorkout).toContainText('1 × Dumbbell Bench Press');
  await expect(augustWorkout).not.toContainText('Face Pull');
  expect((await augustWorkout.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await expect(july.getByRole('button', { name: /five exercises/i })).toContainText(
    '+ 1 more exercise',
  );
  await expect(june.getByRole('button', { name: /six exercises/i })).toContainText(
    '+ 2 more exercises',
  );
  await expect(page.getByRole('heading', { level: 3 }).allTextContents()).resolves.toEqual([
    'August 2026',
    'July 2026',
    'June 2026',
  ]);

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('overload');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        try {
          const workout = await new Promise<{ volumeKg: number }>((resolve, reject) => {
            const request = database
              .transaction('workouts', 'readonly')
              .objectStore('workouts')
              .get('truthful-august');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });
          return workout.volumeKg;
        } finally {
          database.close();
        }
      }),
    )
    .toBe(127.5);
});

test('home and Train keep active priority, exact counts and narrow CTA fit', async ({ page }) => {
  await installCoreSurfaceFixture(page);
  await page.getByRole('button', { name: /^train$/i }).click();
  await expect(page.getByText(/^1 routine$/i)).toBeVisible();
  await expect(page.getByText(/^2 routines$/i)).toBeVisible();
  await page.getByRole('button', { name: /solo program.*1 routine/i }).click();
  await expect(
    page.getByRole('button', { name: /edit solo routine/i }).getByText(/^1 exercise$/i),
  ).toBeVisible();

  await page.getByRole('button', { name: /full body a\/b.*2 routines/i }).click();
  await page.getByRole('button', { name: /start full body a/i }).click();
  await page.getByRole('button', { name: /minimize/i }).click();
  await page.getByRole('button', { name: /^home$/i }).click();

  const main = page.getByRole('main');
  const upNext = main.getByRole('region', { name: /next workout/i });
  const inlineResume = main
    .getByRole('region', { name: /resume workout in progress|riprendi l'allenamento in corso/i })
    .getByRole('button', { name: /^(resume|riprendi)$/i });
  await expect(page.getByRole('button', { name: /(resume|riprendi)$/i })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^(start|inizia)$/i })).toHaveCount(0);
  await expect(inlineResume).toBeVisible();
  await expect(upNext).toContainText('Full Body B');
  await expect(upNext).toContainText('1 exercise');
  await expect(upNext.getByRole('button')).toHaveCount(0);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    const fit = await inlineResume.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        right: box.right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        rootWidth: document.documentElement.scrollWidth,
      };
    });
    expect(fit.right).toBeLessThanOrEqual(width);
    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth);
    expect(fit.rootWidth).toBe(width);
  }
});

test('routine preparation and exercise settings remain editable', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  await expect(page.locator('.routine-editor-header .page-header__title')).toContainText(
    NEUTRAL_ROUTINE,
  );
  await page.getByRole('textbox', { name: /warm-up|riscaldamento/i }).fill('5 min easy bike');
  await setRoutineExerciseGoal(page, page.locator('.routine-exercise').first(), /^time$|^tempo$/i);
  await page
    .locator('.routine-exercise')
    .first()
    .locator('summary')
    .filter({ hasText: /warm-up sets|serie di riscaldamento/i })
    .click();
  await page
    .getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i })
    .first()
    .click();
  await page
    .locator('.routine-exercise')
    .first()
    .locator('summary')
    .filter({ hasText: /routine technique|tecnica della scheda/i })
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
  await expect(page.getByLabel(/seconds|secondi/i).first()).toHaveValue('6');
  await expect(page.getByLabel(/technique|tecnica/i).first()).toHaveValue(
    'Brace before the timer starts',
  );
  const firstExercise = page
    .locator('.routine-exercise')
    .filter({ hasText: /barbell squat|squat con bilanciere/i })
    .first();
  await setRoutineExerciseGoal(page, firstExercise, /^reps only$|^solo ripetizioni$/i);
  await expect(firstExercise.getByLabel(/load|carico/i)).toHaveCount(0);
  await expect(firstExercise.getByLabel(/seconds|secondi/i)).toHaveCount(0);
  await firstExercise
    .getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i })
    .click();
  await firstExercise
    .getByLabel(/^reps$|^ripetizioni$/i)
    .last()
    .fill('9');
  await setRoutineExerciseGoal(page, firstExercise, /^time$|^tempo$/i);
  await expect(firstExercise.getByLabel(/seconds|secondi/i).first()).toHaveValue('6');
  await setRoutineExerciseGoal(page, firstExercise, /^reps only$|^solo ripetizioni$/i);
  await expect(firstExercise.getByLabel(/^reps$|^ripetizioni$/i).last()).toHaveValue('9');
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByLabel(/working sets|serie di lavoro/i).first()).toHaveJSProperty(
    'offsetHeight',
    44,
  );
  await expect(firstExercise.locator('.routine-exercise__summary')).toHaveJSProperty(
    'offsetHeight',
    56,
  );
});

test('long routine notes expand to keep all text visible while editing', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  const longNote = [
    'Set the bench one notch below upright.',
    'Keep the shoulder blades down and back.',
    'Pause briefly in the stretched position.',
    'Drive without losing contact with the pad.',
    'Stop the set if the shoulder rolls forward.',
  ].join('\n');
  const expectExpansion = async (field: Locator) => {
    const start = await field.evaluate((element) => element.clientHeight);
    await field.fill(longNote);
    await expect
      .poll(() => field.evaluate((element) => element.clientHeight))
      .toBeGreaterThan(start);
    const fullyVisible = await field.evaluate(
      (element) => element.scrollHeight <= element.clientHeight + 1,
    );
    expect(fullyVisible).toBe(true);
  };

  const preparation = page.getByRole('textbox', { name: /warm-up|riscaldamento/i });
  await expectExpansion(preparation);

  await page
    .locator('.routine-exercise')
    .first()
    .locator('summary')
    .filter({ hasText: /routine technique|tecnica della scheda/i })
    .click();
  const technique = page.getByLabel(/technique|tecnica/i).first();
  await expectExpansion(technique);
});

test('routine editor keeps one compact exercise open and hides tracking jargon', async ({
  page,
}) => {
  await openNeutralRoutineEditor(page);

  const exercises = page.locator('.routine-exercise');
  await expect(exercises).toHaveCount(6);
  await expect(exercises.nth(0).locator('.routine-exercise__summary')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(exercises.nth(1).locator('.routine-exercise__summary')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByText(/tracking|tracciamento/i)).toHaveCount(0);

  await exercises.nth(1).locator('.routine-exercise__summary').click();
  await expect(exercises.nth(0).getByLabel(/working sets|serie di lavoro/i)).toHaveCount(0);
  await expect(exercises.nth(1).getByLabel(/working sets|serie di lavoro/i)).toBeVisible();
});

test('routine editor keeps the primary prescription on one dense row', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const exercise = page.locator('.routine-exercise').first();
  const primary = exercise.locator('.routine-prescription-primary');
  await expect(primary).toBeVisible();
  const geometry = await primary.evaluate((row) => {
    const controls = [...row.querySelectorAll<HTMLElement>('input, select')];
    return {
      height: row.getBoundingClientRect().height,
      tops: controls.map((control) => Math.round(control.getBoundingClientRect().top)),
    };
  });
  expect(geometry.height).toBeLessThanOrEqual(78);
  expect(new Set(geometry.tops).size).toBe(1);

  const progression = exercise.locator('.routine-progression');
  await expect(progression).not.toHaveAttribute('open', '');
  await expect(exercise.getByLabel(/start weight|peso iniziale/i)).toBeHidden();
  await progression.locator('summary').click();
  await expect(exercise.getByLabel(/start weight|peso iniziale/i)).toBeVisible();
});

test('routine editor moves goal type and reorder fallbacks into exercise options', async ({
  page,
}) => {
  await openNeutralRoutineEditor(page);
  const exercises = page.locator('.routine-exercise');
  const firstName = await exercises.nth(0).locator('.routine-exercise__name').innerText();
  const secondName = await exercises.nth(1).locator('.routine-exercise__name').innerText();

  await exercises
    .nth(0)
    .getByRole('button', { name: /exercise options|opzioni esercizio/i })
    .click();
  const options = page.getByRole('dialog', { name: /exercise options|opzioni esercizio/i });
  await expect(options.getByRole('button', { name: /goal type|tipo di obiettivo/i })).toBeVisible();
  await options.getByRole('button', { name: /move down|sposta giù/i }).click();
  await expect(exercises.nth(0).locator('.routine-exercise__name')).toHaveText(secondName);
  await expect(exercises.nth(1).locator('.routine-exercise__name')).toHaveText(firstName);

  await exercises
    .nth(0)
    .getByRole('button', { name: /exercise options|opzioni esercizio/i })
    .click();
  await options.getByRole('button', { name: /goal type|tipo di obiettivo/i }).click();
  const goalType = page.getByRole('dialog', { name: /goal type|tipo di obiettivo/i });
  await expect(goalType.getByText(/weight and reps|carico e ripetizioni/i)).toBeVisible();
  await goalType.getByRole('button', { name: /time|tempo/i }).click();
  await expect(
    exercises
      .nth(0)
      .getByLabel(/seconds|secondi/i)
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/tracking|tracciamento/i)).toHaveCount(0);
});

test('routine editor reorders exercises by dragging the familiar grip', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  const exercises = page.locator('.routine-exercise');
  const firstName = await exercises.nth(0).locator('.routine-exercise__name').innerText();
  const secondName = await exercises.nth(1).locator('.routine-exercise__name').innerText();
  await exercises.nth(0).locator('.routine-exercise__summary').click();

  const firstGrip = exercises.nth(0).getByRole('button', { name: /reorder|riordina/i });
  const secondGrip = exercises.nth(1).getByRole('button', { name: /reorder|riordina/i });
  const from = await firstGrip.boundingBox();
  const to = await secondGrip.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(exercises.nth(0).locator('.routine-exercise__name')).toHaveText(secondName);
  await expect(exercises.nth(1).locator('.routine-exercise__name')).toHaveText(firstName);
  await page.getByRole('button', { name: /back|indietro/i }).click();
  await openNeutralRoutineEditor(page);
  await expect(exercises.nth(0).locator('.routine-exercise__name')).toHaveText(secondName);
});

test('routine editor formats journal dates and keeps labels readable on narrow screens', async ({
  page,
}) => {
  await installCompletedWorkoutFixture(page);
  await openNeutralRoutineEditor(page);

  await expect(page.locator('.routine-journal-link')).toContainText(/23 Aug · Legacy import/i);
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const labelSizes = await page
      .locator('.routine-exercise__body label > span.mono.muted')
      .evaluateAll((labels) =>
        labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize)),
      );
    expect(labelSizes.length).toBeGreaterThan(0);
    expect(
      labelSizes.every((fontSize) => fontSize >= 12),
      JSON.stringify(labelSizes),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
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
  await expect(page.getByText(/tracking|tracciamento/i)).toHaveCount(0);
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
    .locator('.routine-exercise')
    .filter({ hasText: /barbell squat|squat con bilanciere/i })
    .first();
  await firstExercise.locator('.routine-progression > summary').click();
  await firstExercise.getByLabel(/start weight|peso iniziale/i).fill('220.5');
  await firstExercise.getByLabel(/progression|progressione/i).fill('');
  await firstExercise.getByLabel(/^max$/i).fill('');
  await firstExercise
    .locator('summary')
    .filter({ hasText: /warm-up sets|serie di riscaldamento/i })
    .click();
  await firstExercise
    .getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i })
    .first()
    .click();
  await firstExercise.getByLabel(/load|carico/i).fill('110.2');
  await firstExercise.getByLabel(/^reps$|^ripetizioni$/i).fill('8');
  await firstExercise
    .getByRole('button', { name: /remove warm-up set|rimuovi serie di riscaldamento/i })
    .click();
  await page
    .getByRole('dialog', { name: /remove this warm-up set|rimuovere questa serie/i })
    .getByRole('button', { name: /^(remove|rimuovi)$/i })
    .click();
  await expect(firstExercise.getByLabel(/load|carico/i)).toHaveCount(0);
  await firstExercise
    .locator('summary')
    .filter({ hasText: /warm-up sets|serie di riscaldamento/i })
    .click();
  await firstExercise
    .getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i })
    .first()
    .click();
  await firstExercise.getByLabel(/load|carico/i).fill('110.2');
  await firstExercise.getByLabel(/^reps$|^ripetizioni$/i).fill('8');
  await page.getByRole('button', { name: /back|indietro/i }).click();
  await openNeutralRoutineEditor(page);
  const reopenedFirstExercise = page
    .locator('.routine-exercise')
    .filter({ hasText: /barbell squat|squat con bilanciere/i })
    .first();
  await reopenedFirstExercise.locator('.routine-progression > summary').click();
  await expect(reopenedFirstExercise.getByLabel(/start weight|peso iniziale/i)).toHaveValue(
    '220.5',
  );
  await expect(reopenedFirstExercise.getByLabel(/progression|progressione/i)).toHaveValue('');
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
  await expect(finish).toHaveText(/^(Finish|Termina)$/);
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

test('active workout keeps exercise context compact before the set table', async ({ page }) => {
  await startNeutralWorkout(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const header = page.locator('.exercise-block__header').first();
  const height = await header.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(160);
  await expect(header.locator('.workout-note__trigger')).toHaveAttribute('aria-expanded', 'false');
});

test('active workout preserves a typed set until one confirmed keyboard removal', async ({
  page,
}) => {
  await startNeutralWorkout(page);
  const exercise = page.locator('.exercise-block').first();
  const rows = exercise.locator('.set-row');
  const initialCount = await rows.count();
  const lastLoad = exercise.getByLabel(new RegExp(`set ${initialCount} load`, 'i'));
  const lastReps = exercise.getByLabel(new RegExp(`set ${initialCount} reps`, 'i'));
  await lastLoad.fill('77.5');
  await lastReps.fill('9');

  const trigger = exercise.getByRole('button', { name: /remove last set/i });
  await trigger.focus();
  await page.keyboard.press('Enter');
  let dialog = page.getByRole('dialog', {
    name: new RegExp(`remove set ${initialCount} from barbell squat`, 'i'),
  });
  const cancel = dialog.getByRole('button', { name: /^cancel$/i });
  await expect(cancel).toBeFocused();
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await dialog.locator('.sheet').boundingBox();
    expect(bounds).not.toBeNull();
    expect((bounds?.x ?? viewport.width) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
      viewport.width,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
  await cancel.click();
  await expect(trigger).toBeFocused();
  await expect(rows).toHaveCount(initialCount);
  await expect(lastLoad).toHaveValue('77.5');
  await expect(lastReps).toHaveValue('9');

  await trigger.focus();
  await page.keyboard.press('Enter');
  dialog = page.getByRole('dialog', {
    name: new RegExp(`remove set ${initialCount} from barbell squat`, 'i'),
  });
  await dialog.getByRole('button', { name: /remove last set/i }).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('remove-set button missing');
    button.click();
    button.click();
  });
  await expect(dialog).toHaveCount(0);
  await expect(rows).toHaveCount(initialCount - 1);
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('overload_active') ?? 'null').ex[0].sets.length,
      ),
    )
    .toBe(initialCount - 1);

  const addSet = exercise.getByRole('button', { name: /^\+ set$/i });
  await trigger.click();
  dialog = page.getByRole('dialog', {
    name: new RegExp(`remove set ${initialCount - 1} from barbell squat`, 'i'),
  });
  await dialog.getByRole('button', { name: /remove last set/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rows).toHaveCount(1);
  await expect(addSet).toBeFocused();
});

test('rest controls keep a stable 44px target on narrow workouts', async ({ page }) => {
  await startNeutralWorkout(page);
  const restControls = page.locator('.exercise-block__rest');

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await restControls.evaluateAll((controls) =>
      controls.map((control) => {
        const rect = control.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
    expect(geometry.length).toBeGreaterThan(0);
    for (const { width, height } of geometry) {
      expectAtLeast44PxGeometry(width);
      expectAtLeast44PxGeometry(height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);

    const first = restControls.first();
    const readSize = () =>
      first.evaluate((control) => {
        const rect = control.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    const expectStableSize = (
      actual: { width: number; height: number },
      baseline: { width: number; height: number },
    ) => {
      expectAtLeast44PxGeometry(actual.width);
      expectAtLeast44PxGeometry(actual.height);
      expect(Math.abs(actual.width - baseline.width)).toBeLessThanOrEqual(
        DOM_RECT_SUBPIXEL_EPSILON_PX,
      );
      expect(Math.abs(actual.height - baseline.height)).toBeLessThanOrEqual(
        DOM_RECT_SUBPIXEL_EPSILON_PX,
      );
    };
    const before = await readSize();
    await first.click();
    await expect(page.locator('.exercise-block__rest-editor').first()).toBeVisible();
    expectStableSize(await readSize(), before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await first.click();
    await expect(page.locator('.exercise-block__rest-editor')).toHaveCount(0);
    expectStableSize(await readSize(), before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});

test('active workout keeps localized weighted headings visible', async ({ page }) => {
  await setStoredLocale(page, 'it');
  await startNeutralWorkout(page);

  for (const locale of ['it', 'en'] as const) {
    if (locale === 'en') await setStoredLocale(page, locale);
    const previousLabel = locale === 'it' ? 'Precedente' : 'Previous';
    await expect(
      page.locator('.set-table--weight-reps .set-table__header > :nth-child(2)'),
    ).toHaveCount(5);
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

test('compact set labels stay at least 12px without truncating on narrow workouts', async ({
  page,
}) => {
  await installAdaptiveWorkoutFixture(page);
  await setStoredLocale(page, 'it');
  await startNeutralWorkout(page);

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      const labels = [
        ...document.querySelectorAll<HTMLElement>(
          '.set-table--weight-reps .set-table__header > *, .set-table--weight-reps .set-previous',
        ),
      ];
      return labels.map((label) => {
        const range = document.createRange();
        range.selectNodeContents(label);
        return {
          fontSize: Number.parseFloat(getComputedStyle(label).fontSize),
          clientWidth: label.clientWidth,
          contentWidth: range.getBoundingClientRect().width,
        };
      });
    });
    expect(geometry.length).toBeGreaterThan(0);
    expect(
      geometry.every(({ fontSize }) => fontSize >= 12),
      JSON.stringify(geometry),
    ).toBe(true);
    expect(
      geometry.every(({ clientWidth, contentWidth }) => contentWidth <= clientWidth + 0.5),
      JSON.stringify(geometry),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
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
  const firstWorkingRow = weighted.getByRole('group', {
    name: 'Set 2 for Barbell Squat',
  });
  await expect(firstWorkingRow).toBeVisible();
  await expect(firstWorkingRow.locator('.set-previous')).toHaveAttribute(
    'aria-label',
    'Set 2 previous: 88.2 × 8',
  );
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
  await expect(page.getByText(/^(technique and notes|tecnica e note)$/i)).toHaveCount(3);
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
  await expect(page.locator('.summary-pop')).toContainText(/\d+\s*kg.*Volume/is);
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

test('create sheet contains focus and restores its trigger and scroll position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 400 });
  const trigger = page.getByRole('button', { name: /^(create|crea)$/i });
  await trigger.evaluate((button) => button.focus({ preventScroll: true }));
  await page.evaluate(() => window.scrollTo(0, 24));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const layoutBefore = await page.locator('.screen').evaluate((screen) => {
    const rect = screen.getBoundingClientRect();
    return {
      clientWidth: document.documentElement.clientWidth,
      left: rect.left,
      right: rect.right,
      width: rect.width,
    };
  });
  expect(scrollBefore).toBeGreaterThan(0);

  await trigger.evaluate((button: HTMLButtonElement) => button.click());
  const dialog = page.getByRole('dialog', { name: /^(create|crea)$/i });
  const newRoutine = dialog.getByRole('button', {
    name: /^(new routine|nuova scheda)$/i,
  });
  const newProgram = dialog.getByRole('button', {
    name: /^(new program|nuovo programma)$/i,
  });

  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/one reusable workout|un singolo allenamento/i)).toBeVisible();
  await expect(
    dialog.getByText(/ordered group of routines|gruppo ordinato di schede/i),
  ).toBeVisible();
  await expect(newRoutine).toBeFocused();
  expect(
    await page.evaluate(() => ({
      htmlOverflow: document.documentElement.style.overflow,
      overflow: document.body.style.overflow,
      position: document.body.style.position,
    })),
  ).toEqual({ htmlOverflow: 'hidden', overflow: 'hidden', position: '' });
  expect(
    await page.locator('.screen').evaluate((screen) => {
      const rect = screen.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
    }),
  ).toEqual(layoutBefore);
  await page.mouse.move(4, 4);
  await page.mouse.wheel(0, 500);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  await page.keyboard.press('Shift+Tab');
  await expect(newProgram).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(newRoutine).toBeFocused();

  const dialogElement = await dialog.elementHandle();
  await newRoutine.click();
  const nestedDialog = page.getByRole('dialog', {
    name: /^(new routine|nuova scheda)$/i,
  });
  const name = nestedDialog.getByRole('textbox', { name: /routine name|nome scheda/i });
  await expect(nestedDialog).toBeVisible();
  expect(
    await dialogElement?.evaluate(
      (element) => element.isConnected && element === document.querySelector('dialog[open]'),
    ),
  ).toBe(true);
  await expect(name).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(nestedDialog.getByRole('button', { name: /^(cancel|annulla)$/i })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(name).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(nestedDialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  expect(
    await page.evaluate(() => ({
      htmlOverflow: document.documentElement.style.overflow,
      overflow: document.body.style.overflow,
      position: document.body.style.position,
    })),
  ).toEqual({ htmlOverflow: '', overflow: '', position: '' });
});

test('routine creation preserves Train scroll memory while the editor starts at the top', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 400 });
  const create = page.getByRole('button', { name: /^(create|crea)$/i });
  await create.evaluate((button) => button.focus({ preventScroll: true }));
  await page.evaluate(() => window.scrollTo(0, 130));
  const trainScroll = await page.evaluate(() => window.scrollY);
  expect(trainScroll).toBeGreaterThan(0);

  await create.evaluate((button: HTMLButtonElement) => button.click());
  await page
    .getByRole('dialog', { name: /^(create|crea)$/i })
    .getByRole('button', { name: /^(new routine|nuova scheda)$/i })
    .click();
  const newRoutineDialog = page.getByRole('dialog', {
    name: /^(new routine|nuova scheda)$/i,
  });
  await newRoutineDialog
    .getByRole('textbox', { name: /routine name|nome scheda/i })
    .fill('Scroll memory');
  await newRoutineDialog.getByRole('button', { name: /^(create|crea)$/i }).click();

  await expect(page.getByRole('heading', { name: /edit routine|modifica scheda/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page
    .getByRole('button', { name: /back|indietro/i })
    .first()
    .click();
  await expect(create).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(trainScroll);
});

test('sheet focus wrap skips negative, disabled, hidden, and inert descendants', async ({
  page,
}) => {
  await page.getByRole('button', { name: /^(create|crea)$/i }).click();
  const dialog = page.getByRole('dialog', { name: /^(create|crea)$/i });
  const first = dialog.getByRole('button', { name: /^(new routine|nuova scheda)$/i });
  const last = dialog.getByRole('button', { name: /^(new program|nuovo programma)$/i });

  await dialog.evaluate((element) => {
    const body = element.querySelector('.sheet__body');
    if (!(body instanceof HTMLElement)) throw new Error('sheet body missing');

    const negative = document.createElement('button');
    negative.textContent = 'Negative tabindex fixture';
    negative.tabIndex = -2;
    body.append(negative);

    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    const disabled = document.createElement('button');
    disabled.textContent = 'Disabled fieldset fixture';
    fieldset.append(disabled);
    body.append(fieldset);

    const hiddenParent = document.createElement('div');
    hiddenParent.hidden = true;
    const hidden = document.createElement('button');
    hidden.textContent = 'Hidden fixture';
    hiddenParent.append(hidden);
    body.append(hiddenParent);

    const inertParent = document.createElement('div');
    inertParent.inert = true;
    const inert = document.createElement('button');
    inert.textContent = 'Inert fixture';
    inertParent.append(inert);
    body.append(inertParent);
  });

  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
});

test('destructive routine sheet ignores its scrim and restores focus on Escape', async ({
  page,
}) => {
  await openNeutralRoutineEditor(page);
  const trigger = page.getByRole('button', { name: /delete routine|elimina routine/i });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /delete routine|elimina routine/i });

  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('routine warm-up removal restores focus within the exercise', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  const exerciseCards = page.locator('.routine-exercise');
  const firstExercise = exerciseCards.first();
  await firstExercise
    .locator('summary')
    .filter({ hasText: /warm-up sets|serie di riscaldamento/i })
    .click();
  const addWarmup = firstExercise.getByRole('button', { name: /add warm-up set/i });
  await addWarmup.click();
  const warmupRemovals = firstExercise.getByRole('button', { name: /remove warm-up set/i });
  const initialWarmupCount = await warmupRemovals.count();
  const removeWarmup = warmupRemovals.last();
  await removeWarmup.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /remove this warm-up set/i });
  const cancel = dialog.getByRole('button', { name: /^cancel$/i });
  await expect(cancel).toBeFocused();
  await cancel.click();
  await expect(removeWarmup).toBeFocused();
  await expect(warmupRemovals).toHaveCount(initialWarmupCount);

  await removeWarmup.click();
  await dialog.getByRole('button', { name: /^remove$/i }).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('remove-warm-up button missing');
    button.click();
    button.click();
  });
  await expect(dialog).toHaveCount(0);
  await expect(warmupRemovals).toHaveCount(initialWarmupCount - 1);
  await expect(
    firstExercise.locator('summary').filter({ hasText: /warm-up sets|serie di riscaldamento/i }),
  ).toBeFocused();
});

test('routine exercise removal restores focus to add exercise', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  const exerciseCards = page.locator('.routine-exercise');
  const initialExerciseCount = await exerciseCards.count();
  const optionsTrigger = exerciseCards
    .first()
    .getByRole('button', { name: /exercise options|opzioni esercizio/i });
  await optionsTrigger.click();
  const removeExercise = page
    .getByRole('dialog', { name: /exercise options|opzioni esercizio/i })
    .getByRole('button', { name: /^remove exercise$|^rimuovi esercizio$/i });
  await removeExercise.click();
  const dialog = page.getByRole('dialog', { name: /remove barbell squat/i });
  const cancel = dialog.getByRole('button', { name: /^cancel$/i });
  await expect(cancel).toBeFocused();
  await cancel.click();
  await expect(optionsTrigger).toBeFocused();
  await expect(exerciseCards).toHaveCount(initialExerciseCount);

  await optionsTrigger.click();
  await page
    .getByRole('dialog', { name: /exercise options|opzioni esercizio/i })
    .getByRole('button', { name: /^remove exercise$|^rimuovi esercizio$/i })
    .click();
  await dialog.getByRole('button', { name: /^remove$/i }).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('remove-exercise button missing');
    button.click();
    button.click();
  });
  await expect(dialog).toHaveCount(0);
  await expect(exerciseCards).toHaveCount(initialExerciseCount - 1);
  await expect(page.getByRole('button', { name: /^\+ exercise$/i })).toBeFocused();

  await page
    .getByRole('button', { name: /^back$/i })
    .first()
    .click();
  await openNeutralRoutineEditor(page);
  await expect(page.locator('.routine-exercise').filter({ hasText: /^Barbell Squat/ })).toHaveCount(
    0,
  );
});

test('custom exercise sheet closes from its scrim', async ({ page }) => {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  const trigger = page.getByRole('button', {
    name: /create custom exercise|crea esercizio personalizzato/i,
  });
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: /create custom exercise|crea esercizio personalizzato/i,
  });

  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('custom creation failure clears its alert when the sheet is dismissed', async ({ page }) => {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  await page.evaluate(async () => {
    const modulePath = '/src/state/useStore.ts';
    const { useStore } = (await import(modulePath)) as typeof import('../src/state/useStore');
    useStore.setState({
      createCustomExercise: async () => {
        throw new Error('local write failed');
      },
    });
  });
  await page
    .getByRole('button', { name: /create custom exercise|crea esercizio personalizzato/i })
    .click();
  const dialog = page.getByRole('dialog', {
    name: /create custom exercise|crea esercizio personalizzato/i,
  });
  await dialog.getByLabel(/exercise name|nome esercizio/i).fill('Failed carry');
  await dialog.getByRole('button', { name: /^(create|crea)$/i }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    /could not create the exercise|impossibile creare l'esercizio/i,
  );

  await dialog.getByRole('button', { name: /^(cancel|annulla)$/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('library keeps labelled search, filters, and scroll context through hardware Back', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  const search = page.getByRole('searchbox', { name: /search exercises|cerca esercizi/i });
  const searchId = await search.getAttribute('id');
  expect(searchId).toBeTruthy();
  await expect(page.locator(`label[for="${searchId}"]`)).toBeVisible();

  const filters = page.getByRole('group', { name: /muscle group|gruppo muscolare/i });
  const filterButtons = filters.getByRole('button');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(
      await filterButtons.evaluateAll((buttons) =>
        buttons.every((button) => button.getBoundingClientRect().height >= 44),
      ),
    ).toBe(true);
  }

  await search.fill('barbell');
  const legs = filters.getByRole('button', { name: /^(legs|gambe)$/i });
  await legs.click();
  await expect(legs).toHaveAttribute('aria-pressed', 'true');
  const results = page.getByRole('list', { name: /exercise results|risultati esercizi/i });
  const resultButtons = results.getByRole('button');
  await expect.poll(() => resultButtons.count()).toBeGreaterThan(4);
  const selected = resultButtons.nth(4);
  await selected.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await selected.click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goBack();
  await expect(search).toHaveValue('barbell');
  await expect(legs).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  expect(pageErrors).toEqual([]);
});

test('library progressively reveals the complete catalog and tolerates an Italian typo', async ({
  page,
}) => {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  const results = page.getByRole('list', { name: /exercise results|risultati esercizi/i });
  await expect(results.getByRole('button')).toHaveCount(60);

  await page.getByRole('button', { name: /show more|mostra altri/i }).scrollIntoViewIfNeeded();
  await expect.poll(() => results.getByRole('button').count()).toBeGreaterThan(60);

  const search = page.getByRole('searchbox', { name: /search exercises|cerca esercizi/i });
  await search.fill('squat bilancerie');
  await expect(results.getByRole('button').first()).toContainText(/squat/i);
});

test('library keeps progressively revealed rows when returning from exercise detail', async ({
  page,
}) => {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  const results = page.getByRole('list', { name: /exercise results|risultati esercizi/i });
  await page.getByRole('button', { name: /show more|mostra altri/i }).scrollIntoViewIfNeeded();
  await expect.poll(() => results.getByRole('button').count()).toBeGreaterThan(60);

  const selected = results.getByRole('button').nth(70);
  const selectedName = (await selected.locator('.library-result__name').textContent())?.trim();
  expect(selectedName).toBeTruthy();
  await selected.scrollIntoViewIfNeeded();
  await selected.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(selectedName ?? '');

  await page.goBack();
  await expect(results.getByRole('button')).toHaveCount(120);
  await expect(results.getByText(selectedName ?? '', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('Italian exercise surfaces localize dynamic equipment metadata', async ({ page }) => {
  await setStoredLocale(page, 'it');
  await page.getByRole('button', { name: 'Esercizi' }).click();
  const search = page.getByRole('searchbox', { name: 'Cerca esercizi' });
  await search.fill('squat con bilanciere');
  const result = page.getByRole('list', { name: 'Risultati esercizi' }).getByRole('button').first();
  await expect(result).toContainText('Bilanciere');
  await expect(result).not.toContainText(/\bbarbell\b/i);
  await result.click();
  await expect(page.locator('.exercise-detail__metadata')).toContainText('Bilanciere');
  await expect(page.locator('.exercise-detail__metadata')).not.toContainText(/\bbarbell\b/i);
  await expect(page.locator('.exercise-detail__identity')).not.toContainText('Barbell Squat');
});

test('routine custom exercise creates once with its selected prescription tracking', async ({
  page,
}) => {
  await openNeutralRoutineEditor(page);
  await page.getByRole('button', { name: /^\+ (exercise|esercizio)$/i }).click();
  await page
    .getByRole('button', { name: /create custom exercise|crea esercizio personalizzato/i })
    .click();
  const dialog = page.getByRole('dialog', {
    name: /create custom exercise|crea esercizio personalizzato/i,
  });
  await dialog.getByLabel(/exercise name|nome esercizio/i).fill('Band pull-apart');
  await dialog.getByLabel(/muscle group|gruppo muscolare/i).selectOption('shoulders');
  await dialog.getByLabel(/goal type|tipo di obiettivo/i).selectOption('reps');
  const create = dialog.getByRole('button', { name: /^(create|crea)$/i });
  await create.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });

  await expect(page.getByRole('heading', { name: /edit routine|modifica scheda/i })).toBeVisible();
  const exercise = page.locator('.routine-exercise').filter({ hasText: 'Band pull-apart' });
  await expect(exercise).toHaveCount(1);
  await exercise.getByRole('button', { name: /exercise options|opzioni esercizio/i }).click();
  await expect(
    page
      .getByRole('dialog', { name: /exercise options|opzioni esercizio/i })
      .getByRole('button', { name: /goal type|tipo di obiettivo/i }),
  ).toContainText(/reps only|solo ripetizioni/i);
  expect(
    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('overload');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      try {
        const [routine, customExercises] = await Promise.all([
          new Promise<{ exercises: Array<{ exerciseId: string; tracking?: string }> }>(
            (resolve, reject) => {
              const request = database
                .transaction('routines', 'readonly')
                .objectStore('routines')
                .get('full-body-a');
              request.onerror = () => reject(request.error);
              request.onsuccess = () => resolve(request.result);
            },
          ),
          new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
            const request = database
              .transaction('customExercises', 'readonly')
              .objectStore('customExercises')
              .getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          }),
        ]);
        const created = routine.exercises.filter((item) => item.exerciseId.startsWith('custom:'));
        return {
          customCount: customExercises.length,
          routineCount: created.length,
          tracking: created[0]?.tracking,
          customHasTracking: customExercises.some((item) => 'tracking' in item),
        };
      } finally {
        database.close();
      }
    }),
  ).toEqual({
    customCount: 1,
    routineCount: 1,
    tracking: 'reps',
    customHasTracking: false,
  });
});

test('custom exercise detail omits a media hero when no media exists', async ({ page }) => {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  await page
    .getByRole('button', { name: /create custom exercise|crea esercizio personalizzato/i })
    .click();
  const dialog = page.getByRole('dialog', {
    name: /create custom exercise|crea esercizio personalizzato/i,
  });
  await dialog.getByLabel(/exercise name|nome esercizio/i).fill('No-media carry');
  await dialog.getByLabel(/muscle group|gruppo muscolare/i).selectOption('core');
  await dialog.getByRole('button', { name: /^(create|crea)$/i }).click();

  await expect(page.getByRole('heading', { name: 'No-media carry', exact: true })).toBeVisible();
  await expect(page.locator('.exercise-detail__media')).toHaveCount(0);
  await expect(page.locator('.exmedia:not(.exmedia-thumb)')).toHaveCount(0);
});

test('exercise detail promotes valid media, stays static when reduced, and defers video', async ({
  page,
}) => {
  await installCompletedWorkoutFixture(page);
  await page.route('**/exercise-media/Barbell_Squat/0.jpg', async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
  await openExerciseDetail(page);
  const media = page.locator('.exercise-detail__media .exmedia');
  await expect(media.locator('img')).toHaveCount(1);
  await expect(media.locator('img')).toHaveAttribute('src', /Barbell_Squat\/1\.jpg$/);
  await expect(media.locator('img')).toHaveAttribute('loading', 'eager');
  await expect(media.locator('img')).toHaveAttribute('width', '600');
  await expect(media.locator('img')).toHaveAttribute('height', '400');
  await expect(media.locator('.exmedia-fallback')).toHaveCount(0);

  await page.unroute('**/exercise-media/Barbell_Squat/0.jpg');
  await page.goBack();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openExerciseDetail(page);
  const frames = page.locator('.exercise-detail__media img');
  await expect(frames).toHaveCount(2);
  expect(
    await frames.nth(1).evaluate((image) => {
      const style = getComputedStyle(image);
      return { animationName: style.animationName, opacity: style.opacity };
    }),
  ).toEqual({ animationName: 'none', opacity: '0' });

  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: /watch technique|guarda la tecnica/i }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com/);

  const headings = await page
    .getByRole('heading', { level: 2 })
    .evaluateAll((elements) => elements.map((element) => element.textContent?.trim()));
  const journalIndex = headings.findIndex((heading) => /^Journal|^Diario/i.test(heading ?? ''));
  const instructionsIndex = headings.findIndex((heading) =>
    /^How to|^Esecuzione/i.test(heading ?? ''),
  );
  expect(journalIndex).toBeGreaterThanOrEqual(0);
  expect(instructionsIndex).toBeLessThan(journalIndex);
});

test('exercise detail keeps the journal collapsed and opens the exercise in Progress', async ({
  page,
}) => {
  await installCompletedWorkoutFixture(page);
  await openExerciseDetail(page);

  const lastTime = page.locator('.exercise-detail__performance');
  await expect(lastTime.getByRole('heading', { name: /last time|ultima volta/i })).toBeVisible();
  await expect(lastTime.locator('.exercise-performance-context')).toContainText(/25 Aug|25 ago/i);
  await expect(lastTime.locator('.exercise-performance-context')).toContainText('Full Body A');
  await expect(lastTime.locator('.exercise-performance-record')).toContainText(/record/i);
  await expect(lastTime).not.toContainText(
    /latest working performance|ultima prestazione di lavoro/i,
  );

  const journal = page.getByRole('button', { name: /journal.*entries|diario.*voci/i });
  await expect(journal).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Linked observation', { exact: true })).toHaveCount(0);
  await journal.click();
  await expect(journal).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Linked observation', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /open in progress|apri in progressi/i }).click();
  await expect(page.getByRole('heading', { name: 'Barbell Squat', exact: true })).toBeVisible();
  await expect(page.locator('#progress-exercise')).toHaveValue('Barbell_Squat');
});

test('two-frame exercise media can be paused by keyboard and disappears under reduced motion', async ({
  page,
}) => {
  await installCompletedWorkoutFixture(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openExerciseDetail(page);

  const media = page.locator('.exercise-detail__media .exmedia');
  const pause = media.getByRole('button', { name: 'Pause demo' });
  await expect(pause).toBeVisible();
  await expect(pause).toHaveText('');
  await pause.focus();
  await page.keyboard.press('Enter');
  const resume = media.getByRole('button', { name: 'Resume demo' });
  await expect(resume).toBeFocused();
  await expect(media.locator('.exmedia-b')).toHaveCSS('animation-play-state', 'paused');

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const bounds = await resume.boundingBox();
    expect(bounds).not.toBeNull();
    expectAtLeast44PxGeometry(bounds?.height ?? 0);
    expect((bounds?.x ?? viewport.width) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
      viewport.width,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(resume).toBeHidden();
  await expect(media.locator('.exmedia-b')).toHaveCSS('animation-name', 'none');
});

test('program delete confirmation ignores its scrim without replacing the dialog', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: /(program options|opzioni programma)/i })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  const dialogElement = await dialog.elementHandle();

  await dialog.getByRole('button', { name: /delete program|elimina programma/i }).click();
  await expect(dialog).toHaveAccessibleName(/delete program|elimina programma/i);
  expect(
    await dialogElement?.evaluate(
      (element) => element.isConnected && element === document.querySelector('dialog[open]'),
    ),
  ).toBe(true);

  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeVisible();
});

test('program delete confirmation focuses Cancel and keeps focus wrapped in the same dialog', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: /(program options|opzioni programma)/i })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  const dialogElement = await dialog.elementHandle();

  await dialog.getByRole('button', { name: /delete program|elimina programma/i }).click();
  const confirm = dialog.getByRole('button', { name: /^(delete|elimina)$/i });
  const cancel = dialog.getByRole('button', { name: /^(cancel|annulla)$/i });
  expect(
    await dialogElement?.evaluate(
      (element) => element.isConnected && element === document.querySelector('dialog[open]'),
    ),
  ).toBe(true);
  await expect(cancel).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cancel).toBeFocused();
});

test('routines are fully editable and deletable', async ({ page }) => {
  await page.getByRole('button', { name: /^(create|crea)$/i }).click();
  await page.getByRole('button', { name: /^(new routine|nuova scheda)$/i }).click();
  await page
    .getByRole('dialog', { name: /^(new routine|nuova scheda)$/i })
    .getByRole('button', { name: /^(create|crea)$/i })
    .click();
  await expect(page.getByText(/edit routine|modifica scheda/i)).toBeVisible();
  await page.getByRole('button', { name: /^\+ (exercise|esercizio)$/i }).click();
  await page.getByPlaceholder(/search|cerca/i).fill('squat');
  await page
    .getByRole('button', { name: /^(barbell squat legs|squat con bilanciere gambe)$/i })
    .click();
  await expect(page.getByText(/edit routine|modifica scheda/i)).toBeVisible();
  await expect(page.getByText(/barbell squat/i).first()).toBeVisible();
  await page.getByRole('button', { name: /delete routine|elimina routine/i }).click();
  await page.getByRole('button', { name: /^(delete|elimina)$/i }).click();
  await expect(page.getByRole('button', { name: /^(create|crea)$/i })).toBeVisible();
});

test('programs group routines and are manageable', async ({ page }) => {
  await page.getByRole('button', { name: /^(create|crea)$/i }).click();
  await page.getByRole('button', { name: /^(new program|nuovo programma)$/i }).click();
  const newProgramDialog = page.getByRole('dialog', {
    name: /^(new program|nuovo programma)$/i,
  });
  await newProgramDialog.getByLabel(/routine name|nome/i).fill('Test Program');
  await newProgramDialog.getByRole('button', { name: /^(create|crea)$/i }).click();
  // Empty program invites adding its first routine.
  await page.getByRole('button', { name: /empty program|programma vuoto/i }).click();
  const newRoutineDialog = page.getByRole('dialog', {
    name: /^(new routine|nuova scheda)$/i,
  });
  await newRoutineDialog.getByLabel(/routine name|nome/i).fill('Day X');
  await newRoutineDialog.getByRole('button', { name: /^(create|crea)$/i }).click();
  await expect(page.getByText(/edit routine|modifica scheda/i)).toBeVisible();
  await page
    .getByRole('button', { name: /back|indietro/i })
    .first()
    .click();
  await expect(page.getByText(/test program/i)).toBeVisible();
  await page.getByRole('button', { name: /test program.*1 (routine|scheda)/i }).click();
  await expect(page.getByText(/day x/i)).toBeVisible();
  // Delete the program: routine survives as standalone.
  await page
    .getByRole('button', { name: /test program.*(program options|opzioni programma)/i })
    .click();
  await page.getByRole('button', { name: /delete program|elimina programma/i }).click();
  await page.getByRole('button', { name: /^(delete|elimina)$/i }).click();
  await expect(page.getByText(/test program/i)).toHaveCount(0);
  await expect(page.getByText(/day x/i)).toHaveCount(0);
});

test('session notes stay on their workouts', async ({ page }) => {
  await startNeutralWorkout(page);

  const session = page
    .getByRole('button', { name: /^technique and notes|^tecnica e note/i })
    .first();
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

  await session.click();
  await expect(session).toHaveAttribute('aria-expanded', 'true');
  await page
    .getByRole('button', { name: /^(edit note|modifica nota)$/i })
    .first()
    .click();
  expect(
    await page.getByRole('textbox', { name: /^today's note|^nota di oggi/i }).evaluate((editor) => {
      const labelId = editor.getAttribute('aria-labelledby');
      return labelId !== null && document.getElementById(labelId)?.textContent?.trim();
    }),
  ).toBe("Today's note");
  await page.getByLabel(/^today's note|^nota di oggi/i).fill('First session');
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
  await expect(session).toContainText(/how this exercise felt|com'è andato/i);
  await session.click();
  await page
    .getByRole('button', { name: /^(edit note|modifica nota)$/i })
    .first()
    .click();
  await expect(page.getByLabel(/^today's note|^nota di oggi/i)).toHaveValue('');
  await expect(page.locator('.workout-note__context')).toContainText('First session');
  await page.getByLabel(/^today's note|^nota di oggi/i).fill('Second session');
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

test('active workout localizes technique and keeps both note scopes progressively disclosed', async ({
  page,
}) => {
  await setStoredLocale(page, 'it');
  await startNeutralWorkout(page);

  const notes = page.getByRole('button', { name: /^tecnica e note/i }).first();
  await expect(notes).toHaveAttribute('aria-expanded', 'false');
  await notes.click();

  const exercise = page.locator('.exercise-block').first();
  await expect(exercise.getByText('Tecnica della scheda', { exact: true })).toBeVisible();
  await expect(exercise.getByText('Nota di oggi', { exact: true })).toBeVisible();
  await expect(exercise).not.toContainText(/notes\.technique/i);
  await expect(exercise.getByRole('textbox')).toHaveCount(0);

  await exercise.getByRole('button', { name: /modifica tecnica/i }).click();
  const editor = exercise.getByRole('textbox', { name: 'Tecnica della scheda' });
  await expect(editor).toBeVisible();
  const draftTechnique = 'Cue lungo '.repeat(20);
  await editor.fill(draftTechnique);
  expect(await editor.evaluate((field) => field.scrollHeight <= field.clientHeight + 1)).toBe(true);
  await notes.click();
  await notes.click();
  await expect(exercise.getByRole('textbox', { name: 'Tecnica della scheda' })).toHaveValue(
    draftTechnique,
  );
  await exercise.getByRole('button', { name: /^fatto$/i }).click();
  await expect(exercise).toContainText(draftTechnique.trim());
});

for (const locale of ['it', 'en'] as const) {
  test(`completed workout editor follows the compact set-table grammar without responsive overlap (${locale})`, async ({
    page,
  }) => {
    await installCompletedWorkoutFixture(page);
    await setStoredLocale(page, locale);
    await page.getByRole('button', { name: /^(home)$/i }).click();
    const workout = page
      .locator('.workout-row')
      .filter({ hasText: locale === 'it' ? /25 ago/i : /25 Aug/i })
      .first();
    await workout.click();
    await page.getByRole('button', { name: /workout options|opzioni allenamento/i }).click();
    await page
      .getByRole('dialog', { name: /workout options|opzioni allenamento/i })
      .getByRole('button', { name: /edit workout|modifica allenamento/i })
      .click();

    const editor = page.locator('.workout-editor-screen');
    await expect(editor).toBeVisible();
    const firstExercise = editor.locator('.workout-editor-exercise').first();
    const header = firstExercise.locator('.workout-editor-set-header');
    await expect(header).toContainText(locale === 'it' ? 'Serie' : 'Set');
    await expect(header).toContainText(locale === 'it' ? 'Precedente' : 'Previous');
    await expect(header).toContainText('kg');
    await expect(header).toContainText(/reps/i);
    await expect(
      firstExercise.getByRole('button', { name: /exercise options|opzioni esercizio/i }),
    ).toBeVisible();
    await expect(firstExercise.getByRole('button', { name: /^(remove|rimuovi)$/i })).toHaveCount(0);

    for (const width of [320, 375, 412]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll<HTMLElement>('body *')]
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            text: element.textContent?.trim().slice(0, 60),
            right: element.getBoundingClientRect().right,
          }))
          .filter((item) => item.right > window.innerWidth + 0.5)
          .slice(0, 8),
      }));
      expect(overflow.scrollWidth, JSON.stringify(overflow.offenders)).toBe(width);
      const geometry = await editor.locator('.workout-editor-meta input').evaluateAll((inputs) =>
        inputs.map((input) => {
          const box = input.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        }),
      );
      for (let left = 0; left < geometry.length; left += 1) {
        for (let right = left + 1; right < geometry.length; right += 1) {
          const a = geometry[left];
          const b = geometry[right];
          const intersects =
            a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          expect(intersects, JSON.stringify({ width, a, b })).toBe(false);
        }
      }
    }

    await firstExercise
      .getByRole('button', { name: /exercise options|opzioni esercizio/i })
      .click();
    await expect(
      page
        .getByRole('dialog', { name: /exercise options|opzioni esercizio/i })
        .getByRole('button', { name: /^(remove|rimuovi)$/i }),
    ).toBeVisible();

    if (locale === 'it') {
      await page
        .getByRole('dialog', { name: /opzioni esercizio/i })
        .getByRole('button', { name: /^rimuovi$/i })
        .click();
    } else {
      await page.keyboard.press('Escape');
      await firstExercise.getByRole('button', { name: /remove set 1/i }).click();
      await firstExercise.getByRole('button', { name: /remove set 1/i }).click();
    }

    await editor.getByRole('button', { name: /^(save|salva)$/i }).click();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('overload');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });
          try {
            const record = await new Promise<{
              sets: Array<{ exerciseId: string }>;
              exerciseNotes?: Array<{ exerciseId: string }>;
            }>((resolve, reject) => {
              const request = database
                .transaction('workouts', 'readonly')
                .objectStore('workouts')
                .get('newest-detail');
              request.onerror = () => reject(request.error);
              request.onsuccess = () => resolve(request.result);
            });
            return {
              hasSets: record.sets.some((set) => set.exerciseId === 'Barbell_Squat'),
              hasNote: record.exerciseNotes?.some((note) => note.exerciseId === 'Barbell_Squat'),
            };
          } finally {
            database.close();
          }
        }),
      )
      .toEqual({ hasSets: false, hasNote: false });
  });
}

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
    await page.getByRole('button', { name: /journal|diario/i }).click();
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
  await expect(page.getByRole('heading', { name: 'Last time', exact: true })).toBeVisible();
  await expect(
    page.locator('.exercise-performance-list').getByText('110.2 lb × 8', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('44.1 lb × 5', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /journal.*entries/i }).click();
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
        .locator('.exercise-journal__topline')
        .evaluateAll((elements) =>
          elements.every((element) => Number.parseFloat(getComputedStyle(element).fontSize) >= 12),
        ),
    ).toBe(true);
    expect(
      await page
        .getByRole('button', { name: /Linked observation/ })
        .evaluate((button) => button.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole('button', { name: /Linked observation/ }).click();
  await expect(page.getByRole('heading', { name: 'Full Body A', exact: true })).toBeVisible();
  await expect(page.getByText('661.4 lb', { exact: true })).toBeVisible();
  await expect(page.getByText('Volume', { exact: true })).toBeVisible();
  const squat = page.locator('section.card').filter({
    has: page.getByRole('heading', { name: 'Barbell Squat', exact: true }),
  });
  await expect(squat.getByRole('heading', { name: 'Warm-up sets' })).toBeVisible();
  await expect(squat.getByLabel('Warm-up set 1', { exact: true })).toContainText(
    /W\s*· 44\.1 lb × 5/,
  );
  await expect(squat.getByRole('heading', { name: 'Working sets' })).toBeVisible();
  await expect(squat.getByLabel('Working set 1', { exact: true })).toContainText(
    /1\s*· 110\.2 lb × 8/,
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
  await expect(page.getByRole('heading', { name: 'Last time', exact: true })).toBeVisible();
  await expect(
    page.locator('.exercise-performance-list').getByText('12 reps', { exact: true }),
  ).toBeVisible();
  await openExerciseDetail(page, 'plank', /^plank core$/i);
  await expect(page.getByRole('heading', { name: 'Plank', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Last time', exact: true })).toBeVisible();
  await expect(
    page.locator('.exercise-performance-list').getByText('35 seconds', { exact: true }),
  ).toBeVisible();
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

  await expect(page.locator('.route-fallback')).toHaveCount(0);
  const summaryTitle = page.locator('.summary-pop').getByText('Done.', { exact: true });
  await expect(summaryTitle).toHaveRole('heading');
  await expect(summaryTitle).toHaveJSProperty('tagName', 'H1');
  await expect(page.locator('.summary-pop .mono.small.muted')).toContainText('1 working set');
  await expect(page.getByText('+579.5 lb vs your last Full Body A', { exact: true })).toBeVisible();
  await expect(page.locator('.summary-pop')).toContainText(/800\s*lb.*Volume/is);
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

  await expect(page.locator('.summary-pop')).toContainText(/128\s*kg.*Volume/is);
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
  await page
    .getByRole('main')
    .getByRole('button', { name: /Full Body A.*128 kg/i })
    .click();
  await expect(page.getByText('128 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Volume', { exact: true })).toBeVisible();
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

test('progress uses working sets, current tracking and complete keyboard tabs', async ({
  page,
}) => {
  await installProgressSurfaceFixture(page);
  await page.getByRole('button', { name: /^progress$/i }).click();

  const tablist = page.getByRole('tablist', { name: 'Progress sections' });
  const training = tablist.getByRole('tab', { name: 'Training' });
  const body = tablist.getByRole('tab', { name: 'Body' });
  const nutrition = tablist.getByRole('tab', { name: 'Nutrition' });
  await expect(training).toHaveAttribute('tabindex', '0');
  await expect(body).toHaveAttribute('tabindex', '-1');
  await expect(training).toHaveAttribute('aria-selected', 'true');
  const panels: Locator[] = [];
  for (const tab of [training, body, nutrition]) {
    const panelId = await tab.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toHaveRole('tabpanel');
    panels.push(panel);
  }
  await expect(panels[1]).toBeHidden();
  await training.focus();
  await page.keyboard.press('ArrowRight');
  await expect(body).toBeFocused();
  await expect(body).toHaveAttribute('aria-selected', 'true');
  await expect(panels[1]).toBeVisible();
  await page.keyboard.press('End');
  await expect(nutrition).toBeFocused();
  await expect(nutrition).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(training).toBeFocused();
  await expect(training).toHaveAttribute('aria-selected', 'true');

  const exercise = page.getByLabel('Exercise');
  const summary = (name: string) => page.getByRole('group', { name: `${name} progress summary` });
  await expect(exercise).toHaveValue('Barbell_Squat');
  await expect(summary('Barbell Squat')).toContainText(
    /Best\s*132\.3 lb × 4.*Last\s*121\.3 lb × 8.*Sessions\s*3/,
  );
  await expect(summary('Barbell Squat')).not.toContainText('reps');
  const weightedChart = page.getByRole('img', { name: /Barbell Squat.*3 sessions/i });
  const weightedCanvas = weightedChart.locator('canvas');
  await expect(weightedChart).toHaveAttribute('aria-label', /PR: 121\.3 lb × 8/);
  await expect(weightedCanvas).toHaveAttribute('aria-hidden', 'true');
  expect(
    await weightedCanvas.evaluate((node) =>
      Number.parseFloat((node as HTMLCanvasElement).getContext('2d')?.font ?? ''),
    ),
  ).toBeGreaterThanOrEqual(12);
  const latestPr = page.getByText(/^Latest PR ·/);
  await expect(latestPr).toHaveText('Latest PR · 121.3 lb × 8');
  await expect(page.getByRole('img', { name: /Weekly volume/i })).toHaveAttribute(
    'aria-label',
    /281\.1 lb.*661\.4 lb/,
  );

  await exercise.selectOption({ label: 'Hanging Leg Raise' });
  await expect(summary('Hanging Leg Raise')).toContainText(/14 reps.*Sessions\s*2/);
  await expect(latestPr).toHaveCount(0);
  await exercise.selectOption({ label: 'Plank' });
  await expect(summary('Plank')).toContainText(/45 seconds.*Sessions\s*2/);
  await expect(summary('Plank')).not.toContainText('300');
  await expect(latestPr).toHaveCount(0);

  await expectNarrowTouchTargets(page, tablist.getByRole('tab'));
});

test('progress chart redraws when the system theme changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await installProgressSurfaceFixture(page);
  await page.getByRole('button', { name: /^progress$/i }).click();
  const canvas = page.getByRole('img', { name: /Barbell Squat.*3 sessions/i }).locator('canvas');
  const lightRender = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(() =>
      canvas.evaluate((node, before) => {
        const element = node as HTMLCanvasElement;
        return {
          accent: getComputedStyle(element).getPropertyValue('--accent').trim(),
          redrawn: element.toDataURL() !== before,
        };
      }, lightRender),
    )
    .toEqual({ accent: '#c9f73a', redrawn: true });
});

test('progress does not imply a trend from a single session', async ({ page }) => {
  await installCompletedWorkoutFixture(page);
  await page.getByRole('button', { name: /^progress$/i }).click();
  await page.getByLabel('Exercise').selectOption({ label: 'Dumbbell Bench Press' });

  await expect(page.getByRole('img', { name: /Dumbbell Bench Press/i })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(
    'Complete another session to see the trend.',
  );
  await expect(
    page.getByRole('group', { name: 'Dumbbell Bench Press progress summary' }),
  ).toContainText(/66\.1 lb × 10.*Sessions\s*1/);
});

test('body filters show a disabled treatment without shifting during save', async ({ page }) => {
  await installProgressSurfaceFixture(page);
  await page.getByRole('button', { name: /^progress$/i }).click();
  await page.getByRole('tab', { name: 'Body' }).click();
  await page.getByRole('button', { name: 'Add measurement' }).click();
  await page.getByLabel('Weight (lb)').fill('222');
  await page.evaluate(async () => {
    const modulePath = '/src/state/useStore.ts';
    const storeModule = (await import(modulePath)) as typeof import('../src/state/useStore');
    storeModule.useStore.setState({
      addMeasurement: () => new Promise<never>(() => undefined),
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  const weight = page.getByRole('group', { name: 'Measurement type' }).getByRole('button', {
    name: 'Weight',
  });
  const appearance = () =>
    weight.evaluate((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        background: style.backgroundColor,
        border: style.borderTopColor,
        color: style.color,
        cursor: style.cursor,
        opacity: style.opacity,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
  const enabled = await appearance();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(weight).toBeDisabled();
  const pending = await appearance();
  expect(pending.background).not.toBe(enabled.background);
  expect(pending.border).not.toBe(enabled.border);
  expect(pending.color).not.toBe(enabled.color);
  expect(Number(pending.opacity)).toBeLessThan(Number(enabled.opacity));
  expect(pending.cursor).toBe('not-allowed');
  expect(pending.rect).toEqual(enabled.rect);
});

test('body converts only weight and names empty, single and trend states', async ({ page }) => {
  await installProgressSurfaceFixture(page);
  await page.getByRole('button', { name: /^progress$/i }).click();
  await page.getByRole('tab', { name: 'Body' }).click();

  const metrics = page.getByRole('group', { name: 'Measurement type' });
  await expect(metrics.getByRole('button', { name: 'Weight' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('group', { name: 'Weight summary' })).toContainText(
    /220\.5 lb.*209\.4 lb/,
  );
  await expect(page.getByRole('img', { name: /Weight trend.*2 measurements/i })).toBeVisible();
  await page.evaluate(async () => {
    const modulePath = '/src/state/useStore.ts';
    const storeModule = (await import(modulePath)) as typeof import('../src/state/useStore');
    const original = storeModule.useStore.getState().addMeasurement;
    storeModule.useStore.setState({
      addMeasurement: () => {
        storeModule.useStore.setState({ addMeasurement: original });
        return Promise.reject(new Error('expected measurement failure'));
      },
    });
  });
  await page.getByRole('button', { name: 'Add measurement' }).click();
  await page.getByLabel('Weight (lb)').fill('123');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not update measurements');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Add measurement' }).click();
  await expect(page.getByLabel('Weight (lb)')).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await metrics.getByRole('button', { name: 'Waist' }).click();
  const waistTrend = page.getByRole('region', { name: 'Waist trend' });
  await expect(waistTrend).toContainText('1 measurement recorded');
  await expect(waistTrend.getByText('82 cm', { exact: true })).toBeVisible();
  const remove = page.getByRole('button', {
    name: /Delete Waist measurement from 25 Aug 2026/i,
  });
  expect((await remove.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await remove.boundingBox())?.width).toBeGreaterThanOrEqual(44);

  await metrics.getByRole('button', { name: 'Calf' }).click();
  await expect(page.getByRole('region', { name: 'Calf trend' })).toContainText(
    'No Calf measurements yet',
  );

  for (const [metric, input, value] of [
    ['Weight', 'Weight (lb)', '220.5'],
    ['Calf', 'Calf (cm)', '33.3'],
  ] as const) {
    await metrics.getByRole('button', { name: metric }).click();
    await page.getByRole('button', { name: 'Add measurement' }).click();
    await page.getByLabel(input).fill(value);
    await page.getByLabel('Measurement date').fill('2026-08-26');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Add measurement' })).toBeVisible();
  }
  await putStoredRow(page, 'settings', { id: 'settings', locale: 'en', unit: 'kg' });
  await page.reload();
  await page.getByRole('button', { name: /^progress$/i }).click();
  await page.getByRole('tab', { name: 'Body' }).click();
  await expect(page.getByRole('group', { name: 'Weight summary' })).toContainText('100 kg');
  const savedWeight = page.getByRole('button', {
    name: /Delete Weight measurement from 26 Aug 2026/i,
  });
  await expect(savedWeight.locator('..')).toContainText('100 kg');
  await metrics.getByRole('button', { name: 'Calf' }).click();
  await expect(page.getByRole('region', { name: 'Recent measurements' })).toContainText('33.3 cm');

  await expectNarrowTouchTargets(page, metrics.getByRole('button'));
});

test('measurement deletion requires confirmation and ignores stale or double activation', async ({
  page,
}) => {
  await installProgressSurfaceFixture(page);
  await page.getByRole('button', { name: /^progress$/i }).click();
  await page.getByRole('tab', { name: 'Body' }).click();
  await page
    .getByRole('group', { name: 'Measurement type' })
    .getByRole('button', {
      name: 'Waist',
    })
    .click();

  const trigger = page.getByRole('button', {
    name: /Delete Waist measurement from 25 Aug 2026/i,
  });
  await trigger.focus();
  await page.keyboard.press('Enter');
  let dialog = page.getByRole('dialog', { name: /delete waist measurement/i });
  await expect(dialog).toContainText('25 Aug 2026 · 82 cm will be permanently removed.');
  let cancel = dialog.getByRole('button', { name: /^cancel$/i });
  await expect(cancel).toBeFocused();
  await cancel.click();
  await expect(trigger).toBeFocused();
  await expect(trigger).toBeVisible();

  await page.evaluate(async () => {
    const modulePath = '/src/state/useStore.ts';
    const { useStore } = (await import(modulePath)) as typeof import('../src/state/useStore');
    const original = useStore.getState().deleteMeasurement;
    let attempts = 0;
    document.documentElement.dataset.measurementDeleteAttempts = '0';
    useStore.setState({
      deleteMeasurement: async (...args) => {
        attempts += 1;
        document.documentElement.dataset.measurementDeleteAttempts = String(attempts);
        if (attempts === 1) return { status: 'stale' as const };
        return original(...args);
      },
    });
  });

  await trigger.click();
  dialog = page.getByRole('dialog', { name: /delete waist measurement/i });
  await dialog.getByRole('button', { name: /^delete$/i }).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement))
      throw new Error('delete-measurement button missing');
    button.click();
    button.click();
  });
  await expect(page.locator('html')).toHaveAttribute('data-measurement-delete-attempts', '1');
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeVisible();

  await dialog.getByRole('button', { name: /^delete$/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add measurement' })).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-measurement-delete-attempts', '2');
});

test('nutrition keeps optional targets and commits drafts on blur', async ({ page }) => {
  await installProgressSurfaceFixture(page);
  await page.getByRole('button', { name: /^progress$/i }).click();
  await page.evaluate(async () => {
    const modulePath = '/src/state/useStore.ts';
    const storeModule = (await import(modulePath)) as typeof import('../src/state/useStore');
    const original = storeModule.useStore.getState();
    const counters = { nutrition: 0, settings: 0 };
    document.documentElement.dataset.settingsWrites = '0';
    document.documentElement.dataset.nutritionWrites = '0';
    storeModule.useStore.setState({
      updateSettings: (...args) => {
        document.documentElement.dataset.settingsWrites = String(++counters.settings);
        return original.updateSettings(...args);
      },
      saveNutritionDay: (...args) => {
        document.documentElement.dataset.nutritionWrites = String(++counters.nutrition);
        if (args[1].kcal === 999) return Promise.reject(new Error('expected nutrition failure'));
        return original.saveNutritionDay(...args);
      },
    });
  });
  await page.getByRole('tab', { name: 'Nutrition' }).click();

  await expect(page.getByText('No nutrition entries yet', { exact: true })).toBeVisible();
  await expect(page.getByText(/meal examples/i)).toHaveCount(0);
  const calories = page.getByLabel('Calories (kcal)');
  const protein = page.getByLabel('Protein (g)');
  await expect(page.getByText('No calorie target', { exact: true })).toBeVisible();
  await expect(page.getByText('No protein target', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Targets' }).click();
  const target = page.getByLabel('Calorie target (kcal)');
  await expect(page.locator('.nutrition-today input[placeholder]')).toHaveCount(0);
  await target.fill('2500');
  await expect(page.locator('html')).toHaveAttribute('data-settings-writes', '0');
  await protein.focus();
  await expect(page.locator('html')).toHaveAttribute('data-settings-writes', '1');

  await calories.fill('2100');
  await expect(page.locator('html')).toHaveAttribute('data-nutrition-writes', '0');
  await protein.focus();
  await expect(page.locator('html')).toHaveAttribute('data-nutrition-writes', '1');
  await calories.fill('999');
  await protein.focus();
  await expect(page.getByRole('alert')).toContainText('Could not save nutrition');
  await calories.fill('0');
  await protein.focus();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('0 of 2,500 kcal', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Nutrition' }).click();
  await expect(calories).toHaveValue('0');
  await expect(page.getByText('0 of 2,500 kcal', { exact: true })).toBeVisible();
  const recent = page.getByRole('region', { name: 'Recent days' });
  await expect(recent.getByRole('listitem')).toHaveCount(1);

  const prior = '2026-08-24';
  await putStoredRow(page, 'nutrition', { id: prior, date: prior, kcal: 2000, proteinG: 120 });
  await page.reload();
  await page.getByRole('tab', { name: 'Nutrition' }).click();
  await expect(recent.getByRole('listitem')).toHaveCount(2);

  await expectNarrowTouchTargets(
    page,
    page.locator('input[name="calories"], input[name="protein"], .nutrition-targets-toggle'),
  );
});

test('profile persists real units without personal setup fields', async ({ page }) => {
  await installProfileSurfaceFixture(page);
  await page.getByRole('button', { name: 'Profile' }).click();
  const profile = page.getByRole('main');
  const summary = profile.getByRole('group', { name: 'Training summary' });
  const units = profile.getByRole('group', { name: 'Weight units' });
  const kilograms = units.getByRole('button', { name: 'Kilograms (kg)' });
  const pounds = units.getByRole('button', { name: 'Pounds (lb)' });

  await expect(profile.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(profile.locator('input[type="date"]')).toHaveCount(0);
  await expect(profile.getByText('Offline', { exact: true })).toBeVisible();
  await expect(summary).toContainText('700 kg');
  await expect(profile.getByRole('button', { name: 'Full backup (JSON)' })).toBeVisible();
  await expect(profile.getByRole('button', { name: 'Export workouts (CSV)' })).toBeVisible();
  await pounds.click();
  await expect(kilograms).toHaveAttribute('aria-pressed', 'false');
  await expect(pounds).toHaveAttribute('aria-pressed', 'true');
  await expect(summary).toContainText('1,543.2 lb');
  await page.reload();
  await expect(summary).toContainText('1,543.2 lb');
  await expectNarrowTouchTargets(page, profile.getByRole('button'));
  await expectLightAndDarkSurfaces(page, profile.locator('.profile-identity'), pounds);
  await profile.getByRole('button', { name: 'Italiano' }).click();
  await expect(profile.getByRole('group', { name: 'Unità di peso' })).toBeVisible();
});

test('complete backup preview names every restored collection', async ({ page }) => {
  await openImportSurface(page);
  const screen = page.getByRole('main');
  await page.keyboard.press('Tab');
  await expect(screen.getByRole('button', { name: 'Back', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(screen.getByLabel('Choose a file')).toBeFocused();
  await expect(screen.getByRole('region', { name: 'Export' }).getByRole('button')).toHaveCount(2);
  expect(
    (await screen.locator('.file-picker-trigger').boundingBox())?.height,
  ).toBeGreaterThanOrEqual(48);
  await expectNarrowTouchTargets(page, screen.locator('button'));

  await uploadImportFixture(page, 'complete.json', JSON.stringify(COMPLETE_BACKUP));
  const preview = screen.getByRole('region', { name: 'Import preview' });
  await expect(preview.getByRole('heading', { name: 'Complete backup' })).toBeVisible();
  for (const row of [
    'Programs: 1',
    'Body measurements: 1',
    'Nutrition days: 1',
    'Custom exercises: 1',
    'Exercise notes: 1',
    'Routines: 1',
    'Workouts: 1',
    'Settings: 1',
  ])
    await expect(preview.getByRole('listitem', { name: row, exact: true })).toBeVisible();
  await expect(preview.getByRole('listitem')).toHaveCount(8);
  const restore = preview.getByRole('button', { name: 'Restore complete backup' });
  await expect(restore).toBeVisible();
  await expectLightAndDarkSurfaces(page, preview, restore);
});

test('an unreadable file clears the current preview without an unhandled rejection', async ({
  page,
}) => {
  await openImportSurface(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await uploadImportFixture(page, 'valid.json', JSON.stringify(COMPLETE_BACKUP));
  await expect(page.getByRole('button', { name: 'Restore complete backup' })).toBeVisible();
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = function () {
      if (this.name !== 'unreadable.json') return read.call(this);
      File.prototype.text = read;
      return Promise.reject(new Error('read failure'));
    };
  });

  await uploadImportFixture(page, 'unreadable.json', '{}');
  await expect.soft(page.getByRole('region', { name: 'Import preview' })).toHaveCount(0);
  await expect.soft(page.getByRole('button', { name: 'Restore complete backup' })).toHaveCount(0);
  await expect.soft(page.getByRole('alert')).toContainText('could not be read');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect.soft(pageErrors).toEqual([]);
});

test('legacy JSON and Hevy CSV keep workout-only previews', async ({ page }) => {
  await openImportSurface(page);
  const preview = page.getByRole('region', { name: 'Import preview' });
  await uploadImportFixture(page, 'legacy.json', JSON.stringify(LEGACY_BACKUP));
  await expect(preview.getByRole('heading', { name: 'Workout import' })).toBeVisible();
  await expect(preview).toContainText('1 new, 0 duplicates skipped');
  await expect(preview).toContainText('1 routine in the backup');
  await uploadImportFixture(
    page,
    'hevy.csv',
    'title,start_time,end_time,description,exercise_title,weight_kg,reps\nImported,20 giu 2026 14:13,,,Squat (Bilanciere),60,5',
  );
  await expect(preview).toContainText('hevy.csv');
  await expect(preview).toContainText('1 new, 0 duplicates skipped');
  await expect(preview).not.toContainText('routine in the backup');
  await expect(preview.getByRole('button', { name: 'Import workouts' })).toBeVisible();
});

test('restore outcomes stay truthful and busy submission stays single', async ({ page }) => {
  await openImportSurface(page, 'it');
  await uploadImportFixture(page, 'complete.json', JSON.stringify(COMPLETE_BACKUP));
  await page.evaluate(async () => {
    const modulePath = '/src/state/useStore.ts';
    const { BackupCloudSyncError, toast, useStore } = (await import(
      modulePath
    )) as typeof import('../src/state/useStore');
    const receipt = await useStore.getState().updateSettings({ unit: 'kg' });
    useStore.setState({
      restoreBackup: async () => {
        const root = document.documentElement;
        const outcome = root.dataset.nextRestore;
        root.dataset.restoreCalls = String(Number(root.dataset.restoreCalls ?? 0) + 1);
        root.dataset.restoreOutcome = outcome;
        if (outcome === 'cloud') throw new BackupCloudSyncError(new Error('cloud'));
        if (outcome === 'local') throw new Error('local');
        if (outcome === 'stale') {
          toast('');
          return { status: 'stale' as const };
        }
        await new Promise<void>(
          (resolve) =>
            ((document as Document & { releaseRestore?: () => void }).releaseRestore = resolve),
        );
        return receipt;
      },
    });
  });
  const root = page.locator('html');
  const confirm = page.locator('.import-confirm');
  await expect(confirm).toHaveText('Ripristina backup completo');
  for (const [outcome, message] of [
    [
      'cloud',
      'Backup ripristinato su questo dispositivo, ma la sincronizzazione cloud non è riuscita.',
    ],
    ['local', 'Impossibile completare il ripristino. Controlla il file e riprova.'],
  ] as const) {
    await root.evaluate((element, value) => (element.dataset.nextRestore = value), outcome);
    await confirm.click();
    await expect(root).toHaveAttribute('data-restore-outcome', outcome);
    await expect(page.getByRole('status')).toContainText(message);
    await expect(confirm).toBeEnabled();
  }
  await root.evaluate((element) => (element.dataset.nextRestore = 'stale'));
  await confirm.click();
  await expect(root).toHaveAttribute('data-restore-outcome', 'stale');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Importa dati' })).toBeVisible();

  await page.getByRole('button', { name: 'Indietro', exact: true }).click();
  await page.getByRole('button', { name: 'Importa o ripristina' }).click();
  await uploadImportFixture(page, 'complete.json', JSON.stringify(COMPLETE_BACKUP));
  await root.evaluate((element) => {
    element.dataset.nextRestore = 'pending';
    element.dataset.restoreCalls = '0';
  });
  const height = (await confirm.boundingBox())?.height;
  await confirm.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(root).toHaveAttribute('data-restore-calls', '1');
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveText('Ripristino…');
  expect((await confirm.boundingBox())?.height).toBe(height);
  await expectLightAndDarkSurfaces(page, page.locator('.import-preview'), confirm);
  await page.evaluate(() =>
    (document as Document & { releaseRestore?: () => void }).releaseRestore?.(),
  );
  await expect(page.getByRole('status')).toHaveText('Backup completo ripristinato');
  await expect(page.getByRole('heading', { name: 'Overload' })).toBeVisible();
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

test('active workout is reachable from Train via exactly one persistent Resume action', async ({
  page,
}) => {
  await startNeutralWorkout(page);
  await page.locator('.setcheck').first().click();
  // Minimize the workout, return to a non-Home tab: nothing is lost.
  await page.getByRole('button', { name: /minimize|riduci/i }).click();
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  const persistentResume = page.getByRole('button', {
    name: /full body a.*(resume|riprendi)$/i,
  });
  await expect(persistentResume).toHaveCount(1);
  await persistentResume.click();
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

test('active Home clears fixed navigation at 320px without a persistent Resume bar', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startNeutralWorkout(page);
  await page.getByRole('button', { name: /minimize|riduci/i }).click();
  await page.getByRole('button', { name: /^home$/i }).click();
  await page.setViewportSize({ width: 320, height: 700 });

  const bounds = await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const lastSection = document.querySelector<HTMLElement>('.page > section:last-of-type');
    const navigation = document.querySelector<HTMLElement>('nav[aria-label="Overload"]');
    if (!lastSection || !navigation) throw new Error('home clearance surfaces missing');
    return {
      contentBottom: lastSection.getBoundingClientRect().bottom,
      navigationTop: navigation.getBoundingClientRect().top,
      fixedClearance: window.innerHeight - navigation.getBoundingClientRect().top,
      rootScrollPaddingBottom: Number.parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingBottom,
      ),
    };
  });

  await expect(page.getByRole('button', { name: /full body a.*(resume|riprendi)$/i })).toHaveCount(
    0,
  );
  expect(bounds.contentBottom).toBeLessThanOrEqual(bounds.navigationTop);
  expect(bounds.rootScrollPaddingBottom).toBeGreaterThanOrEqual(bounds.fixedClearance);
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

test('hydrated custom exercises stay searchable and usable without the public catalog', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: () => 1,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: () => undefined,
    });
  });
  let releaseCatalog!: () => void;
  const catalogAllowed = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  let attempts = 0;
  await context.route('**/data/exercises.json', async (route) => {
    attempts += 1;
    if (attempts === 1) await catalogAllowed;
    await route.fulfill({ status: 503, contentType: 'application/json', body: '[]' });
  });
  const pageErrors: string[] = [];
  const coldPage = await context.newPage();
  coldPage.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await coldPage.goto('/');
    await putStoredRow(coldPage, 'customExercises', {
      id: 'custom:offline-carry',
      name: 'Offline carry',
      muscleGroup: 'back',
      updatedAt: 1,
    });
    await coldPage.reload();
    await expect(coldPage.getByRole('heading', { name: 'Overload' })).toBeVisible();

    await coldPage.getByRole('button', { name: 'Exercises' }).click();
    await expect.poll(() => attempts).toBe(1);
    await coldPage.getByRole('button', { name: 'Back', exact: true }).click();
    await coldPage.getByRole('searchbox', { name: 'Search exercises' }).fill('Offline carry');
    const customExercise = coldPage.getByRole('button', { name: 'Offline carry Back' });
    await expect(customExercise).toBeVisible();
    await expect(coldPage.getByText('No exercises found')).toHaveCount(0);

    await customExercise.click();
    await expect(coldPage.getByRole('heading', { name: 'Last time', exact: true })).toBeVisible();
    await expect(coldPage.locator('.exercise-detail__loading')).toHaveCount(0);

    releaseCatalog();
    await expect.poll(() => attempts).toBe(2);
    await expect(coldPage.getByRole('heading', { name: 'Offline carry' })).toBeVisible();
    await expect(coldPage.getByText('First time doing this exercise')).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    releaseCatalog();
    await context.close();
  }
});

test('cold empty screens defer the catalog until idle or first dependent use', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    let nextId = 0;
    const idleCallbacks = new Map<number, IdleRequestCallback>();
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        const id = ++nextId;
        idleCallbacks.set(id, callback);
        return id;
      },
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: (id: number) => idleCallbacks.delete(id),
    });
    (window as unknown as Window & { __flushCatalogIdle(): void }).__flushCatalogIdle = () => {
      for (const callback of idleCallbacks.values()) {
        callback({ didTimeout: false, timeRemaining: () => 50 });
      }
      idleCallbacks.clear();
    };
  });
  let catalogRequests = 0;
  context.on('request', (request) => {
    if (new URL(request.url()).pathname === '/data/exercises.json') catalogRequests += 1;
  });
  const coldPage = await context.newPage();
  try {
    await coldPage.goto('/');
    await expect(coldPage.getByRole('heading', { name: 'Overload' })).toBeVisible();
    expect(catalogRequests).toBe(0);

    await coldPage.getByRole('button', { name: 'Train' }).click();
    await expect(coldPage.getByRole('heading', { name: 'Train' })).toBeVisible();
    await expect(coldPage.locator('.route-fallback')).toHaveCount(0);
    await coldPage.evaluate(() =>
      (window as unknown as Window & { __flushCatalogIdle(): void }).__flushCatalogIdle(),
    );
    expect(catalogRequests).toBe(0);

    await coldPage.getByRole('button', { name: 'Exercises' }).click();
    await expect.poll(() => catalogRequests).toBe(1);
    await expect(coldPage.getByRole('searchbox', { name: 'Search exercises' })).toBeVisible();

    catalogRequests = 0;
    await coldPage.evaluate(() => localStorage.setItem('overload_route', 'home'));
    await coldPage.close();
    const idlePage = await context.newPage();
    await idlePage.goto('/');
    await expect(idlePage.getByRole('heading', { name: 'Overload' })).toBeVisible();
    expect(catalogRequests).toBe(0);
    await idlePage.evaluate(() =>
      (window as unknown as Window & { __flushCatalogIdle(): void }).__flushCatalogIdle(),
    );
    await expect.poll(() => catalogRequests).toBe(1);
  } finally {
    await context.close();
  }
});

test('catalog failure stays contained and retries once while already online', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: () => 1,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: () => undefined,
    });
  });
  let attempts = 0;
  await context.route('**/data/exercises.json', async (route) => {
    attempts += 1;
    await route.fulfill({
      status: attempts === 1 ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        attempts === 1
          ? []
          : [
              {
                id: 'Barbell_Squat',
                name: 'Barbell Squat',
                primaryMuscles: ['quadriceps'],
                instructions: [],
                images: [],
              },
            ],
      ),
    });
  });
  const pageErrors: string[] = [];
  const coldPage = await context.newPage();
  coldPage.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await coldPage.goto('/');
    await coldPage.getByRole('button', { name: 'Exercises' }).click();
    await expect.poll(() => attempts).toBe(1);
    await expect(coldPage.getByRole('status', { name: 'Loading exercises' })).toBeVisible();

    await expect.poll(() => attempts).toBe(2);
    await expect(coldPage.getByRole('button', { name: 'Barbell Squat Legs' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('visible workout rows refresh their exercise names when the catalog resolves', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: () => 1,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: () => undefined,
    });
  });
  let releaseCatalog!: () => void;
  const catalogAllowed = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  await context.route('**/data/exercises.json', async (route) => {
    await catalogAllowed;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'opaque-id',
          name: 'Resolved name',
          primaryMuscles: ['abdominals'],
          instructions: [],
          images: [],
        },
      ]),
    });
  });
  const coldPage = await context.newPage();
  try {
    await coldPage.goto('/');
    await expect(coldPage.getByRole('heading', { name: 'Overload' })).toBeVisible();
    await putStoredRow(coldPage, 'workouts', {
      ...PROFILE_VOLUME_WORKOUT,
      id: 'catalog-name-workout',
      dayLabel: 'Catalog refresh',
      sets: [
        {
          exerciseId: 'opaque-id',
          weightKg: 20,
          reps: 5,
          done: true,
          kind: 'working',
        },
      ],
    });
    await coldPage.reload();
    await expect(coldPage.getByRole('heading', { name: 'Overload' })).toBeVisible();
    await coldPage.getByRole('button', { name: 'All history' }).click();
    const workout = coldPage.getByRole('button', { name: /Catalog refresh/i });
    await expect(workout).toContainText('opaque id');

    releaseCatalog();
    await expect(workout).toContainText('Resolved name');
    await expect(workout).not.toContainText('opaque id');
  } finally {
    releaseCatalog();
    await context.close();
  }
});

test('CSV export waits for exercise names while the full backup stays available', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: () => 1,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: () => undefined,
    });
  });
  let releaseCatalog!: () => void;
  const catalogAllowed = new Promise<void>((resolve) => {
    releaseCatalog = resolve;
  });
  await context.route('**/data/exercises.json', async (route) => {
    await catalogAllowed;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const coldPage = await context.newPage();
  try {
    await coldPage.goto('/');
    await expect(coldPage.getByRole('heading', { name: 'Overload' })).toBeVisible();
    await putStoredRow(coldPage, 'workouts', PROFILE_VOLUME_WORKOUT);
    await coldPage.reload();
    await expect(coldPage.getByRole('heading', { name: 'Overload' })).toBeVisible();
    await coldPage.getByRole('button', { name: 'Profile' }).click();

    await expect(coldPage.getByRole('group', { name: 'Training summary' })).toContainText(
      '1 workout',
    );
    await expect(coldPage.getByRole('button', { name: 'Full backup (JSON)' })).toBeEnabled();
    await expect(coldPage.getByRole('button', { name: 'Export workouts (CSV)' })).toBeDisabled();
    releaseCatalog();
    await expect(coldPage.getByRole('button', { name: 'Export workouts (CSV)' })).toBeEnabled();
  } finally {
    releaseCatalog();
    await context.close();
  }
});

test('recovered workout opens directly without a route fallback or Home flash', async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const setup = await context.newPage();
  await setup.goto('/');
  await installNeutralTemplate(setup);
  await setup.getByRole('button', { name: 'Start Full Body A' }).click();
  await expect(setup.getByText('Full Body A').first()).toBeVisible();
  await setup.close();

  const recovered = await context.newPage();
  try {
    await recovered.goto('/');
    await expect(recovered.locator('.route-fallback')).toHaveCount(0);
    await expect(
      recovered.getByRole('heading', { name: /next workout|build your plan/i }),
    ).toHaveCount(0);
    await expect(recovered.getByText('Full Body A').first()).toBeVisible();
  } finally {
    await context.close();
  }
});
