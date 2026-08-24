import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('overload');
  });
  await page.reload();
});

test('log a workout end to end', async ({ page }) => {
  await page.getByRole('button', { name: /start today|inizio oggi/i }).click();
  await page.getByRole('button', { name: /up next|tocca a lui/i }).click();
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

test('workout in progress survives reload', async ({ page }) => {
  await page.getByRole('button', { name: /start today|inizio oggi/i }).click();
  await page.getByRole('button', { name: /up next|tocca a lui/i }).click();
  await page.locator('.setcheck').first().click();
  await page.reload();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();
  await expect(page.locator('.setrow.done')).toHaveCount(1);
});
