'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePageState } from '@/hooks/usePageState';
import { RefreshCw, Sparkles, Copy, Check, Plus, Clock } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { LoadingSpinner, LoadingProgressBar } from '@/components/ui/loading';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { useGenerationHistory } from '@/hooks/useGenerationHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useDownload } from '@/hooks/useDownload';
import { usePromptOptimize } from '@/hooks/usePromptOptimize';
import { usePromptTranslate } from '@/hooks/usePromptTranslate';
import { IMAGE_RATIOS, IMAGE_RESOLUTIONS } from '@/constants/workspace';
import { FloatingToolbar } from '@/components/ui/FloatingToolbar';
import { HistorySidebar, PreviewModal, ImageToolbar, type HistoryItemData } from './sub-components';
import type { WorkspaceProps } from '@/constants/workspace';

export default function Text2Image({ power, onDeductPower }: WorkspaceProps) {
  const [prompt, setPrompt] = usePageState('text2img-prompt', '');
  const [resolution, setResolution] = useState('2k');
  const [ratio, setRatio] = useState('auto');
  const [zoom, setZoom] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<HistoryItemData[]>([]);
  const [previewItem, setPreviewItem] = useState<HistoryItemData | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());

  const cost = getTaskCost('text2img');

  const { isGenerating, progress, error, generate, setError } = useAiGeneration({
    featureId: 'text2img',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      // 归一化结果：data 为 { imageUrl, images, modelUrl, ... }
      const d = (data || {}) as { imageUrl?: string | null; images?: string[] };
      const imageList = (Array.isArray(d.images) ? d.images : [d.imageUrl]).filter(Boolean) as string[];
      if (imageList.length > 0 && imageList[0]) {
        const newImage: HistoryItemData = {
          id: crypto.randomUUID(),
          imageUrl: imageList[0],
          prompt: prompt.trim(),
          timestamp: new Date(),
        };
        setGeneratedImages((prev) => [newImage, ...prev]);
        addToHistory({
          featureId: 'text2img',
          imageUrl: imageList[0],
          prompt: prompt.trim(),
        });
      }
    },
  });

  const { history, addToHistory, clearHistory, removeWithUndo } = useGenerationHistory({
    featureId: 'text2img',
    limit: 20,
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError('请输入提示词'); return; }
    await generate({ prompt: prompt.trim(), count: 1, resolution, ratio }, '文案生图');
  };

  useKeyboardShortcuts({
    shortcuts: [
      { key: 'Enter', modifiers: ['ctrl', 'meta'], handler: () => { if (!isGenerating && prompt.trim()) handleGenerate(); }, description: '生成图片' },
      { key: 'Escape', handler: () => { setPrompt(''); setError(null); }, description: '清空提示词' },
    ],
    ignoreInput: false,
  });

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { handleDownload } = useDownload('dunhuang-ai');
  const { handleOptimizePrompt } = usePromptOptimize(() => prompt, setPrompt);
  const { handleTranslatePrompt } = usePromptTranslate(() => prompt, setPrompt);

  const taskId = `文案生图_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`;

  // History sidebar helpers
  const handleToggleSelect = (id: string) => {
    setSelectedHistory(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleSelectAll = () => {
    if (selectedHistory.size === history.length) setSelectedHistory(new Set());
    else setSelectedHistory(new Set(history.map(item => item.id)));
  };
  const handleDeleteSelected = () => {
    selectedHistory.forEach(id => removeWithUndo(id));
    setSelectedHistory(new Set());
  };
  const handleLike = (id: string) => {
    setLikedImages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Map history items from hook to HistoryItemData
  const historyItems: HistoryItemData[] = history
    .filter(item => item.imageUrl)
    .map(item => ({
      id: item.id,
      imageUrl: item.imageUrl!,
      prompt: item.prompt,
      timestamp: item.timestamp,
    }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-ai-assistant-enabled>
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
              showHistory ? 'bg-[var(--gold)] text-black' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--gold)]'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            历史记录
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左侧设置面板 */}
        <div className="w-[340px] min-w-[340px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">文案生图</h2>

              {/* 提示词输入 */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">提示词</label>
                <div className="relative group">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述您的创意..."
                    data-testid="prompt-textarea"
                    className="w-full h-50 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 pr-16 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:border-[var(--gold)] focus:outline-none transition-all"
                    disabled={isGenerating}
                  />
                  {prompt && (
                    <button onClick={handleCopyPrompt} className="absolute top-2 right-2 w-6 h-6 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] transition-all" title="复制">
                      {copied ? <Check className="w-3.5 h-3.5 text-[var(--success-green)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <FloatingToolbar inputValue={prompt} onOptimize={handleOptimizePrompt} onTranslate={handleTranslatePrompt} isLoading={isGenerating} className="bottom-2 right-2" />
                </div>
              </div>

              {/* 分辨率 */}
              <div className="mb-5">
                <label className="param-label">分辨率</label>
                <div className="grid grid-cols-3 gap-2">
                  {IMAGE_RESOLUTIONS.map((r) => (
                    <button key={r.value} onClick={() => setResolution(r.value)} disabled={isGenerating}
                      className={cn('param-btn', resolution === r.value ? 'param-btn-selected' : 'param-btn-unselected')}>
                      <div className="font-medium text-sm">{r.label}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 比例 */}
              <div className="mb-5">
                <label className="param-label">图片比例</label>
                <div className="grid grid-cols-4 gap-2">
                  {IMAGE_RATIOS.map((r) => (
                    <button key={r.value} onClick={() => setRatio(r.value)} disabled={isGenerating}
                      className={cn('param-btn', ratio === r.value ? 'param-btn-selected' : 'param-btn-unselected')}>
                      <div className="font-medium text-sm">{r.label}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div data-testid="generate-error" className="mb-4 p-3 bg-[var(--accent-red-light)] border border-[var(--accent-red)]/30 rounded-lg text-sm text-[var(--accent-red)]">{error}</div>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="p-5 border-t border-[var(--border-color)]">
            <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}
              data-testid="generate-submit"
              className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]">
              {isGenerating ? (
                <><RefreshCw className="w-5 h-5 animate-spin" />生成中...</>
              ) : (
                <><Sparkles className="w-4 h-4" />开始生成<span className="btn-power">⚡{cost}</span></>
              )}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        {/* 中间预览区域 */}
        <div className="flex-1 bg-[var(--bg-primary)] flex flex-col relative min-h-0">
          <div className="flex-1 flex items-center justify-center p-8 bg-dots overflow-auto relative">
            {isGenerating ? (
              <div className="text-center animate-fade-in">
                <div className="w-32 h-32 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[var(--border-color)] relative">
                  <LoadingSpinner size="lg" className="text-[var(--gold)]" />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-24">
                    <LoadingProgressBar progress={progress} />
                  </div>
                </div>
                <p className="text-lg text-[var(--text-secondary)] mb-2">AI 正在创作中...</p>
                <p className="text-sm text-[var(--text-muted)]" data-testid="progress-bar">{Math.round(progress)}%</p>
              </div>
            ) : generatedImages.length > 0 ? (
              <div className="animate-scale-in relative">
                <Image src={generatedImages[0].imageUrl} alt="Generated"
                  data-testid="result-image"
                  width={800} height={600}
                  style={{ transform: `scale(${zoom})` }}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl transition-transform duration-300" unoptimized />
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                  <ImageToolbar
                    zoom={zoom}
                    onZoomIn={() => setZoom(Math.min(2, zoom + 0.25))}
                    onZoomOut={() => setZoom(Math.max(0.5, zoom - 0.25))}
                    onZoomReset={() => setZoom(1)}
                    onDownload={() => handleDownload(generatedImages[0].imageUrl)}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center animate-fade-in">
                <div className="w-48 h-48 border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center mb-4 hover:border-[var(--gold)] transition-colors cursor-pointer">
                  <Plus className="w-10 h-10 text-[var(--text-muted)] mb-2" />
                </div>
                <p className="text-base text-[var(--text-primary)] mb-1">输入提示词后开始生成图片</p>
                <p className="text-sm text-[var(--text-muted)]">AI 文案生图引擎就绪</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧历史记录 */}
        <HistorySidebar
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          history={historyItems}
          selectedIds={selectedHistory}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDeleteSelected={handleDeleteSelected}
          onClearAll={clearHistory}
          onPreview={setPreviewItem}
          onDownload={(item) => handleDownload(item.imageUrl)}
        />
      </div>

      {/* 预览模态框 */}
      <PreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onDownload={(item) => handleDownload(item.imageUrl)}
        likedImages={likedImages}
        onLike={handleLike}
        onUsePrompt={(p) => { setPrompt(p); setPreviewItem(null); }}
      />
    </div>
  );
}
