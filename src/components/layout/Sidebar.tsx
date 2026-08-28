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
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeatures, type PublicFeature } from '@/lib/use-features';
import { isFeatureRegistered } from '@/lib/feature-registry';
import { preloadFeatureCosts } from '@/lib/feature-costs';
import { apiClient, API_ROUTES } from '@/lib/api-client';

// 把 feature_id 映射到 lucide 图标（小写 key）
// 之前错误地写为 ES6 shorthand: { Mountain } -> key="Mountain"
// 修复后：{ relief: Mountain } -> key="relief"
const ICON_MAP: Record<string, LucideIcon> = {
  relief: Mountain,
  image3d: Box,
  '2dto3d': Layers,
  dialogue: MessageSquare,
  text2img: Image,
  refine: Sparkles,
  blend: Blend,
  oneclick: Wand2,
  multiview: Grid3X3,
  sketch: PenTool,
  free: Palette,
  text2video: Video,
  img2video: Film,
  removebg: Eraser,
  upscale: Maximize2,
  watermark: Droplet,
  tryon: Shirt,
};

// 把 feature_id 映射到中文标签（fallback）
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

// kebab-case（/api/features 返回）→ 短 id（feature-registry/组件层）归一化
// 与 src/lib/api-service.ts 的 featureIdAliases 对齐，并补齐其缺失项
const FEATURE_ID_ALIAS: Record<string, string> = {
  'image-3d': 'image3d',
  stereo: '2dto3d',
  'product-refine': 'refine',
  'multi-image': 'blend',
  'one-click-design': 'oneclick',
  'multi-view': 'multiview',
  'sketch-realistic': 'sketch',
  'free-creation': 'free',
  image2video: 'img2video',
  'remove-background': 'removebg',
  'remove-watermark': 'watermark',
  'ai-chat': 'dialogue',
};

function normalizeFeatureId(id: string): string {
  return FEATURE_ID_ALIAS[id] || id;
}

// 把 feature_id 映射到显示分组（前端兜底）
function getDisplayGroup(id: string): string {
  if (['relief', 'image3d', '2dto3d'].includes(id)) return '浮雕圆雕';
  if (['text2video', 'img2video'].includes(id)) return '生成视频';
  if (['removebg', 'upscale', 'watermark', 'tryon'].includes(id)) return '实用工具';
  // dialogue 归入"灵感与创作"，并通过 order=0 在组内排第一
  return '灵感与创作';
}

// 按 feature id 排序的菜单分组构造
function buildMenuGroups(features: PublicFeature[]) {
  // 只保留: 有 id + 组件已注册（归一化后）+ 未禁用 的功能
  // （isFeatureRegistered 保证 Sidebar 与 WorkspacePanel 用同一套 feature_code）
  const enabled = features
    .map((f) => ({ ...f, id: normalizeFeatureId(f.id) }))
    .filter(
      (f) => f.id && isFeatureRegistered(f.id) && f.enabled !== false
    );
  const groups: Record<string, PublicFeature[]> = {};
  for (const f of enabled) {
    // W2·优先使用 DB 的 displayGroup,缺失则前端兜底
    const group = (f as { displayGroup?: string | null }).displayGroup || getDisplayGroup(f.id);
    if (!groups[group]) groups[group] = [];
    groups[group].push(f);
  }
  // 固定分组顺序；组内按 features.sortOrder 排序（DB features 表字段名）
  // （静态 fallback 的 FEATURE_LIST 用 order 字段，DB 用 sortOrder，两者都兼容）
  const order = ['灵感与创作', '浮雕圆雕', '生成视频', '实用工具'];
  return order
    .filter((k) => groups[k]?.length)
    .map((k) => ({
      title: k,
      items: groups[k].sort((a, b) => (a.sortOrder ?? a.order ?? 99) - (b.sortOrder ?? b.order ?? 99)),
    }));
}

interface SidebarProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
  onNavigate?: (path: string) => void;
}

export default function Sidebar({ activePanel, onPanelChange, onNavigate }: SidebarProps) {
  // 🔑 L1: 从配置驱动的 hooks（不再硬编码）
  const { features, loading } = useFeatures();
  // menuGroups 现在从 /api/features 动态计算（保持原视觉）
  const menuGroups = buildMenuGroups(features);
  const [featuresStatus, setFeaturesStatus] = useState<
    Record<string, { enabled: boolean; reason?: string }>
  >({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  // 应用启动时加载最新算力配置（同步 DB → localStorage）
  useEffect(() => {
    preloadFeatureCosts();
  }, []);

  // 检查所有功能的启用状态（需要登录）
  useEffect(() => {
    // 安全修复（P0-1）：token 已从 localStorage 移除，改用 /api/auth/me 判断登录态
    const checkAuthAndFetchStatus = async () => {
      try {
        // 先确认登录态（HttpOnly cookie 鉴权）
        const meRes = await apiClient.get(API_ROUTES.me, { withCredentials: true, auth: false });
        if (!meRes.success) return; // 未登录时不拉取状态

        const fetchFeaturesStatus = async () => {
          try {
            // Phase 9.25 · 修复: /api/admin/features-status 已在 Phase 9.24 清理
            // 改用公共 /api/features(已含 enabled 字段)
            const result = await apiClient.get<{ features: Array<{ id: string; enabled: boolean; reason?: string }> }>(API_ROUTES.features, { withCredentials: true, auth: false });

            if (result.success) {
              const status: Record<string, { enabled: boolean; reason?: string }> = {};
              const list = result.data?.features ?? [];
              list.forEach((f: { id: string; enabled: boolean; reason?: string }) => {
                status[f.id] = {
                  enabled: f.enabled,
                  reason: f.reason,
                };
              });
              setFeaturesStatus(status);
            }
          } catch (error) {
            console.error('获取功能状态时出错:', error);
          }
        };

        await fetchFeaturesStatus();
      } catch (error) {
        console.error('检查登录态失败:', error);
      }
    };

    checkAuthAndFetchStatus();
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
              {/* 渐变短线 + COMMAND（Logo 图已删除） */}
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
          {!loading && menuGroups.map((group, groupIndex) => (
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
                  // 🔧 修复：之前 ICON_MAP key 错误（大写变量名），现在用真实小写 id 查
                  const Icon = ICON_MAP[item.id] || Sparkles;
                  const isActive = activePanel === item.id;
                  const featureStatus = featuresStatus[item.id];
                  // 未加载时默认启用，避免首屏所有功能都显示为锁定
                  const isEnabled = featureStatus ? featureStatus.enabled : true;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handlePanelChange(item.id)}
                      disabled={!isEnabled}
                      data-testid={`feature-${item.id}`}
                      className={cn(
                        'relative flex items-center gap-3 rounded-lg transition-all duration-200 text-left group',
                        isExpanded ? 'px-3 py-2.5' : 'px-0 py-3 justify-center',
                        isEnabled
                          ? isActive
                            ? 'bg-gradient-to-r from-[var(--gold-muted)] to-transparent text-[var(--gold)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/50 hover:text-[var(--text-primary)]'
                          : 'text-[var(--text-dim)] cursor-not-allowed opacity-50'
                      )}
                      style={{ animationDelay: `${(groupIndex * 50) + (itemIndex * 30)}ms` }}
                      title={!isExpanded ? `${label}${!isEnabled ? ` (${featureStatus.reason})` : ''}` : undefined}
                    >
                      {/* 活动指示器 - 金色光效 */}
                      {isActive && isEnabled && (
                        <>
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-gradient-to-b from-[var(--gold-bright)] via-[var(--gold)] to-[var(--gold-dark)] rounded-r-full shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
                          {/* 发光背景 */}
                          <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold-muted)] to-transparent rounded-lg opacity-50" />
                        </>
                      )}

                      <div className={cn(
                        'relative z-10 flex-shrink-0 transition-all duration-200',
                        isEnabled && (isActive ? 'text-[var(--gold)]' : 'group-hover:text-[var(--gold)]')
                      )}>
                        {!isEnabled ? (
                          <Lock className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
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
                                ? (isActive ? 'text-[var(--gold)] opacity-70' : 'text-[var(--text-dim)] group-hover:text-[var(--text-muted)]')
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

          {/* 底部状态区域 */}
          <div className="px-4 py-4">
            <div className={cn(
              'flex items-center gap-2 text-xs',
              !isExpanded && 'justify-center'
            )}>
              {isExpanded ? (
                <>
                  {/* 敦煌卷草纹装饰 */}
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[var(--gold)] opacity-60">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" fill="currentColor" opacity="0.3"/>
                    <circle cx="12" cy="12" r="3" fill="currentColor"/>
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
