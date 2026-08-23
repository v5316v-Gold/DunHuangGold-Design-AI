/**
 * Stage 1 · E2E ② 后台 ComfyUI 工作流配置
 *
 * 验证点：
 *   1. 进入 /admin → 点击「ComfyUI 配置」标签页
 *   2. 工作流列表渲染（文生图 / 图片精修 / 背景移除 …）
 *   3. 对「文生图」点击「配置」→ 填入 workflow ID → 保存
 *   4. 保存后编辑态关闭，显示已保存的 Workflow ID（真实反馈）
 *
 * 前置：global-setup 已登录 admin 账号并保存 storageState。
 *
 * ⚠️ TODO(admin refactor): commit 3a1f373 移除了 admin/page.tsx 的 comfyui tab
 * 与 ComfyUIConfigPanel 引用（理由：重复面板清理），但未同步更新此 E2E。
 * 在重新引入 comfyui tab 之前，先 skip 这些测试。
 * 替代功能：admin/system 页有 "ComfyUI 生图服务" 健康检查 tab（不测 workflow 配置）。
 */
import { test, expect } from '@playwright/test';

test.describe('后台 ComfyUI 工作流配置', () => {
  test.skip('配置文生图 workflow ID：填写并保存后显示已配置', async ({ page }) => {
    // 等待 admin ComfyUI 配置 tab 回归后启用
    await page.goto('/admin');

    // 点击侧边栏「ComfyUI 配置」标签
    await page.getByRole('button', { name: 'ComfyUI 配置' }).click();

    // 工作流列表渲染（文生图标题 + 配置按钮可见）
    await expect(page.getByRole('heading', { name: '文生图' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('workflow-id-config-text2img')).toBeVisible();

    // 进入编辑态
    await page.getByTestId('workflow-id-config-text2img').click();
    const input = page.getByTestId('workflow-id-input-text2img');
    await expect(input).toBeVisible();

    // 填入 workflow ID 并保存
    await input.fill('test-workflow-123');
    await page.getByTestId('workflow-id-save-text2img').click();

    // 保存后：编辑输入框消失，重新显示「配置」按钮，且展示已保存的 Workflow ID
    await expect(input).toBeHidden();
    await expect(page.getByTestId('workflow-id-config-text2img')).toBeVisible();
    await expect(page.getByText('Workflow ID: test-workflow-123')).toBeVisible();
  });
});
