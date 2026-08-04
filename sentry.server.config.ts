/**
 * Phase 9.13 · Sentry Server 配置（Next.js 标准）
 *
 * 触发时机：Next.js 服务端代码运行时（route handler / middleware / API）
 *
 * 启用条件：环境变量 SENTRY_DSN 必须配置
 * 未配置时 Sentry.init 不会执行（节省启动开销）
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,

    // 采样率
    // - traces: 性能追踪采样（生产 10%，dev 关闭）
    // - replays: 会话回放（生产 1%，dev 关闭）
    tracesSampleRate: isProd ? 0.1 : 0.0,
    replaysOnErrorSampleRate: isProd ? 0.01 : 0.0,
    replaysSessionSampleRate: 0,

    // PII 严格关闭（不收集用户邮箱/IP/用户名）
    sendDefaultPii: false,

    // 错误过滤：避免健康检查高频噪声
    ignoreErrors: [
      // 客户端取消请求
      'AbortError',
      // 网络中断（瞬时）
      'NetworkError',
      // ECONNRESET（容器重启期瞬时连接失败）
      'ECONNRESET',
      // Prisma/Drizzle 已知无害错误
      'DrizzleQueryError: connection terminated',
    ],

    // 事务过滤：健康检查、metrics 端点不上报
    beforeSendTransaction(event) {
      const url = event.request?.url || '';
      if (url.includes('/api/health') || url.includes('/api/metrics')) {
        return null;
      }
      return event;
    },

    // 错误去重：相同 stack trace 不重复上报
    beforeSend(event, hint) {
      // 过滤掉不包含 stack 的错误（无意义）
      const ex = hint.originalException;
      if (ex instanceof Error && !ex.stack) {
        return null;
      }
      return event;
    },
  });
}