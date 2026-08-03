'use client';

import { useState, useEffect } from 'react';
import {
  Mountain,
  Box,
  Layers,
  MessageSquare,
  Image,
  Sparkles,
  Blend,
  Wand2,
  Grid3X3,
  PenTool,
  Palette,
  Video,
  Film,
  Eraser,
  Maximize2,
  Droplet,
  Shirt,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Lock,
  AlertCircle,
  Shield,
  LogOut,
  LogIn,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeatures, useCurrentUser, type PublicFeature } from '@/lib/use-features';
import { isFeatureRegistered } from '@/lib/feature-registry';

// 把 lucide 图标名映射到组件（前端必备）
const ICON_MAP: Record<string, LucideIcon> = {
  Mountain,
  Box,
  Layers,
  MessageSquare,
  Image,
  Sparkles,
  Blend,
  Wand2,
  Grid3X3,
  PenTool,
  Palette,
  Video,
  Film,
  Eraser,
  Maximize2,
  Droplet,
  Shirt,
};

// 把 feature id 映射到静态 label（兜底：如果 /api/features 没返回 label）
const LABEL_MAP: Record<string, string> = {
  relief: '图转浮雕图',
  image3d: '图转3D模型',
  '2dto3d': '平面转雕塑',
  dialogue: 'AI对话',
  text2img: '文案生图',
  refine: '产品精修',
  blend: '多图融合',
  oneclick: '一键设计',
  multiview: '生成多视图',
  sketch: '线稿/写实',
  free: '自由创作区',
  text2video: '文生视频',
  img2video: '图生视频',
  removebg: '移除背景',
  upscale: '高清放大',
  watermark: '去除水印',
  tryon: '佩戴效果',
};

// 把 feature id 映射到显示分组（前端兜底）
function getDisplayGroup(id: string): string {
  if (['relief', 'image3d', '2dto3d'].includes(id)) return '浮雕圆雕';
  if (['text2video', 'img2video'].includes(id)) return '生成视频';
  if (['removebg', 'upscale', 'watermark', 'tryon'].includes(id)) return '实用工具';
  return '灵感与创作';
}

// 按 feature id 排序的菜单分组构造
function buildMenuGroups(features: PublicFeature[]) {
  // 只保留: 有 id + 组件已注册 + 未禁用 的功能
  // （isFeatureRegistered 保证 Sidebar 与 WorkspacePanel 用同一套 feature_code）
  const enabled = features.filter(
    (f) => f.id && isFeatureRegistered(f.id) && f.enabled !== false
  );
  const groups: Record<string, PublicFeature[]> = {};
  for (const f of enabled) {
    const group = getDisplayGroup(f.id);
    if (!groups[group]) groups[group] = [];
    groups[group].push(f);
  }
  // 固定分组顺序
  const order = ['浮雕圆雕', '灵感与创作', '生成视频', '实用工具'];
  return order
    .filter((k) => groups[k])
    .map((title) => ({
      title,
      items: groups[title].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    }));
}

interface SidebarProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
  onNavigate?: (path: string) => void;
}

export default function Sidebar({ activePanel, onPanelChange, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovering, setHovering] = useState(false);

  // 🔑 L1: 从配置驱动的 hooks（不再硬编码）
  const { features: featureList } = useFeatures();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // menuGroups 现在从 /api/features 动态计算（保持原视觉）
  const menuGroups = buildMenuGroups(featureList);
  const [featuresStatus, setFeaturesStatus] = useState<
    Record<string, { enabled: boolean; reason?: string }>
  >({});

  // 响应式：检测屏幕宽度（防抖）
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (window.innerWidth < 768) {
          setCollapsed(true);
        }
      }, 150);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // 检查所有功能的启用状态（需要登录）
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dunhuang_token') : null;
    if (!token) return; // 未登录时不调用

    const fetchFeaturesStatus = async () => {
      try {
        const response = await fetch('/api/admin/features-status');
        const result = await response.json();

        if (result.success) {
          const status: Record<string, { enabled: boolean; reason?: string }> = {};
          Object.keys(result.data).forEach((featureId) => {
            status[featureId] = {
              enabled: result.data[featureId].enabled,
              reason: result.data[featureId].reason,
            };
          });
          setFeaturesStatus(status);
        } else if (result.error === '未登录') {
          // 未登录状态下静默忽略（正常情况）
        } else {
          console.warn('获取功能状态失败:', result.error);
        }
      } catch (error) {
        console.error('获取功能状态时出错:', error);
      }
    };

    fetchFeaturesStatus();
  }, []);

  // 点击菜单项后关闭移动端菜单
  const handlePanelChange = (id: string) => {
    const status = featuresStatus[id];
    // 只有明确标记为禁用时才阻止（未加载状态时默认放行）
    if (status && status.enabled === false) {
      return;
    }
    onPanelChange(id);
    setMobileOpen(false);
  };

  const isExpanded = !collapsed || hovering;

  return (
    <>
      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 移动端菜单触发按钮 */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-6 left-4 z-30 md:hidden w-14 h-14 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] text-black shadow-[0_4px_20px_rgba(212,175,55,0.4)] flex items-center justify-center animate-scale-in hover:scale-110 transition-transform"
        aria-label="打开菜单"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* 侧边栏 */}
      <aside
        suppressHydrationWarning
        className={cn(
          'h-full flex flex-col overflow-hidden transition-all duration-300 ease-out relative',
          // 桌面端
          'hidden md:flex',
          isExpanded ? 'w-[260px]' : 'w-[68px]',
          // 移动端
          'fixed md:relative inset-y-0 left-0 z-40',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
        }}
      >
        {/* 顶部金色装饰线 */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60" />

        {/* 敦煌纹样装饰 - 右上角 */}
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden opacity-20 pointer-events-none">
          <svg viewBox="0 0 64 64" className="w-full h-full text-[var(--gold)]">
            <path d="M64 0 Q32 32 0 64" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <path d="M64 16 Q32 32 16 64" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="48" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 min-h-[60px] relative">
          {/* 左侧金色装饰 */}
          <div className="absolute left-0 top-4 bottom-4 w-[1px] bg-gradient-to-b from-transparent via-[var(--gold-border)] to-transparent" />

          {isExpanded && (
            <div className="flex items-center gap-2 animate-fade-in">
              <div className="w-8 h-[2px] bg-gradient-to-r from-[var(--gold)] to-transparent rounded-full" />
              <span className="text-[10px] font-bold text-[var(--text-dim)] tracking-[3px] uppercase">
                COMMAND
              </span>
            </div>
          )}

          <button
            onClick={() => {
              setCollapsed(!collapsed);
              setHovering(false);
            }}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--gold)] hover:bg-[var(--gold-muted)] transition-all duration-200',
              !isExpanded && 'mx-auto'
            )}
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* 移动端关闭按钮 */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--gold)] hover:bg-[var(--gold-muted)] transition-all absolute right-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 分割线 */}
        <div className="mx-4 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />

        {/* Menu Groups */}
        <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {menuGroups.map((group, groupIndex) => (
            <div key={group.title} className="mb-3">
              {isExpanded && (
                <div
                  className="px-4 py-2 flex items-center gap-2 animate-fade-in"
                  style={{ animationDelay: `${groupIndex * 50}ms` }}
                >
                  <div className="w-3 h-[1px] bg-[var(--gold-border)]" />
                  <h3 className="text-[10px] font-bold text-[var(--text-dim)] tracking-[2px] uppercase">
                    {group.title}
                  </h3>
                  <div className="flex-1 h-[1px] bg-[var(--border-color)]" />
                </div>
              )}

              <div className="flex flex-col gap-0.5 px-2">
                {group.items.map((item, itemIndex) => {
                  // 🔑 L1: 配置驱动的 label/icon 查找
                  const label = item.name || LABEL_MAP[item.id] || item.id;
                  const labelEn = (item.id || '').toUpperCase();
                  const Icon = ICON_MAP[item.icon || ''] || Sparkles;
                  const isActive = activePanel === item.id;
                  const featureStatus = featuresStatus[item.id];
                  // 未加载时默认启用，避免首屏所有功能都显示为锁定
                  const isEnabled = featureStatus ? featureStatus.enabled : true;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handlePanelChange(item.id)}
                      disabled={!isEnabled}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg transition-all duration-200 text-left group',
                        isExpanded ? 'px-3 py-2.5' : 'px-0 py-3 justify-center',
                        isEnabled
                          ? isActive
                            ? 'bg-gradient-to-r from-[var(--gold-muted)] to-transparent text-[var(--gold)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/50 hover:text-[var(--text-primary)]'
                          : 'text-[var(--text-dim)] cursor-not-allowed opacity-50'
                      )}
                      style={{ animationDelay: `${groupIndex * 50 + itemIndex * 30}ms` }}
                      title={
                        !isExpanded
                          ? `${label}${!isEnabled ? ` (${featureStatus.reason})` : ''}`
                          : undefined
                      }
                    >
                      {/* 活动指示器 - 金色光效 */}
                      {isActive && isEnabled && (
                        <>
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-gradient-to-b from-[var(--gold-bright)] via-[var(--gold)] to-[var(--gold-dark)] rounded-r-full shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
                          {/* 发光背景 */}
                          <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold-muted)] to-transparent rounded-lg opacity-50" />
                        </>
                      )}

                      <div
                        className={cn(
                          'relative z-10 flex-shrink-0 transition-all duration-200',
                          isEnabled &&
                            (isActive ? 'text-[var(--gold)]' : 'group-hover:text-[var(--gold)]')
                        )}
                      >
                        {!isEnabled ? <Lock className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>

                      {isExpanded && (
                        <div className="relative z-10 flex flex-col gap-0.5 overflow-hidden animate-fade-in flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{label}</span>
                            {!isEnabled && (
                              <AlertCircle className="w-3 h-3 text-[var(--text-dim)] flex-shrink-0" />
                            )}
                          </div>
                          <span
                            className={cn(
                              'text-[9px] tracking-wider uppercase transition-colors truncate',
                              isEnabled
                                ? isActive
                                  ? 'text-[var(--gold)] opacity-70'
                                  : 'text-[var(--text-dim)] group-hover:text-[var(--text-muted)]'
                                : 'text-[var(--text-dim)]'
                            )}
                          >
                            {labelEn}
                          </span>
                        </div>
                      )}

                      {/* 悬停金色光点 */}
                      {isEnabled && !isActive && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[var(--gold)] opacity-0 group-hover:opacity-60 transition-opacity" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 底部区域 */}
        <div className="relative mt-auto">
          {/* 顶部金色装饰线 */}
          <div className="mx-4 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent mb-3" />

          {/* 🔑 L1: 用户角色入口（按角色过滤显示） */}
          <div className="flex flex-col gap-0.5 px-2 pb-3">
            {/* 作品展示入口（所有登录用户） */}
            {currentUser && (
              <button
                onClick={() =>
                  onNavigate ? onNavigate('/gallery') : window.location.assign('/gallery')
                }
                className={cn(
                  'relative flex items-center gap-3 rounded-lg transition-all duration-200 text-left',
                  isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                  'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/50 hover:text-[var(--text-primary)]'
                )}
                title={!isExpanded ? '作品展示' : undefined}
              >
                <Image className="w-4 h-4" />
                {isExpanded && <span className="text-sm">作品展示</span>}
              </button>
            )}

            {/* 个人中心入口（所有登录用户） */}
            {currentUser && (
              <button
                onClick={() =>
                  onNavigate ? onNavigate('/profile') : window.location.assign('/profile')
                }
                className={cn(
                  'relative flex items-center gap-3 rounded-lg transition-all duration-200 text-left',
                  isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                  'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/50 hover:text-[var(--text-primary)]'
                )}
                title={!isExpanded ? '个人中心' : undefined}
              >
                <Box className="w-4 h-4" />
                {isExpanded && <span className="text-sm">个人中心</span>}
              </button>
            )}

            {/* 🔑 L1: 管理后台入口（仅 admin 可见） */}
            {isAdmin && (
              <button
                onClick={() =>
                  onNavigate ? onNavigate('/admin') : window.location.assign('/admin')
                }
                className={cn(
                  'relative flex items-center gap-3 rounded-lg transition-all duration-200 text-left',
                  isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                  'text-[var(--gold)] bg-[var(--gold-muted)]/40 hover:bg-[var(--gold-muted)] border border-[var(--gold-border)]'
                )}
                title={!isExpanded ? '管理后台' : undefined}
              >
                <Shield className="w-4 h-4" />
                {isExpanded && <span className="text-sm font-medium">管理后台</span>}
              </button>
            )}

            {/* 登录/退出按钮 */}
            {currentUser ? (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') localStorage.removeItem('dunhuang_token');
                  window.location.assign('/login');
                }}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg transition-all duration-200 text-left',
                  isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                  'text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/30'
                )}
                title={!isExpanded ? '退出登录' : undefined}
              >
                <LogOut className="w-4 h-4" />
                {isExpanded && <span className="text-sm">退出登录</span>}
              </button>
            ) : (
              <button
                onClick={() => window.location.assign('/login')}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg transition-all duration-200 text-left',
                  isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                  'text-[var(--gold)] hover:bg-[var(--gold-muted)]/40'
                )}
                title={!isExpanded ? '登录' : undefined}
              >
                <LogIn className="w-4 h-4" />
                {isExpanded && <span className="text-sm">登录</span>}
              </button>
            )}
          </div>

          {/* 底部状态区域 */}
          <div className="px-4 py-4">
            <div className={cn('flex items-center gap-2 text-xs', !isExpanded && 'justify-center')}>
              {isExpanded ? (
                <>
                  {/* 敦煌卷草纹装饰 */}
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[var(--gold)] opacity-60">
                    <path
                      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"
                      fill="currentColor"
                      opacity="0.3"
                    />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                  <span className="text-[var(--text-dim)]">系统运行正常</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse shadow-[0_0_8px_rgba(74,154,122,0.5)]" />
                    <span className="text-[var(--success)] text-[10px]">ONLINE</span>
                  </div>
                </>
              ) : (
                <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse shadow-[0_0_8px_rgba(74,154,122,0.5)]" />
              )}
            </div>
          </div>

          {/* 底部金色渐变 */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-40" />
        </div>
      </aside>
    </>
  );
}
