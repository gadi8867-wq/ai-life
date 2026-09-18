import { test, expect } from '@playwright/test';

test('AI Life 16:9 scene keeps agents visible', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__AI_LIFE_TEST__?.agents?.length === 2);
  await page.waitForTimeout(2500);

  await expect(page.locator('.agent-label')).toHaveCount(2);
  await expect(page.locator('.agent-label').filter({ hasText: 'OpenAI' })).toBeVisible();
  await expect(page.locator('.agent-label').filter({ hasText: 'Cloude' })).toBeVisible();

  const rect = async (selector) => page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const panel = await rect('.experiment-pill');
  expect(panel).not.toBeNull();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(1920);

  const labels = await page.locator('.agent-label').evaluateAll(els =>
    els.map(el => ({ text: el.textContent?.trim() || '', opacity: getComputedStyle(el).opacity }))
  );
  expect(labels.every(x => x.opacity !== '0')).toBeTruthy();

  const canvasSize = await page.locator('#game canvas').evaluate(canvas => ({
    width: canvas.width,
    height: canvas.height
  }));
  expect(canvasSize.width).toBeGreaterThan(0);
  expect(canvasSize.height).toBeGreaterThan(0);
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


test('September uses autumn visuals and both banks have a campfire', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__AI_LIFE_TEST__?.seasonForDate && window.__AI_LIFE_TEST__?.campfires?.length === 2);
  const result = await page.evaluate(() => {
    const api = window.__AI_LIFE_TEST__;
    const season = api.seasonForDate(new Date('2026-09-18T12:00:00Z'));
    return { season: season.key, label: season.label, fires: api.campfires.length };
  });
  expect(result.season).toBe('autumn');
  expect(result.label).toBe('ОСЕНЬ');
  expect(result.fires).toBe(2);
});
