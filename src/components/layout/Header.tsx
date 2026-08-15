'use client';

import { useState, useEffect } from 'react';
import { Zap, Settings, User, LayoutDashboard, UserCircle, Menu, ChevronDown, LogOut, Shield, Sparkles, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { usePower, ADMIN_DEFAULT_POWER } from '@/lib/power';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { power: localPower } = usePower();
  const { user, isAuthenticated, logout } = useAuth();

  // 确保客户端挂载后再渲染认证相关内容，解决 hydration 不匹配
  useEffect(() => {
    setMounted(true);
  }, []);

  // 计算实际算力：优先使用用户数据，确保管理员有足够算力
  const power = mounted && isAuthenticated && user 
    ? (user.role === 'admin' ? Math.max(user.power, ADMIN_DEFAULT_POWER) : user.power)
    : localPower;

  // 关闭移动菜单当路由改变
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // 点击外部关闭用户菜单
  useEffect(() => {
    const handleClickOutside = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [userMenuOpen]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    { id: 'workspace', label: '设计工坊', href: '/', icon: LayoutDashboard },
    { id: 'gallery', label: '作品展示', href: '/gallery', icon: ImageIcon },
    { id: 'profile', label: '个人中心', href: '/profile', icon: UserCircle },
  ];

  return (
    <>
      <header
        suppressHydrationWarning

        className="fixed top-0 left-0 right-0 h-[64px] flex items-center justify-between px-4 md:px-6 z-50"
        style={{
          background: 'linear-gradient(180deg, var(--bg-secondary) 0%, rgba(14, 14, 18, 0.95) 100%)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* 底部渐变金线 */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-40" />

        {/* 左侧：Logo + 导航 */}
        <div className="flex items-center gap-6 md:gap-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            {/* Logo 图标 - 真实图片 */}
            <div className="relative">
              <div
                className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold-hover)] flex items-center justify-center shadow-[0_4px_16px_rgba(212,175,55,0.3)] group-hover:shadow-[0_4px_24px_rgba(212,175,55,0.5)] transition-all duration-300"
              >
                <Image
                  src="/logo.png"
                  alt="敦煌金AI设计平台"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              {/* 图标光晕 */}
              <div className="absolute inset-0 rounded-xl bg-[var(--gold)] opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300" />
            </div>
            
            <div className="flex flex-col">
              <span className="hidden sm:block text-base font-semibold text-[var(--text-primary)] tracking-wide">
                敦煌金AI设计平台
              </span>
              <span className="hidden md:block text-[10px] text-[var(--text-dim)] tracking-[2px] uppercase">
                Dunhuang Gold AI Design
              </span>
            </div>
          </Link>

          {/* 桌面端导航 - 仅登录后显示 */}
          {mounted && isAuthenticated && (
            <nav className="hidden lg:flex items-center gap-1 pl-4 border-l border-[var(--border-color)]">
              {navItems.map((item) => {
                const isActive = (item.id === 'workspace' && pathname === '/') || pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden',
                      isActive
                        ? 'text-[var(--gold)] bg-[var(--gold-muted)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    )}
                  >
                    {/* 悬停金色光效 */}
                    {!isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold-muted)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                    )}
                    <item.icon className={cn(
                      'w-4 h-4 transition-transform group-hover:scale-110',
                      isActive && 'text-[var(--gold)]'
                    )} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* 右侧：功能按钮 */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* 算力显示 - 仅登录后显示 */}
          {mounted && isAuthenticated && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-[var(--gold-border)] transition-colors">
              {/* 电量图标 */}
              <div className="relative">
                <Zap className="w-4 h-4 text-[var(--gold)]" />
                <div className="absolute inset-0 bg-[var(--gold)] blur-sm opacity-50" />
              </div>
              <span className="hidden sm:inline text-[var(--text-muted)] text-xs">算力</span>
              <span className="text-[var(--gold)] font-bold font-mono tracking-wider">
                {user?.power ?? power}
              </span>
            </div>
          )}

          {/* 后台管理 - 仅管理员显示 */}
          {mounted && isAuthenticated && user?.role === 'admin' && (
            <Link
              href="/admin"
              className="hidden md:flex w-10 h-10 rounded-xl border border-[var(--border-color)] items-center justify-center text-[var(--text-dim)] hover:text-[var(--gold)] hover:border-[var(--gold-border)] hover:bg-[var(--gold-muted)] transition-all duration-200 group"
              title="后台管理"
            >
              <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
            </Link>
          )}

          {/* 用户区域 */}
          {mounted && (isAuthenticated ? (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--bg-hover)] transition-all group"
              >
                {/* 用户头像 - 金色边框 */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] p-[2px] shadow-[0_2px_10px_rgba(212,175,55,0.3)]">
                    <div className="w-full h-full rounded-[10px] bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden">
                      {user?.avatar ? (
                        <Image src={user.avatar} alt={user?.nickname ? `${user.nickname}的头像` : "用户头像"} className="w-full h-full object-cover" width={36} height={36} unoptimized />
                      ) : (
                        <User className="w-4 h-4 text-[var(--gold)]" />
                      )}
                    </div>
                  </div>
                  {/* 状态点 */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--success)] border-2 border-[var(--bg-secondary)]" />
                </div>
                
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm text-[var(--text-primary)] max-w-[80px] truncate">
                    {user?.nickname || user?.email?.split('@')[0]}
                  </span>
                  {user?.role === 'admin' && (
                    <span className="text-[9px] text-[var(--gold)] tracking-wider uppercase flex items-center gap-0.5">
                      <Shield className="w-3 h-3" /> 管理员
                    </span>
                  )}
                </div>
                
                <ChevronDown className={cn(
                  'w-4 h-4 text-[var(--text-muted)] transition-all duration-200 hidden md:block',
                  userMenuOpen && 'rotate-180'
                )} />
              </button>

              {/* 下拉菜单 - 玻璃拟态 */}
              {userMenuOpen && (
                <div 
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50 animate-scale-in"
                  style={{
                    background: 'var(--bg-glass)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(212, 175, 55, 0.1)',
                  }}
                >
                  {/* 顶部装饰 */}
                  <div className="h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60" />
                  
                  {/* 用户信息 */}
                  <div className="p-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] p-[2px]">
                        <div className="w-full h-full rounded-[10px] bg-[var(--bg-secondary)] flex items-center justify-center">
                          {user?.avatar ? (
                            <Image src={user.avatar} alt={user?.nickname ? `${user.nickname}的头像` : "用户头像"} className="w-full h-full rounded-[10px] object-cover" width={48} height={48} unoptimized />
                          ) : (
                            <User className="w-5 h-5 text-[var(--gold)]" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {user?.nickname || '用户'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* 菜单项 */}
                  <div className="p-2">
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                    >
                      <UserCircle className="w-4 h-4" />
                      个人中心
                    </Link>
                    
                    {user?.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all md:hidden"
                      >
                        <Settings className="w-4 h-4" />
                        后台管理
                      </Link>
                    )}
                    
                    <div className="my-2 h-[1px] bg-[var(--border-color)]" />
                    
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--error)] hover:bg-[var(--error-light)] transition-all w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                  
                  {/* 底部装饰 */}
                  <div className="h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-40" />
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black text-sm font-semibold hover:shadow-[0_4px_20px_rgba(212,175,55,0.4)] transition-all"
            >
              登录
            </Link>
          ))}

          {/* 移动端菜单按钮 */}
          {mounted && isAuthenticated && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 rounded-xl border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-border)] transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 移动端菜单 */}
        {mounted && mobileMenuOpen && isAuthenticated && (
          <div 
            className="absolute top-full left-0 right-0 mt-2 mx-4 rounded-xl p-4 z-50 animate-scale-in"
            style={{
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = (item.id === 'workspace' && pathname === '/') || pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'text-[var(--gold)] bg-[var(--gold-muted)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
