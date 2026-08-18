/**
 * Stage 4 · E2E ⑦ 性能
 *
 * 通过 PerformanceObserver 采集 LCP/FCP + Navigation Timing，
 * 断言首屏可交互时间与核心 Web Vitals 在合理阈值内。
 * 环境：本地容器（生产 build），阈值从宽以避免 CI 抖动。
 */
import { test, expect, type Page } from '@playwright/test';

async function injectPerfObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 挂到 window 供断言读取
    const w = window as unknown as { __perf?: { lcp: number; fcp: number; ttfb: number; domContentLoaded: number; load: number } };
    w.__perf = { lcp: 0, fcp: 0, ttfb: 0, domContentLoaded: 0, load: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === 'first-contentful-paint') w.__perf!.fcp = e.startTime;
        }
      }).observe({ type: 'paint', buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) w.__perf!.lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      /* 不支持则保持 0 */
    }
  });
}

async function readPerf(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __perf?: { lcp: number; fcp: number } };
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    return {
      lcp: Math.round(w.__perf?.lcp ?? 0),
      fcp: Math.round(w.__perf?.fcp ?? 0),
      ttfb: Math.round(nav?.responseStart ?? 0),
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      load: Math.round(nav?.loadEventEnd ?? 0),
    };
  });
}

test.describe('性能', () => {
  test('工作台首屏可交互 < 15s，核心指标记录完整', async ({ page }) => {
    await injectPerfObservers(page);

    const t0 = Date.now();
    await page.goto('/');
    // 首屏关键交互元素出现 = 可交互
    await expect(page.getByTestId('prompt-textarea')).toBeVisible({ timeout: 30_000 });
    const tti = Date.now() - t0;

    const perf = await readPerf(page);
    console.log(`[perf] 工作台 TTI=${tti}ms LCP=${perf.lcp}ms FCP=${perf.fcp}ms TTFB=${perf.ttfb}ms`);

    expect(tti).toBeLessThan(15_000);
    expect(perf.fcp).toBeGreaterThan(0);
    expect(perf.lcp).toBeGreaterThan(0);
    expect(perf.lcp).toBeLessThan(10_000);
  });
});

test.describe('性能 · 登录页（未登录态）', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('首屏可交互 < 10s', async ({ page }) => {
    await injectPerfObservers(page);

    const t0 = Date.now();
    await page.goto('/login');
    await expect(page.getByTestId('login-submit')).toBeVisible({ timeout: 20_000 });
    const tti = Date.now() - t0;

    const perf = await readPerf(page);
    console.log(`[perf] 登录页 TTI=${tti}ms FCP=${perf.fcp}ms LCP=${perf.lcp}ms`);

    expect(tti).toBeLessThan(10_000);
  });
});
