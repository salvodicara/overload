import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('navigation').first()).toBeVisible();
  await page.evaluate(async () => {
    const url = performance
      .getEntriesByType('resource')
      .map((x) => x.name)
      .find((x) => x.includes('/state/useStore.ts'))!;
    (window as any).browseStore = (await import(url)).useStore;
  });
}
async function seed(page: Page, count = 1) {
  await page.evaluate((count) => {
    const s = (window as any).browseStore;
    s.setState({
      workouts: Array.from({ length: count }, (_, i) => ({
        id: `browse-${i}`,
        date: '2026-09-08',
        startTs: 1000 + i,
        sets: [{ exerciseId: 'audit-exercise', weightKg: 80, reps: 8, done: true }],
        volumeKg: 640,
        source: 'app',
        updatedAt: 1,
        dayLabel: 'Workout',
      })),
    });
    s.getState().nav({ view: 'history' });
  }, count);
}

test('missing workout and summary do not push routes while rendering', async ({ page }) => {
  await boot(page);
  for (const route of [
    { view: 'workoutDetail', id: 'missing' },
    { view: 'summary', workoutId: 'missing' },
  ]) {
    await page.evaluate((route) => (window as any).browseStore.getState().nav(route), route);
    await expect(
      page.getByRole('status').filter({ hasText: /no longer available/i }),
    ).toBeVisible();
    expect(await page.evaluate(() => (window as any).browseStore.getState().route.view)).toBe(
      route.view,
    );
  }
});
test('workout option save locks while pending and reports failures', async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.locator('.workout-row').click();
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.evaluate(() => {
    const w = window as any;
    w.saveCalls = 0;
    w.browseStore.setState({
      saveWorkoutAsRoutine: () => {
        w.saveCalls++;
        return new Promise((_r, j) => {
          w.rejectSave = j;
        });
      },
    });
  });
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await save.click();
  await expect(save).toBeDisabled();
  await page.evaluate(() => (window as any).rejectSave(new Error('storage failed')));
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(save).toBeEnabled();
  expect(await page.evaluate(() => (window as any).saveCalls)).toBe(1);
});
test('removed routine filter no longer hides history behind All routines', async ({ page }) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() =>
    (window as any).browseStore.setState({ routines: [{ id: 'old', name: 'Old', exercises: [] }] }),
  );
  await page.getByRole('combobox', { name: 'Filter by routine' }).selectOption('old');
  await page.evaluate(() => (window as any).browseStore.setState({ routines: [] }));
  await expect(page.locator('.workout-row')).toHaveCount(1);
});
test('exercise catalog failure keeps local performance and a retry action', async ({ page }) => {
  await page.route('**/data/exercises.json', (route) => route.abort());
  await boot(page);
  await seed(page);
  await page.evaluate(() =>
    (window as any).browseStore.getState().nav({ view: 'exercise', id: 'audit-exercise' }),
  );
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByText('80 kg × 8', { exact: true }).first()).toBeVisible();
});
test('long workout label wraps within exercise details at320', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await boot(page);
  await seed(page);
  await page.evaluate(() => {
    const s = (window as any).browseStore;
    s.setState({
      workouts: s
        .getState()
        .workouts.map((w: any) => ({ ...w, dayLabel: 'VeryLongUnbrokenWorkoutName'.repeat(6) })),
    });
    s.getState().nav({ view: 'exercise', id: 'audit-exercise' });
  });
  await expect(page.getByText('Last time', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
test('Back restores long History scroll after short detail commits', async ({ page }) => {
  await boot(page);
  await seed(page, 100);
  await page.evaluate(() => scrollTo(0, 1000));
  await page.evaluate(() =>
    (window as any).browseStore.getState().nav({ view: 'workoutDetail', id: 'browse-0' }),
  );
  await expect(page.getByRole('button', { name: 'Workout options' })).toBeVisible();
  await page.goBack();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(1000);
});
test('NoteEditor locks its textarea while Done is saving', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource').map((x) => x.name);
    const React = await import(resources.find((x) => /\/react\.js\?/.test(x))!);
    const dom = await import(resources.find((x) => /react-dom_client\.js\?/.test(x))!);
    const componentUrl = '/src/components/NoteEditor.tsx';
    const { NoteEditor } = await import(componentUrl);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;background:white;width:300px';
    document.body.append(host);
    dom.default
      .createRoot(host)
      .render(
        React.default.createElement(NoteEditor, {
          initial: 'A',
          placeholder: 'Audit note',
          labelledBy: 'audit-note',
          doneLabel: 'Audit Done',
          onChangeText: () => {},
          onDone: () => new Promise(() => {}),
        }),
      );
  });
  const field = page.getByPlaceholder('Audit note');
  await expect(field).toBeVisible();
  await page.getByRole('button', { name: 'Audit Done', exact: true }).click();
  await expect(field).toBeDisabled();
});
test('account transition drops old filters and Back cannot reopen old account entries', async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await page.evaluate(() =>
    (window as any).browseStore.setState({ routines: [{ id: 'old', name: 'Old', exercises: [] }] }),
  );
  await page.getByRole('combobox', { name: 'Filter by routine' }).selectOption('old');
  await page.evaluate(async () => {
    const s = (window as any).browseStore;
    s.getState().setUser({ uid: 'browse-other-account', name: 'Other' });
    await s.getState().init();
  });
  await seed(page);
  await expect(page.locator('.workout-row')).toHaveCount(1);
  await page.goBack();
  await page.goBack();
  expect(await page.evaluate(() => history.state?.surfaces?.history?.routineId ?? '')).toBe('');
});
test('delete returns once to history and Back does not loop through a missing workout', async ({
  page,
}) => {
  await boot(page);
  await seed(page);
  await page.locator('.workout-row').click();
  await page.evaluate(async () => {
    const s = (window as any).browseStore;
    const receipt = await s.getState().createCustomExercise('Synthetic receipt', 'core');
    s.setState({
      deleteWorkout: async (id: string) => {
        s.setState({ workouts: s.getState().workouts.filter((w: any) => w.id !== id) });
        return { ...receipt, value: undefined };
      },
    });
  });
  await page.getByRole('button', { name: 'Workout options' }).click();
  await page.getByRole('button', { name: 'Delete workout', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.history-screen')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.home-screen')).toBeVisible();
});
