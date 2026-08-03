'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { usePower, ADMIN_DEFAULT_POWER } from '@/lib/power';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading';
import { usePageState } from '@/hooks/usePageState';

// 动态导入工作区面板，避免 SSR 问题
const WorkspacePanel = dynamic(() => import('@/components/workspace/WorkspacePanel'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 中心光晕 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--gold)] opacity-[0.03] blur-[100px]" />
        {/* 金色网格 */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle, var(--gold) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />
      </div>
      
      <div className="flex flex-col items-center gap-6 relative z-10">
        <div className="relative">
          <LoadingSpinner size="lg" />
          {/* 外圈光环 */}
          <div className="absolute inset-0 w-16 h-16 -m-3 rounded-full border border-[var(--gold)] opacity-20 animate-ping" style={{ animationDuration: '3s' }} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[var(--text-muted)] text-sm animate-pulse">正在加载工作区</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  ),
});

export default function Home() {
  const router = useRouter();
  const [activePanel, setActivePanel] = usePageState('workspace-active-panel', 'text2img');
  const { power: localPower, deductPower } = usePower();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // 倒计时 effect（组件顶层，无论是否登录都注册，登录后自动失效）
  useEffect(() => {
    if (redirectCountdown <= 0 || isAuthenticated) return;
    const tick = setTimeout(() => setRedirectCountdown((n) => n - 1), 1000);
    return () => clearTimeout(tick);
  }, [redirectCountdown, isAuthenticated]);

  // 倒计时归零时跳转
  useEffect(() => {
    if (redirectCountdown === 0 && !isAuthenticated) {
      router.push('/login');
    }
  }, [redirectCountdown, isAuthenticated, router]);

  // 未登录：显示倒计时拦截页（hydration 时保持结构一致）
  if (!authLoading && !isAuthenticated) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative flex flex-col items-center justify-center"
      >
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-0 left-1/4 right-1/4 h-[400px] bg-gradient-to-b from-[var(--gold)]/5 to-transparent blur-[100px]" />
          <div className="absolute top-1/4 right-0 w-[300px] h-[300px] bg-gradient-to-l from-[var(--gold)]/3 to-transparent blur-[80px] rounded-l-full" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 text-center px-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold-hover)] flex items-center justify-center shadow-[0_8px_32px_rgba(212,175,55,0.4)]">
            <span className="text-black font-bold text-3xl" style={{ fontFamily: 'serif' }}>敦</span>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">敦煌金AI设计平台</h2>
            <p className="text-[var(--text-muted)] text-sm">请先登录后使用全部功能</p>
            <p className="text-[var(--text-dim)] text-xs mt-1">
              <span className="text-[var(--gold)] font-mono text-lg">{redirectCountdown}</span> 秒后自动跳转登录页面...
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <a
              href="/login"
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold text-center shadow-[0_4px_20px_rgba(212,175,55,0.4)] hover:shadow-[0 4px_28px_rgba(212,175,55,0.6)] hover:scale-105 transition-all"
            >
              立即登录
            </a>
            <a
              href="/login"
              className="w-full py-3 px-6 rounded-xl border border-[var(--gold)]/40 text-[var(--gold)] font-medium text-center hover:bg-[var(--gold)]/10 transition-all"
            >
              了解敦煌金AI
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 计算实际算力
  const power = isAuthenticated && user 
    ? (user.role === 'admin' ? Math.max(user.power, ADMIN_DEFAULT_POWER) : user.power)
    : localPower;

  // 加载中状态
  if (authLoading) {
    return (
      <div suppressHydrationWarning className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[var(--gold)] opacity-[0.04] blur-[120px]" />
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle, var(--gold) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            opacity: 0.02,
          }} />
        </div>
        
        <div className="flex flex-col items-center gap-8 relative z-10">
          {/* Logo */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold-hover)] flex items-center justify-center shadow-[0_8px_32px_rgba(212,175,55,0.4)] animate-pulse">
              <span className="text-black font-bold text-3xl" style={{ fontFamily: 'serif' }}>敦</span>
            </div>
            {/* 外圈光环 */}
            <div className="absolute inset-0 w-20 h-20 rounded-2xl border border-[var(--gold)] opacity-30 animate-ping" style={{ animationDuration: '4s' }} />
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">敦煌金AI设计平台</h2>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '100ms' }} />
              <div className="w-3 h-3 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '200ms' }} />
            </div>
            <p className="text-[var(--text-muted)] text-sm">正在初始化...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative">
      {/* 背景装饰层 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* 顶部渐变光 */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[400px] bg-gradient-to-b from-[var(--gold)]/5 to-transparent blur-[100px]" />
        {/* 右侧装饰 */}
        <div className="absolute top-1/4 right-0 w-[300px] h-[300px] bg-gradient-to-l from-[var(--gold)]/3 to-transparent blur-[80px] rounded-l-full" />
      </div>

      <Header />

      <main className="pt-[64px] h-screen flex overflow-hidden relative z-10">
        <Sidebar
          activePanel={activePanel}
          onPanelChange={setActivePanel}
        />
        
        <WorkspacePanel
          activePanel={activePanel}
          power={power}
          onDeductPower={deductPower}
        />
      </main>
    </div>
  );
}
