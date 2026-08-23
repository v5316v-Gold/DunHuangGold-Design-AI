/**
 * Stage 3 · E2E ⑤ 错误恢复
 *
 * 验证：后端接口失败时前端优雅降级（不白屏、给出真实反馈），而非静默/崩溃。
 */
import { test, expect } from '@playwright/test';

test.describe('错误恢复', () => {
  test('后台 API 5xx：界面不白屏，外壳与标题仍渲染', async ({ page }) => {
    // 拦截数据概览统计接口 → 500
    await page.route('**/api/admin/dashboard-stats', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'server error' }),
      })
    );

    await page.goto('/admin');
    await expect(page.getByText('管理后台')).toBeVisible({ timeout: 30_000 });
    // 降级：统计以 0 显示，但页面外壳 + 标题仍在（无白屏）
    await expect(page.getByRole('heading', { name: '数据概览' })).toBeVisible();
  });

  test('text2img 生成接口失败：显示错误反馈而非静默', async ({ page }) => {
    // 拦截生成接口 → 400（非可重试状态码，快速失败，避免 3 次退避重试拖慢用例）
    await page.route('**/api/ai/generate-async', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: '生成服务不可用' }),
      })
    );

    await page.goto('/');
    await expect(page.getByTestId('prompt-textarea')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('prompt-textarea').fill('错误恢复测试提示词');
    await page.getByTestId('generate-submit').click();

    // 真实反馈：错误提示必须出现（不能只有假进度或静默失败）
    await expect(page.getByTestId('generate-error')).toBeVisible({ timeout: 30_000 });
  });

  // ⚠️ TODO(admin refactor): commit 3a1f373 移除了 admin ComfyUI 配置 tab，待回归后启用
  test.skip('ComfyUI 配置面板：接口异常时仍渲染列表（不崩溃）', async ({ page }) => {
    // 拦截 ComfyUI 健康/配置接口 → 500
    await page.route('**/api/comfyui', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    );

    await page.goto('/admin');
    await expect(page.getByText('管理后台')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'ComfyUI 配置' }).click();
    // 连接状态显示「未连接」，但工作流列表仍渲染
    await expect(page.getByText('未连接')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '文生图' })).toBeVisible();
  });
});
