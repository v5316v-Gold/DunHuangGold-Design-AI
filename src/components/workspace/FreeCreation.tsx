'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePageState } from '@/hooks/usePageState';
import { Upload, Download, RefreshCw, Sparkles, Palette, X, ZoomIn, ZoomOut, RotateCw, Clock, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { LoadingSpinner, LoadingProgressBar } from '@/components/ui/loading';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { WorkspaceProps } from '@/constants/workspace';
import { useGenerationHistory } from '@/hooks/useGenerationHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useImageUpload } from '@/hooks/useImageUpload';
import { PromptInput } from '@/components/ui/PromptInput';
import { usePromptOptimize } from '@/hooks/usePromptOptimize';
import { usePromptTranslate } from '@/hooks/usePromptTranslate';
import { IMAGE_RATIOS, IMAGE_RESOLUTIONS } from '@/constants/workspace';

export default function FreeCreation({ power, onDeductPower }: WorkspaceProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resolution, setResolution] = useState('2k');
  const [ratio, setRatio] = useState('auto');
  const [prompt, setPrompt] = usePageState('freeCreation-prompt', '');
  const [result, setResult] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);

  const cost = getTaskCost('free');

  const { uploadedImage: img, isDragging, error: uploadError, handleDrop, handleDragOver, handleDragLeave, handleFileSelect, clear: clearImage } = useImageUpload({ maxSizeMB: 10 });
  useEffect(() => { if (img) setUploadedImage(img); }, [img]);

  const { isGenerating, progress, error, generate, setError } = useAiGeneration({
    featureId: 'free',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      const images = Array.isArray(data) ? data : [data];
      if (images.length > 0 && images[0]) {
        setResult(images[0]);
        addToHistory({ featureId: 'free', imageUrl: images[0], prompt: prompt || '自由创作' });
      }
    },
  });

  const { history, addToHistory, clearHistory, removeFromHistory } = useGenerationHistory({ featureId: 'free', limit: 20 });

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
      if (item?.imageUrl) handleDownload(item.imageUrl);
    }
    setSelectedHistory(new Set());
  };

  const handleGenerate = async () => {
    await generate({ prompt, image: uploadedImage, resolution, ratio }, '自由创作');
  };

  useKeyboardShortcuts({
    shortcuts: [
      { key: 'Enter', modifiers: ['ctrl', 'meta'], handler: handleGenerate, description: '生成' },
    ],
  });

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `free-creation-${Date.now()}.png`;
    link.click();
  };

  // 优化提示词
  const { handleOptimizePrompt } = usePromptOptimize(() => prompt, setPrompt);
  const { handleTranslatePrompt } = usePromptTranslate(() => prompt, setPrompt);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">SYSTEM READY</span>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className={cn('flex items-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium', showHistory ? 'bg-[var(--gold)] text-black' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border')}>
          <Clock className="w-3.5 h-3.5" />历史记录
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[340px] min-w-[340px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">自由创作区</h2>

              {/* 参考图 */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">参考图（可选，最多4张）</label>
                <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={cn('border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer', isDragging ? 'border-[var(--gold)] bg-[var(--gold-muted)]' : 'border-[var(--border-color)] hover:border-[var(--gold)]')}>
                  {uploadedImage ? (
                    <div className="relative">
                      <Image src={uploadedImage} alt="已上传" width={400} height={300} className="max-h-32 mx-auto rounded" unoptimized />
                      <button onClick={clearImage} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--bg-card)] border flex items-center justify-center"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div><Plus className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-1" /><p className="text-xs text-[var(--text-muted)]">点击添加参考图</p></div>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="free-upload" />
                  <label htmlFor="free-upload" className="mt-2 inline-block px-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded cursor-pointer">选择图片</label>
                </div>
              </div>

              {/* 提示词 */}
              <div className="mb-5">
                <label className="param-label">提示词</label>
                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                  onOptimize={handleOptimizePrompt}
                  onTranslate={handleTranslatePrompt}
                  isLoading={isGenerating}
                  placeholder="描述你的创意..."
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

              {/* 图片比例 */}
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

              {error && <div className="mb-4 p-3 bg-[var(--accent-red-light)] border border-[var(--accent-red)]/30 rounded-lg text-sm text-[var(--accent-red)]">{error}</div>}
            </div>
          </div>
          <div className="p-5 border-t border-[var(--border-color)]">
            <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]">
              {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />创作中...</> : <><Palette className="w-4 h-4" />开始创作 <span className="btn-power">⚡{cost}</span></>}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg-primary)] flex items-center justify-center p-8 relative">
          {isGenerating ? (
            <div className="text-center">
              <LoadingSpinner size="lg" className="text-[var(--gold)] mb-4" />
              <p className="text-lg text-[var(--text-secondary)]">AI 创作中...</p>
              <p className="text-sm text-[var(--text-muted)]">{Math.round(progress)}%</p>
            </div>
          ) : result ? (
            <div className="relative">
              <Image src={result} alt="结果" width={800} height={600} style={{ transform: `scale(${zoom})` }} className="max-w-full max-h-[65vh] rounded-xl shadow-2xl" unoptimized />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="w-8 h-8 rounded bg-[var(--bg-card)] border"><ZoomOut className="w-4 h-4" /></button>
                <span className="text-xs">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(2, zoom + 0.25))} className="w-8 h-8 rounded bg-[var(--bg-card)] border"><ZoomIn className="w-4 h-4" /></button>
                <button onClick={() => handleDownload(result)} className="w-8 h-8 rounded bg-[var(--bg-card)] border"><Download className="w-4 h-4" /></button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-48 h-48 border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center mb-4 hover:border-[var(--gold)]">
                <Sparkles className="w-10 h-10 text-[var(--text-muted)] mb-2" />
              </div>
              <p className="text-base text-[var(--text-primary)] mb-1">输入提示词开始自由创作</p>
              <p className="text-sm text-[var(--text-muted)]">AI 自由创作引擎就绪</p>
            </div>
          )}
        </div>

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
                <div className="grid grid-cols-2 gap-4">
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
