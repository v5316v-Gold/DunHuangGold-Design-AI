/**
 * Stage 4 · E2E ⑥ 可访问性（axe-core WCAG 2.1 A/AA 自动扫描）
 *
 * 用 axe-core 注入页面运行扫描，断言「critical」级违规为 0 且基础语义完备，
 * 并打印 serious/moderate 违规摘要供人工排查。
 */
import { test, expect, type Page } from '@playwright/test';
import axe from 'axe-core';

interface AxeResult {
  violations: Array<{
    id: string;
    impact: string | null;
    description: string;
    nodes: unknown[];
  }>;
}

async function scanA11y(page: Page): Promise<AxeResult> {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axeWin = (window as unknown as { axe?: { run: (...a: unknown[]) => Promise<unknown> } }).axe;
    const results = (await axeWin!.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    })) as AxeResult;
    return results;
  });
}

/** 打印违规摘要（serious/moderate/minor）供人工排查，只对 critical 硬断言 */
function reportViolations(label: string, violations: AxeResult['violations']): void {
  const nonCritical = violations.filter((v) => v.impact !== 'critical');
  if (nonCritical.length === 0) {
    console.log(`[a11y] ${label}: 无 serious/moderate 违规 ✅`);
    return;
  }
  console.log(`[a11y] ${label}: ${nonCritical.length} 条非 critical 违规`);
  for (const v of nonCritical) {
    console.log(`  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} 处)`);
  }
}

function expectNoCritical(label: string, violations: AxeResult['violations']): void {
  const critical = violations.filter((v) => v.impact === 'critical');
  expect(
    critical,
    `${label} 存在 critical 违规:\n${JSON.stringify(critical, null, 2)}`
  ).toEqual([]);
}

test.describe('可访问性（axe WCAG 2.1 A/AA）', () => {
  test('工作台：无 critical 违规', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('prompt-textarea')).toBeVisible({ timeout: 30_000 });

    const results = await scanA11y(page);
    reportViolations('工作台', results.violations);
    expectNoCritical('工作台', results.violations);
  });

  test('后台 admin：无 critical 违规', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('管理后台')).toBeVisible({ timeout: 30_000 });

    const results = await scanA11y(page);
    reportViolations('后台', results.violations);
    expectNoCritical('后台', results.violations);
  });
});

test.describe('可访问性 · 登录页（未登录态）', () => {
  // 登录页需未登录态（已登录会重定向到 /），覆盖为空 storageState
  test.use({ storageState: { cookies: [], origins: [] } });

  test('无 critical 违规，且有 lang/title', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-submit')).toBeVisible({ timeout: 30_000 });

    // 基础语义
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBeTruthy();
    expect(await page.title()).toBeTruthy();

    const results = await scanA11y(page);
    reportViolations('登录页', results.violations);
    expectNoCritical('登录页', results.violations);
  });
});
