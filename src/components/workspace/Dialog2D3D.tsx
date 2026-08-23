'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Upload, Download, RefreshCw, Layers, Clock, X } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { callApi } from '@/lib/api-service';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import { WorkspaceProps } from '@/constants/workspace';
import ImageLoader from '@/components/ui/ImageLoader';

/* eslint-disable @typescript-eslint/no-explicit-any */


interface HistoryItem {
  id: string;
  imageUrl: string;
  resolution: string;
  timestamp: Date;
}

export default function Dialog2D3D({ power, onDeductPower }: WorkspaceProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resolution, setResolution] = useState('2k');
  const [ratio, setRatio] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultModelUrl, setResultModelUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'image' | '3d'>('image');
  const [autoRotate, setAutoRotate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  // 有作品则展开侧边栏，没作品则收起（history 必须在 useEffect 之前声明）
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    if (history.length > 0) setShowHistory(true);
    else setShowHistory(false);
  }, [history.length]);
  const cost = getTaskCost('2dto3d');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const { startPolling } = useTaskPolling();

  const handleGenerate = async () => {
    if (!uploadedImage) { setError('请先上传图片'); return; }
    if (power < cost) { setError(`算力不足！需要: ${cost}`); return; }
    setIsGenerating(true); setError(null);
    try {
      // 使用配置化API调用（异步任务：返回 taskId + statusUrl）
      const response = await callApi<any>('2dto3d', {
        params: {
          image: uploadedImage,
          resolution,
          ratio,
        },
      });

      const respData = (response?.data ?? response) as any;
      const taskId = respData?.taskId as string | undefined;

      // 异步任务：调用公共 hook 轮询直至 completed / failed
      if (response.success && taskId) {
        const taskData = await startPolling(taskId);
        const output = (taskData?.output ?? {}) as any;
        const artifacts = Array.isArray(output.artifacts) ? output.artifacts : [];
        const images = artifacts.map((a: any) => a?.url).filter(Boolean) as string[];
        const previewImg = (output.imageUrl as string) ?? images[0] ?? null;
        const modelUrl = (output.modelUrl as string)
          ?? artifacts.find((a: any) => String(a?.mime || '').includes('glb') || String(a?.url || '').includes('.glb'))?.url
          ?? null;
        setResult(previewImg);
        setResultModelUrl(modelUrl);
        setViewMode(modelUrl ? '3d' : 'image');
        onDeductPower(cost, '平面转雕塑');
        if (previewImg) {
          const newItem: HistoryItem = {
            id: Date.now().toString(),
            imageUrl: previewImg,
            resolution,
            timestamp: new Date(),
          };
          setHistory((prev) => [newItem, ...prev]);
        }
        return;
      }

      // 同步模式兜底
      if (response.success && response.data) {
        const syncData = response.data as any;
        const previewImg = typeof syncData === 'object'
          ? syncData.imageUrl || syncData.previewImage || null
          : syncData;
        const modelUrl = typeof syncData === 'object' ? syncData.modelUrl || null : null;
        setResult(previewImg);
        setResultModelUrl(modelUrl);
        setViewMode(modelUrl ? '3d' : 'image');
        onDeductPower(cost, '平面转雕塑');
      } else {
        setError(response.error || '生成失败');
      }
    } catch (err: any) { setError(err.message || '生成失败'); }
    finally { setIsGenerating(false); }
  };

  const handleDownload = async (url?: string) => {
    const downloadUrl = url || result;
    if (!downloadUrl) return;
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `stereo-${Date.now()}.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(downloadUrl, '_blank');
    }
  };

  const taskId = `2D3D_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部状态栏 */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">SYSTEM READY</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--text-muted)]">{taskId}</span>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'flex items-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium transition-all',
              showHistory
                ? 'bg-[var(--gold)] text-black'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--gold)]'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            历史记录
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧控制面板 */}
        <div className="w-[340px] min-w-[340px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden">
          {/* 内容区 - 可滚动 */}
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
            <div className="p-6">

            {/* 主体图片 */}
            <div className="mb-5">
              <label className="param-label">主体图片</label>
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[var(--border-color)] rounded-xl cursor-pointer hover:border-[var(--gold)] overflow-hidden bg-[var(--bg-tertiary)]">
                {uploadedImage ? <Image src={uploadedImage} alt="主体图片" width={400} height={300} className="h-full object-contain" unoptimized /> : <><Upload className="w-8 h-8 text-[var(--text-muted)] mb-2" /><p className="text-sm text-[var(--text-secondary)]">点击上传图片</p></>}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            {/* 分辨率 */}
            <div className="mb-5">
              <label className="param-label">分辨率</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '1k', label: '1K', sub: '快速' },
                  { value: '2k', label: '2K', sub: '推荐' },
                  { value: '4k', label: '4K', sub: '最高质量' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setResolution(item.value)}
                    disabled={isGenerating}
                    className={cn(
                      'param-btn',
                      resolution === item.value ? 'param-btn-selected' : 'param-btn-unselected'
                    )}
                  >
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 图片比例 */}
            <div className="mb-5">
              <label className="param-label">图片比例</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'auto', label: 'Auto', sub: '自动' },
                  { value: '1:1', label: '1:1', sub: '方形' },
                  { value: '2:3', label: '2:3', sub: '竖版' },
                  { value: '3:2', label: '3:2', sub: '横版' },
                  { value: '3:4', label: '3:4', sub: '竖版' },
                  { value: '4:3', label: '4:3', sub: '横版' },
                  { value: '4:5', label: '4:5', sub: '竖版' },
                  { value: '5:4', label: '5:4', sub: '横版' },
                  { value: '9:16', label: '9:16', sub: '手机' },
                  { value: '16:9', label: '16:9', sub: '宽屏' },
                  { value: '21:9', label: '21:9', sub: '超宽' },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setRatio(item.value)}
                    disabled={isGenerating}
                    className={cn(
                      'param-btn',
                      ratio === item.value ? 'param-btn-selected' : 'param-btn-unselected'
                    )}
                  >
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{item.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 错误提示 */}
            {error && <div className="mb-4 p-3 bg-[rgba(139,58,58,0.1)] border border-[rgba(139,58,58,0.3)] rounded-xl text-sm text-[var(--accent-red)]">{error}</div>}
            </div>
          </div>

          {/* 按钮区 - 固定底部 */}
          <div className="p-5 border-t border-[var(--border-color)]">
            <button onClick={handleGenerate} disabled={isGenerating || !uploadedImage} className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]">
              {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />生成中...</> : <><Layers className="w-4 h-4" />开始生成 <span className="btn-power">⚡{cost}</span></>}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        {/* 中间预览区 */}
        <div className="flex-1 bg-[var(--bg-primary)] flex flex-col">
          <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-2">
              {resultModelUrl && (
                <button onClick={() => setViewMode(viewMode === 'image' ? '3d' : 'image')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', viewMode === '3d' ? 'bg-[var(--gold)] text-black border-[var(--gold)]' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--gold)]')}>
                  {viewMode === '3d' ? '🖼️ 图片' : '📦 3D模型'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {resultModelUrl && (
                <button onClick={() => setAutoRotate(!autoRotate)} className={cn('w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-all', autoRotate ? 'text-[var(--gold)]' : 'text-[var(--text-muted)]')} title="自动旋转">
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => handleDownload()} disabled={!result} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] disabled:opacity-30">
                <Download className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-8 bg-[linear-gradient(rgba(200,164,92,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(200,164,92,.03)_1px,transparent_1px)] bg-[length:20px_20px]">
            {result ? (
              viewMode === '3d' && resultModelUrl ? (
                <div className="w-full max-w-lg aspect-square bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden">
                  {/* @ts-expect-error - model-viewer is a custom element */}
                  <model-viewer src={`/api/proxy-model?url=${encodeURIComponent(resultModelUrl)}`} auto-rotate={autoRotate} camera-controls alt="3D 模型" className="w-full h-full" />
                </div>
              ) : (
                <ImageLoader src={result!} alt="Generated" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-fade-in" showPlaceholder={false} />
              )
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 bg-[var(--bg-card)] rounded-full flex items-center justify-center mx-auto mb-6 border border-[var(--border-color)]"><Layers className="w-12 h-12 text-[var(--text-muted)]" /></div>
                <p className="text-lg text-[var(--text-secondary)] mb-2">上传参考图后开始立体化</p>
                <p className="text-sm text-[var(--text-muted)]">AI多视图引擎就绪</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧历史记录侧边栏 */}
        {showHistory && (
          <div className="w-[280px] min-w-[280px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col animate-slide-in-right">
            <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border-color)]">
              <span className="text-sm font-medium text-[var(--text-primary)]">历史记录</span>
              <button
                onClick={() => setShowHistory(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">暂无历史记录</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square bg-[var(--bg-card)] rounded-xl overflow-hidden border border-[var(--border-color)] hover:border-[var(--gold)] transition-all cursor-pointer"
                    >
                      <Image
                        src={item.imageUrl}
                        alt="历史记录"
                        width={200}
                        height={200}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item.imageUrl);
                          }}
                          className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-all"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => setHistory([])}
                disabled={history.length === 0}
                className="w-full h-12 text-sm text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                清空历史
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
