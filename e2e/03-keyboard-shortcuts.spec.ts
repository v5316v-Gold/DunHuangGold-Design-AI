/**
 * Stage 1 · E2E ③ 键盘快捷键
 *
 * 验证点（text2img 面板注册的快捷键，ignoreInput:false 允许输入框内触发）：
 *   1. Escape        → 清空提示词（真实反馈）
 *   2. Ctrl+Enter    → 触发生成（进度 / 错误 / 结果图 任意其一，真实反馈）
 *      （meta/Cmd 在 macOS 等价，代码层 ctrl 与 meta 归并为同一主修饰键）
 *
 * 前置：global-setup 已登录并保存 storageState。
 */
import { test, expect, type Page } from '@playwright/test';

const FEEDBACK_SELECTOR = [
  '[data-testid="progress-bar"]',
  '[data-testid="generate-error"]',
  '[data-testid="result-image"]',
].join(', ');

async function openText2Img(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('prompt-textarea')).toBeVisible({ timeout: 30_000 });
}

test.describe('键盘快捷键', () => {
  test('Escape 清空提示词（真实反馈）', async ({ page }) => {
    await openText2Img(page);

    const textarea = page.getByTestId('prompt-textarea');
    await textarea.fill('待清空的提示词内容');
    await expect(textarea).toHaveValue('待清空的提示词内容');

    // 焦点在 textarea 内按 Escape（ignoreInput:false 允许输入框内触发）
    await textarea.press('Escape');
    await expect(textarea).toHaveValue('');
  });

  test('Ctrl+Enter 触发生成（进度 / 错误 / 结果图 任意其一）', async ({ page }) => {
    await openText2Img(page);

    const textarea = page.getByTestId('prompt-textarea');
    await textarea.fill('敦煌九色鹿，金箔浮雕质感');
    await textarea.press('Control+Enter');

    await page.locator(FEEDBACK_SELECTOR).first().waitFor({ state: 'visible', timeout: 60_000 });
  });
});
