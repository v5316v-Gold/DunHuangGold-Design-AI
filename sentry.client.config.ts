/**
 * Phase 9.13 · Sentry Client 配置（Next.js 标准）
 *
 * 触发时机：浏览器端代码运行时
 *
 * 启用条件：环境变量 NEXT_PUBLIC_SENTRY_DSN 必须配置（前端可见）
 * 未配置时不初始化（节省打包体积）
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,

    // 客户端采样（低，保护用户隐私）
    tracesSampleRate: 0.0, // 前端 trace 全关闭（性能开销大）
    replaysOnErrorSampleRate: 0.1, // 错误时回放 10%
    replaysSessionSampleRate: 0,

    // PII 严格关闭
    sendDefaultPii: false,

    ignoreErrors: [
      'AbortError',
      'NetworkError',
      // 浏览器扩展冲突
      'ResizeObserver loop limit exceeded',
      // 第三方脚本错误
      'Script error',
    ],
  });
}