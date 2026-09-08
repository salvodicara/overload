import { test, expect, type Page } from '@playwright/test';
async function boot(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('navigation').first()).toBeVisible();
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .find((n) => n.includes('/state/useStore.ts'))!;
    (window as any).auditStore = (await import(url)).useStore;
  });
}
async function prepare(page: Page) {
  await page.evaluate(async () => {
    const s = (window as any).auditStore;
    await s.getState().saveRoutine({
      id: 'deep-routine',
      name: 'Audit routine',
      updatedAt: 1,
      exercises: [
        {
          exerciseId: 'barbell-squat',
          sets: 1,
          repMin: 5,
          repMax: 5,
          restSec: 30,
          startWeightKg: 40,
        },
        {
          exerciseId: 'barbell-squat',
          sets: 1,
          repMin: 12,
          repMax: 12,
          restSec: 150,
          startWeightKg: 20,
        },
      ],
    });
  });
}
test('invalid routine draft survives reload without replacing the last valid routine', async ({
  page,
}) => {
  await boot(page);
  await prepare(page);
  await page.evaluate(() =>
    (window as any).auditStore.getState().nav({ view: 'routineEditor', id: 'deep-routine' }),
  );
  const sets = page.getByRole('spinbutton', { name: 'Working sets', exact: true }).first();
  await sets.fill('-1');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  page.on('dialog', (d) => d.accept());
  await page.reload();
  await boot(page);
  await page.evaluate(() =>
    (window as any).auditStore.getState().nav({ view: 'routineEditor', id: 'deep-routine' }),
  );
  await expect(
    page.getByRole('spinbutton', { name: 'Working sets', exact: true }).first(),
  ).toHaveValue('-1');
  await boot(page);
  expect(
    await page.evaluate(
      () =>
        (window as any).auditStore.getState().routines.find((r: any) => r.id === 'deep-routine')
          .exercises[0].sets,
    ),
  ).toBe(1);
});
test('repeated exercise keeps its own target and rest deadline through reload', async ({
  page,
}) => {
  await boot(page);
  await prepare(page);
  await page.evaluate(() => {
    const s = (window as any).auditStore.getState();
    s.startWorkout('deep-routine');
    s.toggleDone(1, 0);
    s.updateSet(0, 0, { weightKg: 42 });
  });
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('overload_active')!).restUntil,
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('overload_active')!).ex[1].sets[0].reps,
    ),
  ).toBe(12);
  expect(before).toBeGreaterThan(Date.now() + 120000);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('overload_active')!).restUntil),
  ).toBe(before);
});
test('invalid active loads cannot be marked complete or saved in history', async ({ page }) => {
  await boot(page);
  await prepare(page);
  await page.evaluate(() => {
    const s = (window as any).auditStore.getState();
    s.startWorkout('deep-routine');
    s.updateSet(0, 0, { weightKg: -10, reps: 8 });
    s.toggleDone(0, 0);
  });
  expect(
    await page.evaluate(() => (window as any).auditStore.getState().active.ex[0].sets[0].done),
  ).toBe(false);
  await expect(
    page.getByText(
      'Enter a non-negative load and whole repetitions, or a duration greater than zero.',
    ),
  ).toBeVisible();
});

test('measurement form fits a narrow screen with doubled text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await boot(page);
  await page.evaluate(() => (window as any).auditStore.getState().nav({ view: 'body' }));
  await page.getByRole('button', { name: 'Add measurement', exact: true }).click();
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('main *')].filter(
      (e) => !(e instanceof SVGElement),
    );
    const sizes = nodes.map((e) => ({
      element: e,
      size: parseFloat(getComputedStyle(e).fontSize),
    }));
    for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('historical editor does not display weighted history as zero seconds', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const s = (window as any).auditStore;
    const base = { date: '2026-09-08', startTs: 1, updatedAt: 1, source: 'app', volumeKg: 0 };
    s.setState({
      workouts: [
        { ...base, id: 'old', sets: [{ exerciseId: 'Plank', done: true, weightKg: 20, reps: 8 }] },
        {
          ...base,
          id: 'timed',
          startTs: 2,
          sets: [
            {
              exerciseId: 'Plank',
              done: true,
              weightKg: 0,
              reps: 0,
              durationSec: 45,
              tracking: 'duration',
            },
          ],
        },
      ],
    });
    s.getState().nav({ view: 'workoutEditor', id: 'timed' });
  });
  await expect(page.locator('.workout-editor-set .set-previous')).toHaveText('—');
});
