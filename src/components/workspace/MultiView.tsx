'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePageState } from '@/hooks/usePageState';
import { apiClient, API_ROUTES } from '@/lib/api-client';
import { toast } from 'sonner';
import { Upload, Download, RefreshCw, Sparkles, Box, X, ZoomIn, ZoomOut, RotateCw, Clock, Plus, Eye, Trash2, CheckSquare, Square } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { LoadingSpinner, LoadingProgressBar } from '@/components/ui/loading';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { WorkspaceProps } from '@/constants/workspace';
import { useGenerationHistory } from '@/hooks/useGenerationHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useImageUpload } from '@/hooks/useImageUpload';
import { PromptInput } from '@/components/ui/PromptInput';

export default function MultiView({ power, onDeductPower }: WorkspaceProps) {
  const [result, setResult] = useState<string[]>([]);
  const [resolution, setResolution] = useState('2k');
  const [ratio, setRatio] = useState('auto');
  const [prompt, setPrompt] = usePageState('multiView-prompt', '');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());
  const [selectedView, setSelectedView] = useState(0);

  const cost = getTaskCost('multiview');

  const { uploadedImage, isDragging, error: uploadError, handleDrop, handleDragOver, handleDragLeave, handleFileSelect, clear: clearImage } = useImageUpload({ maxSizeMB: 10 });

  const { isGenerating, progress, error, generate, setError } = useAiGeneration({
    featureId: 'multiview',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      const images = Array.isArray(data) ? data : [data];
      if (images.length > 0) {
        setResult(images);
        addToHistory({ featureId: 'multiview', imageUrl: images[0] });
      }
    },
  });

  const { history, addToHistory, clearHistory, removeFromHistory } = useGenerationHistory({
    featureId: 'multiview',
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
      if (item?.imageUrl) handleDownload(item.imageUrl);
    }
    setSelectedHistory(new Set());
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      setError('请先上传图片');
      return;
    }
    await generate({ image: uploadedImage, resolution, ratio, prompt }, '生成多视图');
  };

  // 优化提示词
  const handleOptimizePrompt = async () => {
    if (!prompt.trim()) return;
    try {
      const data = await apiClient.post<{ optimized?: string; text?: string }>(API_ROUTES.promptOptimize, { prompt: prompt.trim(), ruleId: 'expand-general' });
      if (data.success && data.data?.optimized) {
        setPrompt(data.data.optimized);
      } else {
        toast.error(data.error || '优化失败');
      }
    } catch (error) {
      console.error('优化失败:', error);
      toast.error('优化失败，请重试');
    }
  };

  // 翻译提示词
  const handleTranslatePrompt = async (dir: 'zh-en' | 'en-zh' = 'zh-en') => {
    if (!prompt.trim()) return;
    const translateDir = dir || 'zh-en';
    try {
      const data = await apiClient.post<{ translated?: string; text?: string }>(API_ROUTES.translate, { text: prompt.trim(), dir: translateDir });
      if (data.success && data.data?.translated) {
        setPrompt(data.data.translated);
      } else {
        toast.error(data.error || '翻译失败');
      }
    } catch (error) {
      console.error('翻译失败:', error);
      toast.error('翻译失败，请重试');
    }
  };

  useKeyboardShortcuts({
    shortcuts: [
      { key: 'Enter', modifiers: ['ctrl', 'meta'], handler: handleGenerate, description: '生成' },
    ],
  });

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `multiview-${Date.now()}.png`;
    link.click();
  };

  const resolutions = [
    { value: '1k', label: '1K', desc: '快速' },
    { value: '2k', label: '2K', desc: '推荐' },
    { value: '4k', label: '4K', desc: '最高质量' },
  ];

  const ratios = [
    { value: 'auto', label: 'Auto', sub: '自动' },
    { value: '1:1', label: '1:1', sub: '方形' },
    { value: '2:3', label: '2:3', sub: '竖版' },
    { value: '3:4', label: '3:4', sub: '竖版' },
    { value: '4:5', label: '4:5', sub: '竖版' },
    { value: '3:2', label: '3:2', sub: '横版' },
    { value: '4:3', label: '4:3', sub: '横版' },
    { value: '5:4', label: '5:4', sub: '横版' },
    { value: '9:16', label: '9:16', sub: '手机' },
    { value: '16:9', label: '16:9', sub: '宽屏' },
    { value: '21:9', label: '21:9', sub: '超宽' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">SYSTEM READY</span>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className={cn('flex items-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium', showHistory ? 'bg-[var(--gold)] text-black' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border')}>
          <Clock className="w-3.5 h-3.5" />
          历史记录
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[340px] min-w-[340px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
            <div className="p-5">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">生成多视图</h2>

            <div className="mb-5">
              <label className="param-label">上传图片</label>
              <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={cn('border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer', isDragging ? 'border-[var(--gold)] bg-[var(--gold-muted)]' : 'border-[var(--border-color)] hover:border-[var(--gold)]')}>
                {uploadedImage ? (
                  <div className="relative">
                    <Image src={uploadedImage} alt="已上传" width={400} height={300} className="max-h-40 mx-auto rounded-lg" unoptimized />
                    <button onClick={clearImage} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--bg-card)] border flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-primary)]">点击或拖拽上传</p>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="multiview-upload" />
                <label htmlFor="multiview-upload" className="mt-3 inline-block px-4 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:border-[var(--gold)]">选择图片</label>
              </div>
              {uploadError && <p className="mt-2 text-sm text-[var(--accent-red)]">{uploadError}</p>}
            </div>

            {/* 补充描述 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">提示词（可选）</label>
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onOptimize={handleOptimizePrompt}
                onTranslate={handleTranslatePrompt}
                isLoading={isGenerating}
                placeholder="描述视角或风格需求..."
              />
            </div>

            {/* 分辨率选择 */}
            <div className="mb-5">
              <label className="param-label">分辨率</label>
              <div className="grid grid-cols-3 gap-2">
                {resolutions.map((r) => (
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
                {ratios.map((r) => (
                  <button key={r.value} onClick={() => setRatio(r.value)} disabled={isGenerating} className={cn('param-btn', ratio === r.value ? 'param-btn-selected' : 'param-btn-unselected')}>
                    <div className="font-medium text-sm">{r.label}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="mb-4 p-3 bg-[var(--accent-red-light)] border border-[var(--accent-red)]/30 rounded-lg text-sm text-[var(--accent-red)]" >{error}</div>}
          </div>
          </div>
          <div className="p-5 border-t border-[var(--border-color)]">
            <button onClick={handleGenerate} disabled={isGenerating || !uploadedImage} className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]">
              {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />生成中...</> : <><Box className="w-4 h-4" />开始生成 <span className="btn-power">⚡{cost}</span></>}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg-primary)] flex items-center justify-center p-8">
          {isGenerating ? (
            <div className="text-center">
              <div className="w-24 h-24 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-4 border relative">
                <LoadingSpinner size="lg" className="text-[var(--gold)]" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16"><LoadingProgressBar progress={progress} /></div>
              </div>
              <p className="text-lg text-[var(--text-secondary)]">AI 生成中...</p>
              <p className="text-sm text-[var(--text-muted)]">{Math.round(progress)}%</p>
            </div>
          ) : result.length > 0 ? (
            <div className="w-full max-w-4xl">
              <div className="grid grid-cols-2 gap-4 mb-4">
                {result.map((url, i) => (
                  <div key={i} className="relative aspect-square bg-[var(--bg-card)] rounded-xl overflow-hidden border border-[var(--border-color)]">
                    <Image src={url} alt={`视图${i + 1}`} width={400} height={400} className="w-full h-full object-cover" unoptimized />
                    <button onClick={() => handleDownload(url)} className="absolute top-2 right-2 w-8 h-8 rounded bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
                      <Download className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white">视图 {i + 1}</div>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-[var(--text-muted)]">点击图片可下载</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-48 h-48 border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center mb-4 hover:border-[var(--gold)]">
                <Eye className="w-10 h-10 text-[var(--text-muted)] mb-2" />
              </div>
              <p className="text-base text-[var(--text-primary)] mb-1">上传图片生成多视图</p>
              <p className="text-sm text-[var(--text-muted)]">AI 多视图生成引擎就绪</p>
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
                        onClick={() => { setResult([item.imageUrl || '']); }}
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
