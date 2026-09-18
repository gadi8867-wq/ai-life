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


test('river has two banks and a traversable bridge', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__AI_LIFE_TEST__?.bridge?.name === 'river-bridge');
  const result = await page.evaluate(() => {
    const api = window.__AI_LIFE_TEST__;
    return {
      bridgeName: api.bridge.name,
      bridgeWalkable: api.isWalkable(5, 0),
      riverWalkableAwayFromBridge: api.isWalkable(5, 10),
      openAiX: api.agents.find(a => a.name === 'OpenAI').root.position.x,
      cloudeX: api.agents.find(a => a.name === 'Cloude').root.position.x
    };
  });
  expect(result.bridgeName).toBe('river-bridge');
  expect(result.bridgeWalkable).toBeTruthy();
  expect(result.riverWalkableAwayFromBridge).toBeFalsy();
  expect(result.openAiX).toBeLessThan(0);
  expect(result.cloudeX).toBeGreaterThan(0);
});


test('autumn calendar changes smoothly week to week', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__AI_LIFE_TEST__?.autumnClimate);
  const result = await page.evaluate(() => {
    const api = window.__AI_LIFE_TEST__;
    const dates = [
      new Date(Date.UTC(2026, 8, 7)),
      new Date(Date.UTC(2026, 8, 14)),
      new Date(Date.UTC(2026, 8, 21)),
      new Date(Date.UTC(2026, 8, 28)),
      new Date(Date.UTC(2026, 9, 5)),
      new Date(Date.UTC(2026, 9, 12))
    ];
    const climate = dates.map(d => ({ p: api.autumnProgress(d), ...api.autumnClimate(d) }));
    api.applySeason(dates[0]);
    const early = api.leafBed.material.opacity;
    api.applySeason(dates[dates.length - 1]);
    const later = api.leafBed.material.opacity;
    return { climate, early, later };
  });
  expect(result.climate[0].p).toBeLessThan(result.climate[1].p);
  expect(result.climate[1].p).toBeLessThan(result.climate[2].p);
  expect(result.climate[2].p).toBeLessThan(result.climate[3].p);
  expect(result.climate[3].p).toBeLessThan(result.climate[4].p);
  expect(result.climate[4].p).toBeLessThan(result.climate[5].p);
  for (let i = 1; i < result.climate.length; i++) {
    expect(Math.abs(result.climate[i].temperature - result.climate[i - 1].temperature)).toBeLessThan(4);
  }
  expect(result.climate[0].rainTarget).toBeGreaterThanOrEqual(0);
  expect(result.climate[0].rainTarget).toBeLessThanOrEqual(1);
  expect(result.climate[5].rainTarget).toBeGreaterThanOrEqual(0);
  expect(result.climate[5].rainTarget).toBeLessThanOrEqual(1);
  expect(result.later).toBeGreaterThan(result.early);
});


test('September trees use a premium mixed green-to-amber canopy', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__AI_LIFE_TEST__?.trees?.length > 0);
  const result = await page.evaluate(() => {
    const api = window.__AI_LIFE_TEST__;
    api.applySeason(new Date(Date.UTC(2026, 8, 18)));
    const trees = api.trees.slice(0, 12).map(t => ({
      clusters: t.foliage.length,
      colors: t.foliage.map(m => '#' + m.material.color.getHexString())
    }));
    return { trees, season: api.seasonInfo(new Date(Date.UTC(2026, 8, 18))) };
  });
  expect(result.season.key).toBe('autumn');
  expect(result.trees.every(t => t.clusters >= 3)).toBeTruthy();
  const unique = new Set(result.trees.flatMap(t => t.colors));
  expect(unique.size).toBeGreaterThan(4);
});
