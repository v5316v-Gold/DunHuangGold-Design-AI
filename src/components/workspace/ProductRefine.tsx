'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePageState } from '@/hooks/usePageState';
import { Upload, Download, RefreshCw, Sparkles, ZoomIn, ZoomOut, RotateCw, Clock, X, Plus } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { LoadingSpinner, LoadingProgressBar } from '@/components/ui/loading';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { WorkspaceProps } from '@/constants/workspace';
import { useGenerationHistory } from '@/hooks/useGenerationHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useImageUpload } from '@/hooks/useImageUpload';
import { usePromptOptimize } from '@/hooks/usePromptOptimize';
import { usePromptTranslate } from '@/hooks/usePromptTranslate';
import { useDownload } from '@/hooks/useDownload';
import { PromptInput } from '@/components/ui/PromptInput';
import { HistorySidebar, ImageToolbar, type HistoryItemData } from './sub-components';

export default function ProductRefine({ power, onDeductPower }: WorkspaceProps) {
  const [prompt, setPrompt] = usePageState('productRefine-prompt', '');
  const [ratio, setRatio] = useState('auto');
  const [result, setResult] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);

  const cost = getTaskCost('refine');

  const { uploadedImage, isDragging, error: uploadError, handleDrop, handleDragOver, handleDragLeave, handleFileSelect, clear: clearImage } = useImageUpload({ maxSizeMB: 10 });
  const { handleOptimizePrompt } = usePromptOptimize(() => prompt, setPrompt);
  const { handleTranslatePrompt } = usePromptTranslate(() => prompt, setPrompt);
  const { handleDownload } = useDownload('product-refine');

  const { isGenerating, progress, error, generate, setError } = useAiGeneration({
    featureId: 'refine',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      // 归一化结果：data 为 { imageUrl, images, modelUrl, ... }
      const d = (data || {}) as { imageUrl?: string | null; images?: string[] };
      const imageList = (Array.isArray(d.images) ? d.images : [d.imageUrl]).filter(Boolean) as string[];
      const image = imageList[0] || null;
      setResult(image);
      if (image) {
        addToHistory({ featureId: 'refine', imageUrl: image, prompt: prompt || '产品精修' });
      }
    },
  });

  const { history, addToHistory, clearHistory, removeFromHistory, removeWithUndo } = useGenerationHistory({ featureId: 'refine', limit: 20 });

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
  const handleDeleteSelected = () => {
    selectedHistory.forEach(id => removeWithUndo(id));
    setSelectedHistory(new Set());
  };

  const handleGenerate = async () => {
    if (!uploadedImage) { setError('请先上传产品图片'); return; }
    await generate({ image: uploadedImage, prompt, ratio }, '产品精修');
  };

  useKeyboardShortcuts({
    shortcuts: [
      { key: 'Enter', modifiers: ['ctrl', 'meta'], handler: handleGenerate, description: '生成' },
      { key: 'Escape', handler: () => { setPrompt(''); setError(null); }, description: '清空' },
    ],
    ignoreInput: false,
  });

  const ratios = [
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
  ];

  const taskId = `产品精修_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`;

  // Map history to HistoryItemData
  const historyItems: HistoryItemData[] = history
    .filter(item => item.imageUrl)
    .map(item => ({ id: item.id, imageUrl: item.imageUrl!, prompt: item.prompt, timestamp: item.timestamp }));

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
              showHistory ? 'bg-[var(--gold)] text-black' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--gold)]'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            历史记录
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧设置面板 */}
        <div className="w-[340px] min-w-[340px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">产品精修</h2>

              {/* 图片上传 */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">产品图片</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    'border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer',
                    isDragging ? 'border-[var(--gold)] bg-[var(--gold-muted)]' : 'border-[var(--border-color)] hover:border-[var(--gold)]'
                  )}
                >
                  {uploadedImage ? (
                    <div className="relative">
                      <Image src={uploadedImage} alt="已上传" width={400} height={300} className="max-h-40 mx-auto rounded-lg" unoptimized />
                      <button onClick={clearImage}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-red)]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                      <p className="text-sm text-[var(--text-primary)]">点击或拖拽上传图片</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">支持 JPG/PNG，最大 10MB</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="product-upload" />
                  <label htmlFor="product-upload" className="mt-3 inline-block px-4 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg hover:border-[var(--gold)] cursor-pointer transition-all">
                    选择图片
                  </label>
                </div>
                {uploadError && <p className="mt-2 text-sm text-[var(--accent-red)]">{uploadError}</p>}
              </div>

              {/* 提示词 */}
              <div className="mb-5">
                <label className="param-label">提示词（可选）</label>
                <PromptInput value={prompt} onChange={setPrompt} onOptimize={handleOptimizePrompt} onTranslate={handleTranslatePrompt} isLoading={isGenerating}
                  placeholder="例如：提升质感、调整光线、增强细节..." />
              </div>

              {/* 比例选择 */}
              <div className="mb-5">
                <label className="param-label">图片比例</label>
                <div className="grid grid-cols-4 gap-2">
                  {ratios.map((r) => (
                    <button key={r.value} onClick={() => setRatio(r.value)} disabled={isGenerating}
                      className={cn('param-btn', ratio === r.value ? 'param-btn-selected' : 'param-btn-unselected')}>
                      <div className="font-medium text-sm">{r.label}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[var(--accent-red-light)] border border-[var(--accent-red)]/30 rounded-xl text-sm text-[var(--accent-red)]">{error}</div>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="p-5 border-t border-[var(--border-color)]">
            <button onClick={handleGenerate} disabled={isGenerating || !uploadedImage}
              className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]">
              {isGenerating ? (
                <><RefreshCw className="w-5 h-5 animate-spin" />精修中...</>
              ) : (
                <><Sparkles className="w-4 h-4" />开始精修<span className="btn-power">⚡{cost}</span></>
              )}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        {/* 中间预览区域 */}
        <div className="flex-1 bg-[var(--bg-primary)] flex flex-col relative">
          <div className="flex-1 flex items-center justify-center p-8 bg-dots overflow-auto relative">
            {isGenerating ? (
              <div className="text-center animate-fade-in">
                <div className="w-32 h-32 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[var(--border-color)] relative">
                  <LoadingSpinner size="lg" className="text-[var(--gold)]" />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-24">
                    <LoadingProgressBar progress={progress} />
                  </div>
                </div>
                <p className="text-lg text-[var(--text-secondary)] mb-2">AI 正在精修中...</p>
                <p className="text-sm text-[var(--text-muted)]">{Math.round(progress)}%</p>
              </div>
            ) : result ? (
              <div className="animate-scale-in relative">
                <Image src={result} alt="精修结果" width={800} height={600} style={{ transform: `scale(${zoom})` }}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-2xl transition-transform duration-300" unoptimized />
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                  <ImageToolbar
                    zoom={zoom}
                    onZoomIn={() => setZoom(Math.min(2, zoom + 0.25))}
                    onZoomOut={() => setZoom(Math.max(0.5, zoom - 0.25))}
                    onZoomReset={() => setZoom(1)}
                    onDownload={() => handleDownload(result)}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center animate-fade-in">
                <div className="w-48 h-48 border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center mb-4 hover:border-[var(--gold)] transition-colors cursor-pointer">
                  <Plus className="w-10 h-10 text-[var(--text-muted)] mb-2" />
                </div>
                <p className="text-base text-[var(--text-primary)] mb-1">上传产品图片后开始精修</p>
                <p className="text-sm text-[var(--text-muted)]">AI 产品精修引擎就绪</p>
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
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onDeleteSelected={handleDeleteSelected}
          onClearAll={clearHistory}
          onPreview={(item) => setResult(item.imageUrl)}
          onDownload={(item) => handleDownload(item.imageUrl)}
        />
      </div>
    </div>
  );
}
