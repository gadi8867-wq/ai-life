import { test, expect } from '@playwright/test';

test('real calendar drives autumn visuals in September', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__AI_LIFE_TEST__?.seasonInfo);
  const result = await page.evaluate(() => {
    const api = window.__AI_LIFE_TEST__;
    const autumn = api.seasonInfo(new Date('2026-09-18T12:00:00Z'));
    const summer = api.seasonInfo(new Date('2026-07-18T12:00:00Z'));
    api.applySeason(new Date('2026-09-18T12:00:00Z'));
    const autumnColors = api.seasonPalettes.autumn;
    api.applySeason(new Date('2026-07-18T12:00:00Z'));
    const summerColors = api.seasonPalettes.summer;
    return {
      autumn: autumn.key,
      autumnName: autumn.name,
      summer: summer.key,
      autumnHue: autumnColors.leafB[0],
      summerHue: summerColors.leafB[0],
      status: document.querySelector('#worldStatus')?.textContent || ''
    };
  });
  expect(result.autumn).toBe('autumn');
  expect(result.autumnName).toBe('Осень');
  expect(result.summer).toBe('summer');
  expect(result.autumnHue).not.toBe(result.summerHue);
  await expect(page.locator('#worldStatus')).toContainText('Осень');
});
