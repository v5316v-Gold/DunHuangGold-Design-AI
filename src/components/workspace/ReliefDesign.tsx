'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Upload, Download, RefreshCw, Layers, X, ZoomIn, ZoomOut, Clock, Trash2, CheckSquare, Square } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { WorkspaceProps } from '@/constants/workspace';
import { useGenerationHistory } from '@/hooks/useGenerationHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useImageUpload } from '@/hooks/useImageUpload';

/* eslint-disable @typescript-eslint/no-explicit-any */


export default function ReliefDesign({ power, onDeductPower }: WorkspaceProps) {
  // 有作品则展开侧边栏，没作品则收起
  const [result, setResult] = useState<string | null>(null);
  const [resultModelUrl, setResultModelUrl] = useState<string | null>(null);
  const [depthLevel, setDepthLevel] = useState<'shallow' | 'deep'>('shallow');
  const [modelWeight, setModelWeight] = useState(0.5);
  const [outputFormat, setOutputFormat] = useState('png');
  const [removeBackground, setRemoveBackground] = useState(false);

  const cost = getTaskCost('relief');

  const { uploadedImage, isDragging, error: uploadError, handleDrop, handleDragOver, handleDragLeave, handleFileSelect, clear: clearImage } = useImageUpload({ maxSizeMB: 10 });

  const { isGenerating, progress, error, generate, setError } = useAiGeneration({
    featureId: 'relief',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      if (typeof data === 'object' && data !== null) {
        const preview = (data as any).previewImage || (data as any).data || null;
        const modelUrl = (data as any).modelUrl || null;
        setResult(preview);
        setResultModelUrl(modelUrl);
        addToHistory({ featureId: 'relief', imageUrl: preview || '', modelUrl: modelUrl || undefined });
      } else {
        setResult(typeof data === 'string' ? data : null);
        setResultModelUrl(null);
        addToHistory({ featureId: 'relief', imageUrl: typeof data === 'string' ? data : '' });
      }
    },
  });

  const { history, addToHistory, clearHistory, removeFromHistory } = useGenerationHistory({ featureId: 'relief', limit: 20 });
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());

  // 有作品则展开侧边栏，没作品则收起
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    if (history.length > 0) setShowHistory(true);
    else setShowHistory(false);
  }, [history.length]);

  const handleGenerate = async () => {
    if (!uploadedImage) { setError('请先上传图片'); return; }
    await generate({ image: uploadedImage, use3D: true, reliefType: depthLevel, modelWeight }, '3D浮雕');
  };

  const handleDownload = async (url: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = url.includes('.glb') ? `relief3d.glb` : `relief-${Date.now()}.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleDownloadSelected = async () => {
    for (const id of selectedHistory) {
      const item = history.find(h => h.id === id);
      if (item?.imageUrl) await handleDownload(item.imageUrl);
      if (item?.modelUrl) await handleDownload(item.modelUrl);
    }
    setSelectedHistory(new Set());
  };

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

  useKeyboardShortcuts({
    shortcuts: [
      { key: 'Enter', modifiers: ['ctrl', 'meta'], handler: handleGenerate, description: '生成' },
    ],
  });

  const formatOptions = [
    { value: 'png', label: 'PNG' },
    { value: 'exr', label: 'EXR' },
    { value: 'vsm', label: 'VSM' },
  ];

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
        <div className="w-[340px] min-w-[340px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">图转浮雕图</h2>

              <div className="mb-5">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">上传图片</label>
                <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={cn('border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer', isDragging ? 'border-[var(--gold)] bg-[var(--gold-muted)]' : 'border-[var(--border-color)] hover:border-[var(--gold)]')}>
                  {uploadedImage ? (
                    <div className="relative">
                      <Image src={uploadedImage} alt="已上传" width={400} height={300} className="max-h-40 mx-auto rounded-lg" unoptimized />
                      <button onClick={clearImage} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--bg-card)] border flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div><Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" /><p className="text-sm text-[var(--text-primary)]">点击或拖拽上传</p></div>
                  )}
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="relief-upload" />
                  <label htmlFor="relief-upload" className="mt-3 inline-block px-4 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:border-[var(--gold)]">选择图片</label>
                </div>
                {uploadError && <p className="mt-2 text-sm text-[var(--accent-red)]">{uploadError}</p>}
              </div>

              <div className="mb-5">
                <label className="param-label">浮雕类型</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setDepthLevel('shallow')} disabled={isGenerating} className={cn('param-btn', depthLevel === 'shallow' ? 'param-btn-selected' : 'param-btn-unselected')}>
                    <div className="font-medium text-sm">浅浮雕</div>
                  </button>
                  <button onClick={() => setDepthLevel('deep')} disabled={isGenerating} className={cn('param-btn', depthLevel === 'deep' ? 'param-btn-selected' : 'param-btn-unselected')}>
                    <div className="font-medium text-sm">深浮雕</div>
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className="param-label">输出格式</label>
                <div className="grid grid-cols-3 gap-2">
                  {formatOptions.map((f) => (
                    <button key={f.value} onClick={() => setOutputFormat(f.value)} disabled={isGenerating} className={cn('param-btn', outputFormat === f.value ? 'param-btn-selected' : 'param-btn-unselected')}>
                      <div className="font-medium">{f.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="param-label">模型权重: {modelWeight}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={modelWeight}
                  onChange={(e) => setModelWeight(parseFloat(e.target.value))}
                  disabled={isGenerating}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-[var(--bg-card)] border border-[var(--border-color)] transition-all hover:border-[var(--gold)]"
                  style={{
                    background: `linear-gradient(to right, rgba(200, 164, 92, 0.5) 0%, rgba(200, 164, 92, 0.5) ${modelWeight * 100}%, rgba(200, 164, 92, 0.15) ${modelWeight * 100}%, rgba(200, 164, 92, 0.15) 100%)`
                  }}
                />
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--text-primary)]">去除背景</label>
                  <button
                    onClick={() => setRemoveBackground(!removeBackground)}
                    disabled={isGenerating}
                    className={cn('relative w-12 h-6 rounded-full transition-colors', removeBackground ? 'bg-[var(--gold)]' : 'bg-[var(--bg-tertiary)]')}
                  >
                    <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-transform', removeBackground ? 'left-7' : 'left-1')} />
                  </button>
                </div>
              </div>

              {error && <div className="mb-4 p-3 bg-[var(--accent-red-light)] border border-[var(--accent-red)]/30 rounded-lg text-sm text-[var(--accent-red)]">{error}</div>}
            </div>
          </div>
          <div className="p-5 border-t border-[var(--border-color)]">
            <button onClick={handleGenerate} disabled={isGenerating || !uploadedImage} className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]">
              {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />生成中...</> : <><Layers className="w-4 h-4" />开始生成 <span className="btn-power">⚡{cost}</span></>}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg-primary)] flex items-center justify-center p-8">
          {isGenerating ? (
            <div className="text-center">
              <LoadingSpinner size="lg" className="text-[var(--gold)] mb-4" />
              <p className="text-lg text-[var(--text-secondary)]">AI 生成 3D 浮雕中...</p>
              <p className="text-sm text-[var(--text-muted)]">{Math.round(progress)}%</p>
            </div>
          ) : result || resultModelUrl ? (
            <div className="relative w-full flex flex-col items-center">
              {resultModelUrl ? (
                <div className="w-full max-w-lg aspect-square bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden">
                  {/* @ts-expect-error - model-viewer is a custom element */}
                  <model-viewer src={`/api/proxy-model?url=${encodeURIComponent(resultModelUrl)}`} auto-rotate camera-controls alt="3D 浮雕模型" className="w-full h-full" />
                </div>
              ) : (
                <Image src={result!} alt="浮雕结果" width={800} height={600} className="max-w-full max-h-[65vh] rounded-xl shadow-2xl" unoptimized />
              )}
              <div className="mt-4 flex items-center gap-2">
                {resultModelUrl ? (
                  <>
                    <a href={resultModelUrl!} /* eslint-disable react-hooks/purity */ download={`relief3d-${Date.now()}.glb`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] transition-all">
                      <Download className="w-4 h-4" />下载模型
                    </a>
                    <button onClick={() => { setResult(null); setResultModelUrl(null); }} className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm hover:border-[var(--gold)] transition-all">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleDownload(result!)} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] transition-all">
                      <Download className="w-4 h-4" />下载图片
                    </button>
                    <button onClick={() => { setResult(null); }} className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm hover:border-[var(--gold)] transition-all">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-48 h-48 border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center mb-4 hover:border-[var(--gold)]">
                <Layers className="w-10 h-10 text-[var(--text-muted)] mb-2" />
              </div>
              <p className="text-base text-[var(--text-primary)] mb-1">上传图片生成 3D 浮雕</p>
              <p className="text-sm text-[var(--text-muted)]">AI 3D 浮雕生成引擎就绪</p>
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
                <div className="grid grid-cols-2 gap-3">
                  {history.map((item) => (
                    <div key={item.id} className="relative">
                      <div
                        onClick={() => { setResult(item.imageUrl || null); setResultModelUrl(item.modelUrl || null); }}
                        className="aspect-square bg-[var(--bg-card)] rounded-xl overflow-hidden border-2 border-[var(--border-color)] hover:border-[var(--gold)] cursor-pointer relative group"
                        style={{ borderColor: selectedHistory.has(item.id) ? 'var(--gold)' : undefined }}
                      >
                        <Image src={item.imageUrl!} alt="历史" width={200} height={200} className="w-full h-full object-cover" unoptimized />
                        {item.modelUrl && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">📦 3D</div>
                        )}
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
