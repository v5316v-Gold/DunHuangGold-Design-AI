/**
 * 截屏脚本：用 Playwright 截取敦煌金 AI 平台各页面（登录后）
 *
 * 用法：
 *   截公共页：npx tsx scripts/screenshot.ts /login
 *   登录后截内部页：LOGIN_EMAIL=admin@dunhuang.com LOGIN_PASSWORD=admin123 \\
 *     npx tsx scripts/screenshot.ts / /gallery /admin
 *
 * 关键：登录用 ctx.request.post（API 走 cookie 持久化到 ctx），
 *      然后用 page.evaluate 写 localStorage（让 useAuth hook 读到）
 *      useAuth.isAuthenticated = !!user ← useState 初值读 localStorage.dunhuang_token
 *      所以 localStorage 必须在 page 首次渲染**前**写入
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = process.env.OUT_DIR || process.cwd() + '/docs/screenshots';
const LOGIN_EMAIL = process.env.LOGIN_EMAIL;
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;
const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ['/login'];

/**
 * 通过 API 登录（cookie 自动持久化到 ctx）
 * 返回 { user, token } 或 null
 */
async function loginViaApi(ctx: BrowserContext): Promise<{ user: any; token: string } | null> {
  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    console.log('⚠️  未提供 LOGIN_EMAIL/LOGIN_PASSWORD，跳过登录');
    return null;
  }
  console.log(`→ API 登录 ${LOGIN_EMAIL} ...`);

  const resp = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await resp.json().catch(() => ({}));
  if (resp.status() !== 200 || !body?.success) {
    console.log(`  ✗ 登录失败: ${body?.error || resp.status()}`);
    return null;
  }
  console.log(`  ✓ API 登录成功（${body.data.user?.role || '?'}）`);

  const cookies = await ctx.cookies();
  const authCookie = cookies.find((c: any) => c.name === 'auth_token');
  if (!authCookie) {
    console.log(`  ⚠️  未找到 auth_token cookie`);
    return null;
  }
  console.log(`  ✓ auth_token cookie 已设置 (${authCookie.value.length} chars)`);
  return { user: body.data.user, token: authCookie.value };
}

/**
 * 在 page 上同步 localStorage（useAuth hook 依赖）
 * 必须在 page 创建后、首次访问目标 URL 前调用
 * 注意：要先访问一个 URL（让 page context 存在），再 evaluate
 */
/**
 * 用 addInitScript 注入 localStorage（避免 hydration mismatch）
 * - addInitScript 在每个 page load **前**执行
 * - 因此 SSR 和客户端首屏渲染看到一致的 localStorage
 * - useAuth 读到 → isAuthenticated=true
 */
async function syncLocalStorage(ctx: BrowserContext, user: any, token: string): Promise<void> {
  await ctx.addInitScript((data: { token: string; user: any }) => {
    try {
      localStorage.setItem('dunhuang_token', data.token);
      localStorage.setItem('dunhuang_user', JSON.stringify(data.user));
    } catch {}
  }, { token, user });
  console.log('  ✓ addInitScript 已注入（dunhuang_token + dunhuang_user）');
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 1. 登录（cookie 自动持久化）
  let loginResult: { user: any; token: string } | null = null;
  if (LOGIN_EMAIL) {
    loginResult = await loginViaApi(ctx);
  }

  // 捕 console 错误（诊断 hydration）
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`[pageerror] ${err.message.slice(0, 300)}`);
  });

  // 2. 同步 localStorage（让 useAuth 读得到）
  if (loginResult) {
    await syncLocalStorage(ctx, loginResult.user, loginResult.token);
  }

  // 3. 截图
  for (const path of PAGES) {
    const url = `${BASE}${path}`;
    console.log(`→ ${url}`);
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      const status = resp?.status() ?? 0;
      await page.waitForTimeout(1500);
      const title = await page.title();
      const safeName = path.replace(/[\/\\]/g, '_') || '_root';
      const file = join(OUT_DIR, `${safeName}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const text = (await page.textContent('body'))?.slice(0, 120).replace(/\s+/g, ' ') || '';
      console.log(`  ✓ [${status}] ${title} → ${file}`);
      console.log(`    text: ${text}`);
      if (consoleErrors.length) {
        console.log(`  ⚠️  console 错误 (${consoleErrors.length}):`);
        consoleErrors.slice(0, 3).forEach(e => console.log(`    ${e}`));
      }
    } catch (e: any) {
      console.log(`  ✗ ${path}: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n截图: ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
