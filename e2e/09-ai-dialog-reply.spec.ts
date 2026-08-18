/**
 * Stage 3 扩展 · E2E ⑨ AI 对话回复（Hermes 本地 → MiniMax 云端兜底）
 *
 * 验证：AIDialog 发送消息后能收到助手回复。
 * 前置：global-setup 已登录 admin 账号。
 *
 * 路径：用户消息 → /api/chat → 优先 Hermes 本地 CLI（无则降级）→ SSE 流式 → AIDialog 渲染。
 * 实际环境 Hermes 未安装，依赖路由层 Hermes→MiniMax 降级链路。
 */
import { test, expect } from '@playwright/test';

test.describe('AI 对话回复（Hermes → MiniMax 兜底）', () => {
  test('发送消息后收到助手回复', async ({ page }) => {
    await page.goto('/');
    // 打开 AI 对话面板
    await page.getByTestId('feature-dialogue').click();
    // 等待输入区出现
    const textarea = page.locator('textarea[placeholder*="输入消息"]');
    await expect(textarea).toBeVisible({ timeout: 30_000 });

    // 输入消息
    await textarea.fill('用一句话介绍你自己');

    // 点击发送按钮（title="发送 (Enter)"）
    const sendBtn = page.getByTitle('发送 (Enter)');
    await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
    await sendBtn.click();

    // 等待助手回复 <p> 出现并有非空文本
    // 助手气泡是 bg-[var(--bg-card)]；加载指示器用 <span> 没有 <p>，所以 p 选择器唯一匹配回复
    const replyP = page
      .locator('[data-ai-assistant-enabled] .bg-dots div.bg-\\[var\\(--bg-card\\)\\] p')
      .first();
    await expect(replyP).toBeVisible({ timeout: 60_000 });
    await expect(replyP).not.toHaveText('', { timeout: 30_000 });

    const replyText = (await replyP.textContent())?.trim() ?? '';
    expect(replyText.length).toBeGreaterThan(0);
    // 记录回复便于排查
    // eslint-disable-next-line no-console
    console.log('[ai-dialog] 助手回复:', replyText.slice(0, 120));
  });
});
