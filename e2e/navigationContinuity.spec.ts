import { expect, test, type Page } from '@playwright/test';

async function store(page: Page) {
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .find((n) => n.includes('/state/useStore.ts'))!;
    (window as any).navigationStore = (await import(url)).useStore;
  });
}
async function setup(page: Page) {
  await page.goto('/');
  await expect(page.locator('.nav')).toBeVisible();
  await store(page);
  await page.evaluate(async () => {
    const s = (window as any).navigationStore.getState();
    await s.saveRoutine({
      id: 'navigation-routine',
      name: 'Navigation routine',
      updatedAt: 1,
      exercises: Array.from({ length: 14 }, (_, i) => ({
        exerciseId: 'Barbell_Squat',
        occurrenceId: 'nav-' + i,
        sets: 2,
        repMin: 6,
        repMax: 10,
        restSec: 60,
        startWeightKg: 40,
        note: 'Technique ' + i,
      })),
    });
    await s.ensureCatalog();
    s.nav({ view: 'routine', id: 'navigation-routine' });
  });
  await expect(page.locator('.routine-preview')).toBeVisible();
}

test('routine exercise reload and Back restore the exact route and scroll', async ({ page }) => {
  await setup(page);
  const last = page.locator('.routine-preview__exercise').last();
  await last.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await last.click();
  await expect(page.locator('.exercise-detail')).toBeVisible();
  await page.reload();
  await expect(page.locator('.exercise-detail')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.routine-preview')).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
  await expect(page.locator('.routine-preview__exercise').last()).toBeFocused();
});

test('import text and caret survive refresh on the same screen', async ({ page }) => {
  await setup(page);
  await page.evaluate(() =>
    (window as any).navigationStore.getState().nav({ view: 'routineImport' }),
  );
  const text = page.locator('textarea').first();
  await text.fill('A plan draft still being edited');
  await text.evaluate((e: HTMLTextAreaElement) => e.setSelectionRange(7, 12, 'backward'));
  await page.reload();
  await expect(page.locator('textarea').first()).toHaveValue('A plan draft still being edited');
  await expect(page.locator('textarea').first()).toBeFocused();
  await expect
    .poll(() =>
      page
        .locator('textarea')
        .first()
        .evaluate((e: HTMLTextAreaElement) => [
          e.selectionStart,
          e.selectionEnd,
          e.selectionDirection,
        ]),
    )
    .toEqual([7, 12, 'backward']);
});

test('active workout does not hijack a refreshed exercise detail', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Barbell Squat', exact: true }).first().click();
  await expect(page.locator('.exercise-detail')).toBeVisible();
  await page.reload();
  await expect(page.locator('.exercise-detail')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.workout-header')).toBeVisible();
});

async function completedWorkout(page: Page) {
  await page.evaluate(async () => {
    const s = (window as any).navigationStore.getState();
    s.startWorkout('navigation-routine');
    s.toggleDone(0, 0);
    await s.finishWorkout();
  });
  await expect(page.locator('.summary-pop')).toBeVisible();
  return page.evaluate(() => (window as any).navigationStore.getState().workouts[0].id as string);
}

test('all route payloads survive refresh including nested food and picker routes', async ({
  page,
}) => {
  test.setTimeout(60000);
  await setup(page);
  const id = await completedWorkout(page);
  await page.evaluate(() =>
    (window as any).navigationStore.getState().startWorkout('navigation-routine'),
  );
  const routes = [
    { view: 'home' },
    { view: 'train' },
    { view: 'profile' },
    { view: 'settings' },
    { view: 'history', mode: 'calendar' },
    { view: 'body' },
    { view: 'diet' },
    { view: 'foodAdd', date: '2026-09-07', meal: 'snack' },
    { view: 'foodEdit', date: '2026-09-07', entryId: 'missing-entry' },
    { view: 'foodTotals', date: '2026-09-07' },
    { view: 'foodImport' },
    { view: 'routineImport' },
    { view: 'importExport' },
    { view: 'workout' },
    { view: 'summary', workoutId: id },
    { view: 'workoutDetail', id },
    { view: 'workoutEditor', id },
    { view: 'progress', exerciseId: 'Barbell_Squat' },
    { view: 'library', pickFor: { routineId: 'navigation-routine' } },
    { view: 'library', pickFor: { activeWorkout: true } },
    { view: 'exercise', id: 'Barbell_Squat', from: 'routine' },
    { view: 'routine', id: 'navigation-routine' },
    { view: 'routineEditor', id: 'navigation-routine' },
  ];
  for (const route of routes) {
    await page.evaluate((r) => (window as any).navigationStore.getState().nav(r), route);
    await page.reload();
    await expect(page.locator('#main-content .screen')).toBeVisible();
    await store(page);
    expect(
      await page.evaluate(() => (window as any).navigationStore.getState().route),
      JSON.stringify(route),
    ).toEqual(route);
    await expect(page.locator('#main-content')).not.toBeEmpty();
  }
});

test('workout edits, caret and scroll survive refresh and a Back/Forward round trip', async ({
  page,
}) => {
  await setup(page);
  const id = await completedWorkout(page);
  await page.evaluate(
    (id) => (window as any).navigationStore.getState().nav({ view: 'workoutEditor', id }),
    id,
  );
  const name = page.locator('.workout-editor-meta input').first();
  await name.fill('Edited workout draft');
  await name.evaluate((e: HTMLInputElement) => e.setSelectionRange(3, 8));
  await page.reload();
  await expect(name).toHaveValue('Edited workout draft');
  await expect(name).toBeFocused();
  await page.goBack();
  await expect(page.locator('.summary-pop')).toBeVisible();
  await page.goForward();
  await expect(name).toHaveValue('Edited workout draft');
  await expect(name).toBeFocused();
  expect(await name.evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd])).toEqual([
    3, 8,
  ]);
});

test('routine picker returns to the original editor entry without a duplicate in Back history', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() =>
    (window as any).navigationStore
      .getState()
      .nav({ view: 'routineEditor', id: 'navigation-routine' }),
  );
  const editorEntry = await page.evaluate(() => history.state.entryKey);
  await page.evaluate(() =>
    (window as any).navigationStore
      .getState()
      .nav({ view: 'library', pickFor: { routineId: 'navigation-routine' } }),
  );
  await page.getByRole('searchbox').fill('Barbell Squat');
  await page
    .getByRole('list', { name: /exercise results/i })
    .getByRole('button')
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => history.state.entryKey)).toBe(editorEntry);
  await page.goBack();
  await expect(page.locator('.routine-preview')).toBeVisible();
});

test('nutrition raw values survive refresh before blur and remain date-specific', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() =>
    (window as any).navigationStore.getState().nav({ view: 'foodTotals', date: '2026-09-07' }),
  );
  const calories = page.locator('input[name="calories"]');
  await calories.fill('1234');
  await page.reload();
  await expect(calories).toHaveValue('1234');
  await expect(calories).toBeFocused();
  await store(page);
  expect(
    await page.evaluate(() =>
      (window as any).navigationStore.getState().nutrition.some((n: any) => n.id === '2026-09-07'),
    ),
  ).toBe(false);
  await page.locator('input[type="date"]').first().fill('2026-09-06');
  await expect(calories).toHaveValue('');
});

test('custom food draft restores expanded micronutrients and the focused field', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() =>
    (window as any).navigationStore
      .getState()
      .nav({ view: 'foodAdd', date: '2026-09-07', meal: 'lunch' }),
  );
  await page.getByRole('button', { name: 'Create food', exact: true }).click();
  await page.getByLabel('Food name', { exact: true }).fill('Homemade lunch');
  await page.locator('details summary').click();
  const last = page.locator('details input').last();
  await last.fill('22');
  const y = await page.evaluate(() => scrollY);
  await page.reload();
  await expect(page.getByLabel('Food name', { exact: true })).toHaveValue('Homemade lunch');
  await expect(last).toHaveValue('22');
  await expect(last).toBeFocused();
  await expect(last).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
});

test('routine creation sheet restores its draft and returns focus to its original trigger', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => (window as any).navigationStore.getState().nav({ view: 'train' }));
  const trigger = page.getByRole('button', { name: 'Create', exact: true });
  await trigger.click();
  await page.getByRole('button', { name: 'New routine', exact: true }).click();
  const input = page.getByRole('dialog').getByRole('textbox');
  await input.fill('A routine draft');
  await input.evaluate((e: HTMLInputElement) => e.setSelectionRange(2, 9));
  await page.reload();
  await expect(input).toHaveValue('A routine draft');
  await expect(input).toBeFocused();
  expect(await input.evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd])).toEqual(
    [2, 9],
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(trigger).toBeFocused();
});

test('slow exercise catalog still restores a deep library position and its focused row', async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => (window as any).navigationStore.getState().nav({ view: 'library' }));
  const row = page
    .getByRole('list', { name: /exercise results/i })
    .getByRole('button')
    .nth(45);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.locator('.exercise-detail')).toBeVisible();
  await page.goBack();
  await expect(row).toBeFocused();
  const y = await page.evaluate(() => scrollY);
  expect(y).toBeGreaterThan(500);
  await page.route('**/data/exercises.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3200));
    await route.continue();
  });
  await page.reload();
  await expect(row).toBeFocused({ timeout: 8000 });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
});

test('a scrolled custom exercise sheet restores its inner scroll and draft', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 393, height: 300 });
  await page.evaluate(() => (window as any).navigationStore.getState().nav({ view: 'library' }));
  await page.getByRole('button', { name: /create custom exercise/i }).click();
  const input = page.getByRole('dialog').getByRole('textbox');
  await input.fill('Custom exercise draft');
  const panel = page.getByRole('dialog').locator('.sheet');
  const top = await panel.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return el.scrollTop;
  });
  expect(top).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => Object.values(sessionStorage).some((s) => s.includes('"containers"'))),
    )
    .toBe(true);
  await page.reload();
  await expect(input).toHaveValue('Custom exercise draft');
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeCloseTo(top, 0);
});
