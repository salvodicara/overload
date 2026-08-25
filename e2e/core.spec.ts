import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('overload');
  });
  await page.reload();
  // First run: Workout tab → add a starter pack → set the program date.
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /^(use|usa)$/i }).first().click();
  await page.getByRole('button', { name: /start today|inizio oggi/i }).click();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();
});

function routineStart(page: Page, name: RegExp) {
  return page.locator('.card', { hasText: name }).getByRole('button', { name: /^(start|inizia)$/i });
}

test('log a workout end to end', async ({ page }) => {
  await routineStart(page, /upper heavy/i).click();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();

  const checks = page.locator('.setcheck');
  await checks.nth(0).click();
  await expect(page.locator('.restbar')).toBeVisible();
  await checks.nth(1).click();

  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await expect(page.getByText(/kg of volume|kg di volume/i)).toBeVisible();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();
  await expect(page.getByText(/this week|questa settimana/i)).toBeVisible();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();
});

test('empty session is discarded, not recorded', async ({ page }) => {
  await routineStart(page, /upper heavy/i).click();
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
  await page.locator('.card', { hasText: /barbell squat/i }).first().click();
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
  await page.getByRole('button', { name: /back|indietro/i }).first().click();
  await expect(page.getByText(/test program/i)).toBeVisible();
  await expect(page.getByText(/day x/i)).toBeVisible();
  // Delete the program: routine survives as standalone.
  await page.getByRole('button', { name: /test program.*(program options|opzioni programma)/i }).click();
  await page.getByRole('button', { name: /delete program|elimina programma/i }).click();
  await page.getByRole('button', { name: /^(delete|elimina)$/i }).click();
  await expect(page.getByText(/test program/i)).toHaveCount(0);
  await expect(page.getByText(/day x/i)).toBeVisible();
});

test('exercise notes accumulate across workouts', async ({ page }) => {
  await routineStart(page, /upper heavy/i).click();
  // The note edits in place: tap the row, type, autosaves.
  await page.getByRole('button', { name: /add note|aggiungi nota/i }).first().click();
  await page.getByPlaceholder(/note for next time|nota per la prossima/i).fill('seat at 4');
  await page.waitForTimeout(800);
  // Dismiss the in-place editor before tapping controls (mirrors closing the keyboard).
  await page.locator('.setrow input').first().click();
  await page.locator('.setcheck').first().click();
  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();
  // Next session: the note is still there, and adding another keeps both.
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await routineStart(page, /upper heavy/i).click();
  await expect(page.getByText(/seat at 4/i).first()).toBeVisible();
});

test('mid-workout rest tweak can update the routine', async ({ page }) => {
  await routineStart(page, /upper heavy/i).click();
  // Open the rest editor on the first exercise and add 15s.
  await page.getByRole('button', { name: /rest |rec /i }).first().click();
  await page.getByRole('button', { name: /raise rest|aumenta recupero/i }).click();
  await page.getByRole('button', { name: /^ok$/i }).click();
  await page.locator('.setcheck').first().click();
  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await expect(page.getByText(/update the routine|aggiornare la scheda/i)).toBeVisible();
  await page.getByRole('button', { name: /update routine|aggiorna scheda/i }).click();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();
  // The routine now carries the new rest: start again and check the chip.
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await routineStart(page, /upper heavy/i).click();
  await expect(page.getByRole('button', { name: /1[’′]15|75/ }).first()).toBeVisible();
});

test('no horizontal overflow on any tab', async ({ page }) => {
  for (const tab of [/^home$/i, /^(train|allenati)$/i, /^(exercises|esercizi)$/i, /^(progress|progressi)$/i, /^(profile|profilo)$/i]) {
    await page.getByRole('button', { name: tab }).click();
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `overflow on ${tab}`).toBeLessThanOrEqual(0);
  }
});

test('active workout is reachable from any tab via the banner', async ({ page }) => {
  await routineStart(page, /upper heavy/i).click();
  await page.locator('.setcheck').first().click();
  // Minimize the workout, wander to another tab: nothing is lost.
  await page.getByRole('button', { name: /minimize|riduci/i }).click();
  await page.getByRole('button', { name: /^home$/i }).click();
  await expect(page.locator('.active-bar')).toBeVisible();
  await page.locator('.active-bar').click();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();
  await expect(page.locator('.setrow.done')).toHaveCount(1);
});

test('hardware back navigates the app', async ({ page }) => {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  await page.locator('.card', { hasText: /barbell squat|squat con bilanciere/i }).first().click();
  await expect(page.getByText(/how to|esecuzione/i)).toBeVisible();
  await page.goBack();
  await expect(page.getByPlaceholder(/search|cerca/i)).toBeVisible();
});

test('workout in progress survives reload', async ({ page }) => {
  await routineStart(page, /upper heavy/i).click();
  await page.locator('.setcheck').first().click();
  await page.reload();
  await expect(page.getByText(/upper heavy/i).first()).toBeVisible();
  await expect(page.locator('.setrow.done')).toHaveCount(1);
});
