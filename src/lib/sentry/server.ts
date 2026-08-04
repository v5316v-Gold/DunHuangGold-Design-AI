/**
 * Phase 9.11 · Sentry 服务端配置
 *
 * 通过环境变量 SENTRY_DSN 启用；未配置则不初始化（dev/本地不影响）
 *
 * 采样率：
 * - 生产：traces 10%、errors 100%
 * - 开发：traces 0%、errors 100%
 *
 * PII 过滤：默认关闭 sendDefaultPii（不收集 IP、邮箱等敏感信息）
 */
export function initSentryServer() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Sentry] 未配置 SENTRY_DSN，错误追踪已禁用');
    }
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';

  // 动态 import 避免无 DSN 时打包开销
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || undefined,
      tracesSampleRate: isProd ? 0.1 : 0.0,
      // PII 默认关闭
      sendDefaultPii: false,
      // 仅捕获错误，不捕获 console.log
      beforeSendTransaction(event) {
        // 健康检查接口不上报（高频噪声）
        if (event.transaction === '/api/health') return null;
        return event;
      },
      // 自定义 ignore 规则
      ignoreErrors: [
        // 客户端取消请求
        'AbortError',
        // 网络中断
        'NetworkError',
      ],
    });
  }).catch((err) => {
    console.error('[Sentry] init 失败:', err);
  });
}