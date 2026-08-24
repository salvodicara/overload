import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('overload');
  });
  await page.reload();
  // First run: pick a starter template, then set the program date.
  await page.getByRole('button', { name: /pick a plan|scegli una scheda/i }).click();
  await page.getByRole('button', { name: /^(use|usa)$/i }).first().click();
  await expect(page.getByText(/edit routine|modifica scheda/i).first()).toBeVisible();
  await page.getByRole('button', { name: /train|allenati/i }).click();
  await page.getByRole('button', { name: /start today|inizio oggi/i }).click();
});

test('log a workout end to end', async ({ page }) => {
  await page.getByRole('button', { name: /^(start|inizia)$/i }).first().click();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();

  const checks = page.locator('.setcheck');
  await checks.nth(0).click();
  await expect(page.locator('.restbar')).toBeVisible();
  await checks.nth(1).click();

  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await expect(page.getByText(/kg of volume|kg di volume/i)).toBeVisible();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();

  await page.getByRole('button', { name: /history|storico/i }).click();
  await expect(page.locator('.card').first()).toBeVisible();
});

test('empty session is discarded, not recorded', async ({ page }) => {
  await page.getByRole('button', { name: /^(start|inizia)$/i }).first().click();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();
  // Leave without completing any set: no confirmation, nothing recorded.
  await page.locator('.iconbtn').first().click();
  await expect(page.getByRole('button', { name: /^(start|inizia)$/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /history|storico/i }).click();
  await expect(page.getByText(/no workouts yet|ancora nessun allenamento/i)).toBeVisible();
});

test('no horizontal overflow on any tab', async ({ page }) => {
  for (const tab of [/history|storico/i, /progress|progressi/i, /exercises|esercizi/i, /more|altro/i, /train|allenati/i]) {
    await page.getByRole('button', { name: tab }).click();
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `overflow on ${tab}`).toBeLessThanOrEqual(0);
  }
});

test('workout in progress survives reload', async ({ page }) => {
  await page.getByRole('button', { name: /^(start|inizia)$/i }).first().click();
  await page.locator('.setcheck').first().click();
  await page.reload();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();
  await expect(page.locator('.setrow.done')).toHaveCount(1);
});
