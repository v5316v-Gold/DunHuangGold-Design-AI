import Link from 'next/link';

// 标记动态渲染：避免 _not-found 在静态预渲染阶段触发根 layout 的
// client Provider hook（React 19.2 + Next 15.1 兼容问题）而崩溃。
export const dynamic = 'force-dynamic';

/**
 * 全局 404 页面 (Server Component)
 *
 * 背景 (2026-08-03 修复):
 *   Next 15 默认的 _not-found 会经过根 layout 的 client Provider 链
 *   (AuthProvider / GenerationTaskProvider / ModelViewerScript)，
 *   在静态预渲染阶段这些 client hook 可能因缺少浏览器环境而崩溃
 *   (useState/useContext null 错误)。
 *
 * 修复: 提供纯 Server Component 的 not-found 页，不触发任何 client hook，
 *       构建时静态生成无副作用；运行时 404 展示敦煌金风格提示。
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] px-4">
      {/* 敦煌金装饰圆环 */}
      <div className="w-24 h-24 rounded-full border-2 border-[var(--gold)]/40 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(200,164,92,0.2)]">
        <span className="text-[var(--gold)] text-4xl font-serif">404</span>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold mb-3 text-[var(--gold)]">
        此页无存 · 如敦煌壁画之残卷
      </h1>

      <p className="text-[var(--text-muted)] text-sm mb-10 max-w-md text-center leading-relaxed">
        您访问的页面不存在，可能已被移动或从未存在。
        <br />
        不妨回到工坊，继续您的创作。
      </p>

      <Link
        href="/"
        className="px-8 py-3 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dark)] text-[var(--bg-primary)] font-medium transition-all hover:opacity-90 hover:shadow-[0_0_24px_rgba(200,164,92,0.5)]"
      >
        返回设计工坊
      </Link>
    </div>
  );
}
