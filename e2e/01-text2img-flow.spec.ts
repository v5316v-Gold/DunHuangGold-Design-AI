/**
 * Stage 1 · E2E ① 文案生图（text2img）完整交互流程
 *
 * 验证点：
 *   1. 面板加载：提示词输入框 + 生成按钮可见，空提示词时按钮禁用（真实反馈：不可点击）
 *   2. 填写提示词 → 点击生成 → 出现真实反馈（进度条 / 错误提示 / 结果图 至少其一）
 *
 * 前置：global-setup 已登录 admin@dunhuang.com 并保存 storageState，
 *       用例直接复用会话，不重复登录（避免命中限流）。
 */
import { test, expect, type Page } from '@playwright/test';

// 真实反馈信号：生成中进度 / 错误提示 / 结果图 —— 出现任意一种即证明交互有真实响应
const FEEDBACK_SELECTOR = [
  '[data-testid="progress-bar"]',
  '[data-testid="generate-error"]',
  '[data-testid="result-image"]',
].join(', ');

async function openText2Img(page: Page): Promise<void> {
  await page.goto('/');
  // 默认激活面板即为 text2img，等待其核心控件出现
  await expect(page.getByTestId('prompt-textarea')).toBeVisible({ timeout: 30_000 });
}

/** 等待生成流程产生真实反馈（进度 / 错误 / 结果图 任意其一） */
async function waitForGenerationFeedback(page: Page): Promise<void> {
  await page.locator(FEEDBACK_SELECTOR).first().waitFor({ state: 'visible', timeout: 60_000 });
}

test.describe('文案生图（text2img）完整交互流程', () => {
  test('面板加载：控件可见，空提示词时生成按钮禁用', async ({ page }) => {
    await openText2Img(page);

    const textarea = page.getByTestId('prompt-textarea');
    const submit = page.getByTestId('generate-submit');

    await expect(textarea).toBeVisible();
    await expect(submit).toBeVisible();

    // 空提示词 → 按钮禁用（真实反馈）
    await expect(submit).toBeDisabled();

    // 填写提示词 → 按钮启用
    await textarea.fill('一只敦煌飞天壁画中的金色凤凰');
    await expect(submit).toBeEnabled();

    // 清空 → 按钮恢复禁用
    await textarea.fill('');
    await expect(submit).toBeDisabled();
  });

  test('填写提示词并点击生成：产生真实反馈', async ({ page }) => {
    await openText2Img(page);

    await page
      .getByTestId('prompt-textarea')
      .fill('一只敦煌飞天壁画中的金色凤凰，金箔质感，敦煌色彩');
    await page.getByTestId('generate-submit').click();

    // 生成中会出现进度条 / 失败会出现错误提示 / 成功会出现结果图
    await waitForGenerationFeedback(page);
  });
});
