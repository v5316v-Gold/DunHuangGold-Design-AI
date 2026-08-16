/**
 * P1-4 · Playwright 全局 Setup —— 登录一次并保存会话
 *
 * 目的：全部 e2e 用例复用同一登录态（storageState），
 *       避免每个用例重复登录触发登录限流（nginx 10r/m）。
 */
import { FullConfig, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@dunhuang.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';
const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5000';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const authDir = path.join(__dirname, '.auth');
  fs.mkdirSync(authDir, { recursive: true });
  const stateFile = path.join(authDir, 'user.json');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入邮箱地址').fill(ADMIN_EMAIL);
  await page.getByPlaceholder(/请输入密码|至少6位密码/).fill(ADMIN_PASSWORD);
  await page.locator('form').getByRole('button', { name: '登录' }).click();

  // 等待跳转：工作台侧边栏出现（或强制改密页出现则尝试绕过）
  const workbench = page.getByRole('button', { name: /文案生图|AI对话/ }).first();
  try {
    await workbench.waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    // 可能命中强制改密页：填旧密 + 新密提交
    const changeForm = page.locator('form').filter({ hasText: /新密码|确认密码|修改密码/ });
    if (await changeForm.count()) {
      await changeForm.getByPlaceholder(/旧密码|当前密码|原密码/).fill(ADMIN_PASSWORD);
      await changeForm.getByPlaceholder(/新密码/).first().fill('AdminTest1234!');
      await changeForm.getByPlaceholder(/确认密码/).first().fill('AdminTest1234!');
      await changeForm.getByRole('button', { name: /提交|确定|保存|修改/ }).first().click();
      await workbench.waitFor({ state: 'visible', timeout: 20_000 });
    } else {
      throw new Error('登录失败：未进入工作台，且无强制改密页');
    }
  }

  await page.context().storageState({ path: stateFile });
  await browser.close();
  console.log(`✅ 登录态已保存: ${stateFile}`);
}
