import { test, expect } from '@playwright/test';

test('AI Life 16:9 scene keeps agents and three events visible', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#game canvas');
  await page.waitForTimeout(2500);

  await expect(page.locator('.agent-label')).toHaveCount(2);
  await expect(page.locator('.agent-label').filter({ hasText: 'OpenAI' })).toBeVisible();
  await expect(page.locator('.agent-label').filter({ hasText: 'Cloude' })).toBeVisible();

  const events = page.locator('#sceneEvents .scene-event');
  await expect(events).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(events.nth(i)).toBeVisible();

  const box = async (selector) => page.locator(selector).boundingBox();
  const feed = await box('#sceneEvents');
  const panel = await box('.experiment-pill');
  expect(feed).not.toBeNull();
  expect(panel).not.toBeNull();

  expect(feed.y + feed.height).toBeLessThan(panel.y);
  expect(feed.x).toBeGreaterThanOrEqual(0);
  expect(feed.x + feed.width).toBeLessThanOrEqual(1920);

  const labels = await page.locator('.agent-label').evaluateAll(els =>
    els.map(el => ({ text: el.textContent?.trim() || '', opacity: getComputedStyle(el).opacity }))
  );
  expect(labels.every(x => x.opacity !== '0')).toBeTruthy();

  await expect(page.locator('#game canvas')).toHaveAttribute('width', /./);
});
