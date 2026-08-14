'use client';

// 标记为动态渲染，避免静态生成时缺少客户端上下文

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getAuthHeader } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Download,
  Heart,
  Share2,
  X,
  Search,
  Sparkles,
  Box,
  Zap,
  Palette,
  Trash2,
  Check,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { cn } from '@/lib/utils';
import { usePageState } from '@/hooks/usePageState';

/* eslint-disable @typescript-eslint/no-explicit-any */


// 模拟数据（当API无数据时展示）
const mockImages: any[] = [];

const categories = [
  '全部',
  '文案生图',
  '图转浮雕图',
  '图转3D模型',
  '产品精修',
  '多图融合',
  '线稿/写实',
  '平面转雕塑',
  '自由创作区',
  '一键设计',
  '生成多视图',
  '文生视频',
  '图生视频',
];

// 功能 ID（数据库 type 字段）→ 作品展示分类名 映射
// 与 features.ts 中的 FEATURE_DEFINITIONS key 保持一致
const FEATURE_TO_CATEGORY: Record<string, string> = {
  text2img: '文案生图',
  'product-refine': '产品精修',
  'multi-image': '多图融合',
  'one-click-design': '一键设计',
  'multi-view': '生成多视图',
  'sketch-realistic': '线稿/写实',
  'free-creation': '自由创作区',
  'remove-background': '移除背景',
  upscale: '高清放大',
  'remove-watermark': '去除水印',
  relief: '图转浮雕图',
  'image-3d': '图转3D模型',
  stereo: '平面转雕塑',
  text2video: '文生视频',
  image2video: '图生视频',
  'ai-chat': 'AI对话',
};

// 类型对应的图标和颜色
const typeConfig: Record<string, { icon: any; color: string }> = {
  文案生图: { icon: Sparkles, color: '#C8A45C' },
  图转浮雕图: { icon: Box, color: '#B8860B' },
  图转3D模型: { icon: Box, color: '#DAA520' },
  产品精修: { icon: Palette, color: '#CD853F' },
  多图融合: { icon: Sparkles, color: '#C8A45C' },
  '线稿/写实': { icon: Palette, color: '#CD853F' },
  平面转雕塑: { icon: Box, color: '#DAA520' },
  自由创作区: { icon: Sparkles, color: '#C8A45C' },
  一键设计: { icon: Sparkles, color: '#C8A45C' },
  生成多视图: { icon: Box, color: '#DAA520' },
  文生视频: { icon: Zap, color: '#B8860B' },
  图生视频: { icon: Zap, color: '#B8860B' },
};

// 敦煌花纹装饰
function DunhuangCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const rotations = { tl: '0', tr: '90', bl: '-90', br: '180' };
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute w-16 h-16 opacity-10"
      style={{
        [position.includes('t') ? 'top' : 'bottom']: '-8px',
        [position.includes('l') ? 'left' : 'right']: '-8px',
        transform: `rotate(${rotations[position]}deg)`,
        color: 'var(--gold)',
      }}
    >
      <path
        d="M0,50 Q25,25 50,0 Q75,25 100,50 Q75,75 50,100 Q25,75 0,50"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  );
}

export default function GalleryPage() {
  const [images, setImages] = useState(mockImages);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [filter, setFilter] = usePageState('gallery-filter', '全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = usePageState('gallery-sort', '最新');
  const [mounted] = useState(true);
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // 加载真实作品数据
  useEffect(() => {
    const fetchRealWorks = async () => {
      try {
        const authHeader = getAuthHeader();
        const res = await fetch('/api/works?limit=100', {
          credentials: 'include',
          headers: { ...authHeader },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.length > 0) {
            const realImages = json.data
              .filter((item: any) => item.image_url && FEATURE_TO_CATEGORY[item.type])
              .map((item: any) => ({
                id: String(item.id),
                title: item.title || '无标题',
                type: FEATURE_TO_CATEGORY[item.type] || item.type,
                prompt: item.prompt || '',
                likes: typeof item.likes === 'number' ? item.likes : 0,
                imageUrl: item.image_url,
                videoUrl: item.video_url || null,
                modelUrl: item.model_url || null,
              }));
            setImages(realImages);
          }
        }
      } catch (e) {
        console.error('[Gallery] 加载作品失败', e);
      }
    };
    fetchRealWorks();
  }, []);

  const filteredImages = images.filter((img) => {
    const matchesFilter = filter === '全部' || img.type === filter;
    const matchesSearch =
      img.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        setImages((imgs) =>
          imgs.map((img) => (img.id === id ? { ...img, likes: img.likes - 1 } : img))
        );
      } else {
        newSet.add(id);
        setImages((imgs) =>
          imgs.map((img) => (img.id === id ? { ...img, likes: img.likes + 1 } : img))
        );
      }
      return newSet;
    });
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredImages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredImages.map((img) => img.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个作品吗？`)) return;

    try {
      const authHeader = getAuthHeader();
      // 批量删除 API
      const response = await fetch('/api/works/batch-delete', {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error('批量删除失败');
      }

      // 从本地状态移除
      setImages((imgs) => imgs.filter((img) => !selectedIds.has(img.id)));
    } catch (e) {
      console.error('删除失败:', e);
      toast.error('删除失败，请重试');
    } finally {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('确定要清空所有历史记录吗？此操作不可恢复！')) return;

    // 调用删除 API
    for (const img of images) {
      try {
        await fetch(`/api/works/${img.id}`, { credentials: 'include', method: 'DELETE' });
      } catch (e) {
        console.error('删除失败:', e);
      }
    }

    setImages([]);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] flex items-center justify-center animate-pulse">
          <span className="text-black font-bold text-2xl">敦</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Header />

      {/* 顶部装饰 */}
      <div className="fixed top-0 left-0 right-0 h-[300px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-b from-[var(--gold)]/5 via-[var(--gold)]/2 to-transparent rounded-full blur-[100px]" />
      </div>

      <div className="pt-20 px-4 md:px-6 pb-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* 搜索和筛选区域 */}
          <div
            className="p-6 rounded-2xl mb-8"
            style={{
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* 搜索框 */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索作品标题或描述..."
                  className="w-full h-12 pl-12 pr-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-muted)] transition-all"
                />
              </div>

              {/* 排序选择 */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-12 px-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none transition-all cursor-pointer"
              >
                <option value="最新">最新优先</option>
                <option value="最热">最热优先</option>
                <option value="点赞">点赞优先</option>
              </select>
            </div>

            {/* 功能标签栏 */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilter(category)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200',
                    filter === category
                      ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black shadow-[0_2px_15px_rgba(212,175,55,0.3)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gold-muted)] border border-transparent'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* 作品数量提示 */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-[var(--text-muted)]">
              共找到 <span className="text-[var(--gold)] font-medium">{filteredImages.length}</span>{' '}
              个作品
            </p>
            {/* 选择模式切换 */}
            <button
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (!isSelectionMode) setSelectedIds(new Set());
              }}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                isSelectionMode
                  ? 'bg-[var(--gold)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
              )}
            >
              {isSelectionMode ? '取消选择' : '选择'}
            </button>
          </div>

          {/* 瀑布流画廊 */}
          {filteredImages.length > 0 ? (
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3 space-y-3">
              {filteredImages.map((image, index) => {
                const config = typeConfig[image.type] || { icon: Sparkles, color: '#C8A45C' };
                const IconComponent = config.icon;

                return (
                  <div
                    key={image.id}
                    onClick={() => setSelectedImage(image)}
                    className="break-inside-avoid group cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(212,175,55,0.5)';
                        e.currentTarget.style.boxShadow = '0 8px 40px rgba(212,175,55,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
                      }}
                    >
                      {/* 类型标签 */}
                      <div
                        className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-medium"
                        style={{
                          background: 'rgba(0,0,0,0.7)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(212,175,55,0.3)',
                        }}
                      >
                        <IconComponent className="w-3 h-3" style={{ color: config.color }} />
                        <span className="text-white">{image.type}</span>
                      </div>

                      {/* 点赞按钮 */}
                      <button
                        onClick={(e) => handleLike(image.id, e)}
                        className={cn(
                          'absolute top-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all',
                          likedImages.has(image.id)
                            ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                            : 'bg-black/50 text-white hover:bg-[var(--gold)] hover:text-black backdrop-blur-sm',
                          isSelectionMode && 'hidden'
                        )}
                      >
                        <Heart
                          className={cn('w-4 h-4', likedImages.has(image.id) && 'fill-current')}
                        />
                      </button>

                      {/* 选择框 */}
                      {isSelectionMode && (
                        <button
                          onClick={(e) => handleToggleSelect(image.id, e)}
                          className={cn(
                            'absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all',
                            selectedIds.has(image.id)
                              ? 'bg-[var(--gold)] text-black'
                              : 'bg-black/50 text-white border-2 border-white/50 hover:border-[var(--gold)]'
                          )}
                        >
                          {selectedIds.has(image.id) ? <Check className="w-4 h-4" /> : null}
                        </button>
                      )}

                      {/* 图片 */}
                      <Image
                        src={image.imageUrl}
                        alt={image.title}
                        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        width={400}
                        height={300}
                        unoptimized
                      />

                      {/* 悬停遮罩 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="font-semibold text-white text-lg mb-1">{image.title}</h3>
                          <p className="text-white/70 text-sm line-clamp-2 mb-3">{image.prompt}</p>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-white/80 text-sm">
                              <Heart className="w-4 h-4" />
                              <span>{image.likes}</span>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[var(--gold)] hover:text-black transition-all"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[var(--gold)] hover:text-black transition-all"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 空状态 */
            <div className="text-center py-20">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)' }}
              >
                <Search className="w-10 h-10 text-[var(--text-dim)]" />
              </div>
              <h3 className="text-xl font-medium text-[var(--text-primary)] mb-2">暂无相关作品</h3>
              <p className="text-[var(--text-muted)]">试试其他关键词或筛选条件</p>
            </div>
          )}

          {/* 加载更多 */}
          {filteredImages.length > 0 && (
            <div className="text-center mt-12">
              <button
                className="px-8 py-3 rounded-xl font-medium transition-all hover:shadow-lg"
                style={{
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                }}
              >
                加载更多作品
              </button>
            </div>
          )}

          {/* 底部选择操作栏 */}
          {isSelectionMode && selectedIds.size > 0 && (
            <div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-6 py-4 rounded-2xl flex items-center gap-4 animate-scale-in"
              style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--gold)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.2)',
              }}
            >
              <span className="text-sm text-[var(--text-secondary)]">
                已选择 <span className="text-[var(--gold)] font-bold">{selectedIds.size}</span> 项
              </span>

              <button
                onClick={handleSelectAll}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all border border-[var(--border-color)]"
              >
                {selectedIds.size === filteredImages.length ? '取消全选' : '全选'}
              </button>

              <button
                onClick={handleDeleteSelected}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[var(--error)] text-white hover:bg-[var(--error)]/80 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          )}

          {/* 清空历史按钮 */}
          {filteredImages.length > 0 && !isSelectionMode && (
            <div className="text-center mt-8 mb-4">
              <button
                onClick={handleClearHistory}
                className="px-6 py-3 rounded-xl text-sm font-medium text-[var(--error)] bg-[var(--bg-tertiary)] hover:bg-[var(--error)]/10 transition-all border border-[var(--border-color)] flex items-center gap-2 mx-auto"
              >
                <Trash2 className="w-4 h-4" />
                清空历史记录
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 图片详情弹窗 */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-5xl w-full rounded-3xl overflow-hidden animate-scale-in"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶部装饰 */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60" />

            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex flex-col md:flex-row">
              {/* 图片区域 */}
              <div className="flex-1 relative bg-black/50">
                <Image
                  src={selectedImage.imageUrl}
                  alt={selectedImage.title}
                  className="w-full max-h-[60vh] object-contain"
                  width={1920}
                  height={1080}
                  unoptimized
                />

                {/* 类型标签 */}
                <div
                  className="absolute bottom-4 left-4 px-4 py-2 rounded-full flex items-center gap-2"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(212,175,55,0.3)',
                  }}
                >
                  {(() => {
                    const config = typeConfig[selectedImage.type] || {
                      icon: Sparkles,
                      color: '#C8A45C',
                    };
                    const IconComponent = config.icon;
                    return (
                      <>
                        <IconComponent className="w-4 h-4" style={{ color: config.color }} />
                        <span className="text-white text-sm">{selectedImage.type}</span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 信息区域 */}
              <div
                className="md:w-80 p-6 flex flex-col"
                style={{
                  background: 'var(--bg-secondary)',
                  borderLeft: '1px solid var(--border-color)',
                }}
              >
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    {selectedImage.title}
                  </h2>

                  <div className="mb-6">
                    <p className="text-xs text-[var(--text-muted)] mb-1">创作描述</p>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      {selectedImage.prompt}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl mb-6" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="w-5 h-5 text-[var(--gold)]" />
                        <span className="text-[var(--text-primary)] font-medium">
                          {selectedImage.likes}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text-dim)]">喜欢</span>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={(e) => handleLike(selectedImage.id, e)}
                    className={cn(
                      'flex-1 h-12 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                      likedImages.has(selectedImage.id)
                        ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--gold-muted)] hover:text-black'
                    )}
                  >
                    <Heart
                      className={cn('w-5 h-5', likedImages.has(selectedImage.id) && 'fill-current')}
                    />
                    {likedImages.has(selectedImage.id) ? '已点赞' : '点赞'}
                  </button>
                  <button
                    className="h-12 px-5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-[var(--gold)] text-black hover:shadow-lg"
                    style={{ boxShadow: '0 4px 15px rgba(212,175,55,0.3)' }}
                  >
                    <Download className="w-5 h-5" />
                    下载
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
