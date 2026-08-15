'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePageState } from '@/hooks/usePageState';
import { Upload, Download, RefreshCw, Sparkles, X, ZoomIn, ZoomOut, RotateCw, Clock, Plus, Layers, Trash2, CheckSquare, Square } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { LoadingSpinner, LoadingProgressBar } from '@/components/ui/loading';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { useGenerationHistory } from '@/hooks/useGenerationHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useImageUpload } from '@/hooks/useImageUpload';
import { usePromptOptimize } from '@/hooks/usePromptOptimize';
import { usePromptTranslate } from '@/hooks/usePromptTranslate';
import { useDownload } from '@/hooks/useDownload';
import { PromptInput } from '@/components/ui/PromptInput';
import { IMAGE_RATIOS, IMAGE_RESOLUTIONS, WorkspaceProps } from '@/constants/workspace';

interface BlendImage {
  id: string;
  url: string;
  timestamp: Date;
}

export default function MultiImage({ power, onDeductPower }: WorkspaceProps) {
  const [prompt, setPrompt] = usePageState('multiImage-prompt', '');
  const [ratio, setRatio] = useState('auto');
  const [resolution, setResolution] = useState('2k');
  const [result, setResult] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [blendImages, setBlendImages] = useState<string[]>([]);

  const cost = getTaskCost('blend');

  // 图片上传 Hook（多图模式）
  const { uploadedImages, isDragging, error: uploadError, handleDrop, handleDragOver, handleDragLeave, handleFileSelect, clear: clearImages, processFile } = useImageUpload({ maxSizeMB: 10, multiple: true });

  // AI 生成 Hook
  const { isGenerating, progress, error, generate, setError } = useAiGeneration({
    featureId: 'blend',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      // 归一化结果：data 为 { imageUrl, images, modelUrl, ... }
      const d = (data || {}) as { imageUrl?: string | null; images?: string[] };
      const imageList = (Array.isArray(d.images) ? d.images : [d.imageUrl]).filter(Boolean) as string[];
      if (imageList.length > 0 && imageList[0]) {
        setResult(imageList[0]);
        addToHistory({ featureId: 'blend', imageUrl: imageList[0], prompt: prompt || '多图融合' });
      }
    },
  });

  // 历史记录 Hook
  const { history, addToHistory, clearHistory, removeFromHistory } = useGenerationHistory({
    featureId: 'blend',
    limit: 20,
  });

  const toggleSelect = (id: string) => {
    setSelectedHistory(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedHistory.size === history.length) setSelectedHistory(new Set());
    else setSelectedHistory(new Set(history.map(h => h.id)));
  };

  const handleDownloadSelected = async () => {
    for (const id of selectedHistory) {
      const item = history.find(h => h.id === id);
      if (item?.imageUrl) await handleDownload(item.imageUrl);
    }
    setSelectedHistory(new Set());
  };

  // 提示词优化 Hook
  const { handleOptimizePrompt } = usePromptOptimize(() => prompt, setPrompt);
  const { handleTranslatePrompt } = usePromptTranslate(() => prompt, setPrompt);

  // 下载 Hook
  const { handleDownload } = useDownload('multi-blend');

  const handleGenerate = async () => {
    if (uploadedImages.length < 2) {
      setError('请至少上传 2 张图片进行融合');
      return;
    }

    await generate({ images: uploadedImages, prompt, resolution, ratio }, '多图融合');
  };

  // 键盘快捷键
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'Enter', modifiers: ['ctrl', 'meta'], handler: handleGenerate, description: '生成' },
      { key: 'Escape', handler: () => { setPrompt(''); setError(null); }, description: '清空' },
    ],
    ignoreInput: false,
  });

  const removeImage = (index: number) => {
    setBlendImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部状态栏 */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">SYSTEM READY</span>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium', showHistory ? 'bg-[var(--gold)] text-black' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border')}>
          <Clock className="w-3.5 h-3.5" />
          历史记录
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧设置面板 */}
        <div className="w-[340px] min-w-[340px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-hide p-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">多图融合</h2>

            {/* 图片上传（多图） */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                上传图片（至少 2 张）
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn('border-2 border-dashed rounded-xl p-4 transition-all', isDragging ? 'border-[var(--gold)] bg-[var(--gold-muted)]' : 'border-[var(--border-color)] hover:border-[var(--gold)]')}
              >
                {uploadedImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded overflow-hidden">
                        <Image src={img} alt={`图片${i + 1}`} width={200} height={200} className="w-full h-full object-cover" unoptimized />
                        <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-xs">×</button>
                      </div>
                    ))}
                    <label className="aspect-square rounded border-2 border-dashed border-[var(--border-color)] flex items-center justify-center cursor-pointer hover:border-[var(--gold)]">
                      <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                      <Plus className="w-5 h-5 text-[var(--text-muted)]" />
                    </label>
                  </div>
                ) : (
                  <label className="block text-center cursor-pointer">
                    <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                    <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-primary)]">点击或拖拽上传多张图片</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">至少 2 张，支持 JPG/PNG</p>
                  </label>
                )}
              </div>
              {uploadError && <p className="mt-2 text-sm text-[var(--accent-red)]">{uploadError}</p>}
            </div>

            {/* 融合提示词 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">提示词（可选）</label>
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onOptimize={handleOptimizePrompt}
                onTranslate={handleTranslatePrompt}
                isLoading={isGenerating}
                placeholder="描述融合效果，如：融合成一个梦幻的场景..."
              />
            </div>

            {/* 分辨率选择 */}
            <div className="mb-5">
              <label className="param-label">分辨率</label>
              <div className="grid grid-cols-3 gap-2">
                {IMAGE_RESOLUTIONS.map((r) => (
                  <button key={r.value} onClick={() => setResolution(r.value)} disabled={isGenerating} className={cn('param-btn', resolution === r.value ? 'param-btn-selected' : 'param-btn-unselected')}>
                    <div className="font-medium text-sm">{r.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 比例选择 */}
            <div className="mb-5">
              <label className="param-label">图片比例</label>
              <div className="grid grid-cols-4 gap-2">
                {IMAGE_RATIOS.map((r) => (
                  <button key={r.value} onClick={() => setRatio(r.value)} disabled={isGenerating} className={cn('param-btn', ratio === r.value ? 'param-btn-selected' : 'param-btn-unselected')}>
                    <div className="font-medium text-sm">{r.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 错误提示 */}
            {error && <div className="mb-4 p-3 bg-[var(--accent-red-light)] border border-[var(--accent-red)]/30 rounded-lg text-sm text-[var(--accent-red)]">{error}</div>}
          </div>

          {/* 生成按钮 - 固定底部 */}
          <div className="p-5 border-t border-[var(--border-color)]">
            <button onClick={handleGenerate} disabled={isGenerating || uploadedImages.length < 2} className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]">
              {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />融合中...</> : <><Sparkles className="w-4 h-4" />开始融合 <span className="btn-power">⚡{cost}</span></>}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        {/* 预览区域 */}
        <div className="flex-1 bg-[var(--bg-primary)] flex items-center justify-center p-8 relative">
          {isGenerating ? (
            <div className="text-center">
              <div className="w-32 h-32 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-6 border">
                <LoadingSpinner size="lg" className="text-[var(--gold)]" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-24"><LoadingProgressBar progress={progress} /></div>
              </div>
              <p className="text-lg text-[var(--text-secondary)] mb-2">AI 融合中...</p>
              <p className="text-sm text-[var(--text-muted)]">{Math.round(progress)}%</p>
            </div>
          ) : result ? (
            <div className="relative">
              <Image src={result} alt="融合结果" width={800} height={600} style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl" unoptimized />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="w-8 h-8 rounded bg-[var(--bg-card)] border flex items-center justify-center"><ZoomOut className="w-4 h-4" /></button>
                <span className="text-xs text-[var(--text-muted)]">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(2, zoom + 0.25))} className="w-8 h-8 rounded bg-[var(--bg-card)] border flex items-center justify-center"><ZoomIn className="w-4 h-4" /></button>
                <button onClick={() => setZoom(1)} className="w-8 h-8 rounded bg-[var(--bg-card)] border flex items-center justify-center"><RotateCw className="w-4 h-4" /></button>
                <div className="w-px h-4 bg-[var(--border-color)]" />
                <button onClick={() => handleDownload(result)} className="w-8 h-8 rounded bg-[var(--bg-card)] border flex items-center justify-center"><Download className="w-4 h-4" /></button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-48 h-48 border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center mb-4 hover:border-[var(--gold)]">
                <Layers className="w-10 h-10 text-[var(--text-muted)] mb-2" />
              </div>
              <p className="text-base text-[var(--text-primary)] mb-1">上传多张图片后开始融合</p>
              <p className="text-sm text-[var(--text-muted)]">AI 多图融合引擎就绪</p>
            </div>
          )}
        </div>

        {/* 历史记录 */}
        {showHistory && (
          <div className="w-[280px] bg-[var(--bg-secondary)] border-l flex flex-col">
            <div className="h-12 px-4 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="w-5 h-5 rounded flex items-center justify-center transition-all">
                  {selectedHistory.size === history.length && history.length > 0 ? <CheckSquare className="w-4 h-4 text-[var(--gold)]" /> : <Square className="w-4 h-4 text-[var(--text-muted)]" />}
                </button>
                <span className="text-sm font-medium text-[var(--text-primary)]">历史记录</span>
                {selectedHistory.size > 0 && <span className="text-xs text-[var(--text-muted)]">({selectedHistory.size})</span>}
              </div>
              <button onClick={() => setShowHistory(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {history.length === 0 ? <p className="text-center text-sm text-[var(--text-muted)] py-8">暂无记录</p> : (
                <div className="grid grid-cols-2 gap-3">
                  {history.map((item) => (
                    <div key={item.id} className="relative">
                      <div
                        onClick={() => { setResult(item.imageUrl || null); }}
                        className="aspect-square bg-[var(--bg-card)] rounded-xl overflow-hidden border-2 border-[var(--border-color)] hover:border-[var(--gold)] cursor-pointer"
                        style={{ borderColor: selectedHistory.has(item.id) ? 'var(--gold)' : undefined }}
                      >
                        <Image src={item.imageUrl!} alt="历史" width={200} height={200} className="w-full h-full object-cover" unoptimized />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                        className="absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center"
                        style={{ background: selectedHistory.has(item.id) ? 'var(--gold)' : 'rgba(0,0,0,0.5)' }}
                      >
                        {selectedHistory.has(item.id) ? <CheckSquare className="w-3.5 h-3.5 text-black" /> : <Square className="w-3.5 h-3.5 text-white" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              {selectedHistory.size > 0 ? (
                <div className="flex gap-2">
                  <button onClick={handleDownloadSelected} className="flex-1 py-2 text-sm text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--gold)] transition-all flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />下载 ({selectedHistory.size})
                  </button>
                  <button
                    onClick={() => { selectedHistory.forEach(id => removeFromHistory(id)); setSelectedHistory(new Set()); }}
                    className="flex-1 py-2 text-sm text-[var(--accent-red)] border border-[var(--accent-red)]/30 rounded-lg hover:bg-[var(--accent-red)]/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />删除 ({selectedHistory.size})
                  </button>
                </div>
              ) : (
                <button onClick={() => clearHistory()} disabled={history.length === 0} className="w-full h-10 text-sm text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />清空历史
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
