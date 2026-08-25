import { expect, test, type Page } from '@playwright/test';

const NEUTRAL_ROUTINE = /full body a/i;

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
    .getByRole('button', { name: /set 1|serie 1/i })
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

test('technique and session notes persist across distinct workouts', async ({ page }) => {
  await startNeutralWorkout(page);
  await page
    .getByRole('button', { name: /cues to keep|indicazioni da mantenere/i })
    .first()
    .click();
  await page.getByLabel(/^technique|^tecnica/i).fill('Seat at 4');
  await page.locator('.setrow input').first().click();
  await page
    .getByRole('button', { name: /how this exercise felt|com'è andato/i })
    .first()
    .click();
  await page.getByLabel(/^this session|^questa sessione/i).fill('First session');
  await completeAndFinishOneSet(page);

  await startNeutralWorkout(page);
  await expect(page.getByText(/seat at 4/i).first()).toBeVisible();
  await page
    .getByRole('button', { name: /how this exercise felt|com'è andato/i })
    .first()
    .click();
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
