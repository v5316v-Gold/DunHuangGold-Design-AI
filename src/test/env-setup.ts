/**
 * Vitest 公共 env setup（在每个 test file 加载前注入测试环境）
 *
 * vitest node 配置在 setupFiles 中加载此文件，确保 auth.ts 等模块顶层
 * `const JWT_SECRET = process.env.JWT_SECRET || ''` 在 test file 模块 import 时已读到值。
 *
 * 注意：setupFile 在 worker 进程内执行，先于 test file 模块加载。
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-32-chars-validation';
}