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

test('agents stay on land and wandering changes coordinates', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__AI_LIFE_TEST__?.agents?.length === 2);
  const result = await page.evaluate(async () => {
    const api = window.__AI_LIFE_TEST__;
    api.agents.forEach((a, i) => {
      a.root.position.set(i ? 20 : -20, 0, i ? 12 : -8);
      a.state = 'wandering';
      a.stateUntil = performance.now() + 60000;
      a.target.set(i ? 35 : -35, 0, i ? 20 : -18);
    });
    const before = api.agents.map(a => ({ x: a.root.position.x, z: a.root.position.z }));
    await new Promise(resolve => setTimeout(resolve, 900));
    const after = api.agents.map(a => ({ x: a.root.position.x, z: a.root.position.z }));
    return { before, after, walkable: after.map(p => api.isWalkable(p.x, p.z)) };
  });
  expect(result.walkable).toEqual([true, true]);
  expect(result.after[0]).not.toEqual(result.before[0]);
  expect(result.after[1]).not.toEqual(result.before[1]);
  await expect(page.locator('.agent-label').filter({ hasText: 'бродит' })).toHaveCount(2);
});

test('invalid saved positions migrate to the nearest safe land point', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ai-life-2-v1', JSON.stringify({
      experimentStart: Date.now(), running: false, events: [],
      agents: [
        { name: 'OpenAI', x: 5, z: 0, metrics: {}, memory: [] },
        { name: 'Cloude', x: 5, z: 20, metrics: {}, memory: [] }
      ]
    }));
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__AI_LIFE_TEST__?.agents?.length === 2);
  const result = await page.evaluate(() => {
    const api = window.__AI_LIFE_TEST__;
    return api.agents.map(a => ({ x: a.root.position.x, z: a.root.position.z, walkable: api.isWalkable(a.root.position.x, a.root.position.z) }));
  });
  expect(result.every(a => a.walkable)).toBeTruthy();
  expect(Math.hypot(result[0].x - 5, result[0].z - 0)).toBeLessThan(20);
  expect(Math.hypot(result[1].x - 5, result[1].z - 20)).toBeLessThan(15);
});
