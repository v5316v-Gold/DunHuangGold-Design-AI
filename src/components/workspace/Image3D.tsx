'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePageState } from '@/hooks/usePageState';
import { Upload, RefreshCw, Box, X, Clock, Type, Image as ImageIcon } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { LoadingSpinner, LoadingProgressBar } from '@/components/ui/loading';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { WorkspaceProps } from '@/constants/workspace';
import { useGenerationHistory } from '@/hooks/useGenerationHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePromptOptimize } from '@/hooks/usePromptOptimize';
import { usePromptTranslate } from '@/hooks/usePromptTranslate';
import { useImageUpload } from '@/hooks/useImageUpload';
import { PromptInput } from '@/components/ui/PromptInput';

export default function Image3D({ power, onDeductPower }: WorkspaceProps) {
  const [result, setResult] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [generationMode, setGenerationMode] = useState<'text-3d' | 'image-3d'>('text-3d');
  const [prompt, setPrompt] = usePageState('image3d-prompt', '');
  const [imageMode, setImageMode] = useState<'single' | 'multiple'>('single');
  const [multiViewImages, setMultiViewImages] = useState<{ front: string | null; back: string | null; left: string | null; right: string | null }>({ front: null, back: null, left: null, right: null });
  const [polygonCount, setPolygonCount] = useState('1.5m');
  const [modelType, setModelType] = useState<'geometry' | 'geometry_texture'>('geometry_texture');
  const [precision, setPrecision] = useState<'standard' | 'ultra'>('standard');

  const cost = getTaskCost('image-3d');

  const { isGenerating, progress, error, generate, setError } = useAiGeneration({
    featureId: 'image-3d',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      setResult(data.modelUrl || data);
    },
  });

  const { history, addToHistory, clearHistory } = useGenerationHistory({ featureId: 'image-3d', limit: 20 });

  // 有作品则展开侧边栏，没作品则收起
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    if (history.length > 0) setShowHistory(true);
    else setShowHistory(false);
  }, [history.length]);

  const { handleOptimizePrompt } = usePromptOptimize(() => prompt, setPrompt);
  const { handleTranslatePrompt } = usePromptTranslate(() => prompt, setPrompt);

  // 使用公共 hooks 处理单张图片上传
  const {
    uploadedImage,
    isDragging,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileSelect,
    clear: clearUploadedImage,
  } = useImageUpload({ multiple: false });

  const handleGenerate = async () => {
    if (generationMode === 'text-3d') {
      if (!prompt.trim()) { setError('请输入提示词'); return; }
      await generate({ prompt, polygonCount, modelType, precision }, '文生3D');
    } else {
      if (imageMode === 'single' && !uploadedImage) { setError('请上传图片'); return; }
      if (imageMode === 'multiple' && !multiViewImages.front) { setError('请上传正视图'); return; }
      const imageData = imageMode === 'single' ? uploadedImage : multiViewImages;
      await generate({ image: imageData, polygonCount, modelType, precision }, '图生3D');
    }
  };

  useKeyboardShortcuts({
    shortcuts: [
      { key: 'Enter', modifiers: ['ctrl', 'meta'], handler: handleGenerate, description: '生成' },
    ],
  });

  const polygonOptions = [
    { value: '2m', label: '2m' },
    { value: '1.5m', label: '1.5m' },
    { value: '1m', label: '1m' },
    { value: '500k', label: '500k' },
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
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">3D 模型</h2>

            <div className="mb-5">
              <label className="param-label">建模方式</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setGenerationMode('text-3d')} disabled={isGenerating} className={cn('param-btn', generationMode === 'text-3d' ? 'param-btn-selected' : 'param-btn-unselected')}>
                  <Type className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-xs font-medium">文生3D</span>
                </button>
                <button onClick={() => setGenerationMode('image-3d')} disabled={isGenerating} className={cn('param-btn', generationMode === 'image-3d' ? 'param-btn-selected' : 'param-btn-unselected')}>
                  <ImageIcon className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-xs font-medium">图生3D</span>
                </button>
              </div>
            </div>

            {generationMode === 'text-3d' && (
              <div className="mb-5">
                <label className="param-label">提示词</label>
                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                  onOptimize={handleOptimizePrompt}
                  onTranslate={handleTranslatePrompt}
                  isLoading={isGenerating}
                  placeholder="描述你想要生成的3D模型..."
                  height="h-40"
                />
              </div>
            )}

            {generationMode === 'image-3d' && (
              <>
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setImageMode('single')} disabled={isGenerating} className={cn('py-2.5 rounded-lg border text-center text-xs', imageMode === 'single' ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]' : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--gold)]')}>单张图片</button>
                    <button onClick={() => setImageMode('multiple')} disabled={isGenerating} className={cn('py-2.5 rounded-lg border text-center text-xs', imageMode === 'multiple' ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]' : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--gold)]')}>多张图片</button>
                  </div>
                </div>

                {imageMode === 'single' && (
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">上传图片</label>
                    <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} className={cn('border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer', isDragging ? 'border-[var(--gold)] bg-[var(--gold-muted)]' : 'border-[var(--border-color)] hover:border-[var(--gold)]')}>
                      {uploadedImage ? (
                        <div className="relative">
                          <Image src={uploadedImage} alt="已上传" width={400} height={300} className="max-h-32 mx-auto rounded-lg" unoptimized />
                          <button onClick={clearUploadedImage} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--bg-card)] border flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                          <p className="text-sm text-[var(--text-primary)]">点击或拖拽上传</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="image3d-upload" />
                      <label htmlFor="image3d-upload" className="mt-3 inline-block px-4 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:border-[var(--gold)]">选择图片</label>
                    </div>
                  </div>
                )}

                {imageMode === 'multiple' && (
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">多视角上传 <span className="text-[var(--accent-red)]">*</span></label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['front', 'back', 'left', 'right'] as const).map((view) => (
                        <div key={view}>
                          <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                            {view === 'front' ? '正视图' : view === 'back' ? '后视图' : view === 'left' ? '左视图' : '右视图'}
                            {view === 'front' && <span className="text-[var(--accent-red)]"> *</span>}
                          </label>
                          <div className={cn('border-2 border-dashed rounded-lg p-3 text-center transition-all cursor-pointer hover:border-[var(--gold)]', multiViewImages[view] ? 'border-[var(--gold)] bg-[var(--gold-muted)]' : 'border-[var(--border-color)]')}>
                            {multiViewImages[view] ? (
                              <div className="relative">
                                <Image src={multiViewImages[view]!} alt={view} width={200} height={150} className="max-h-20 mx-auto rounded" unoptimized />
                                <button onClick={() => setMultiViewImages(prev => ({ ...prev, [view]: null }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--bg-card)] border flex items-center justify-center"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <div>
                                <Upload className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-1" />
                                <p className="text-xs text-[var(--text-muted)]">上传</p>
                              </div>
                            )}
                            <input type="file" accept="image/*" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => setMultiViewImages(prev => ({ ...prev, [view]: ev.target?.result as string }));
                                reader.readAsDataURL(file);
                              }
                            }} className="hidden" id={`image3d-${view}-upload`} />
                            <label htmlFor={`image3d-${view}-upload`} className="mt-2 inline-block px-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded cursor-pointer hover:border-[var(--gold)]">选择</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mb-5">
              <label className="param-label">模型面数</label>
              <div className="grid grid-cols-4 gap-2">
                {polygonOptions.map((opt) => (
                  <button key={opt.value} onClick={() => setPolygonCount(opt.value)} disabled={isGenerating} className={cn('param-btn', polygonCount === opt.value ? 'param-btn-selected' : 'param-btn-unselected')}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="param-label">模型类型</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setModelType('geometry_texture')} disabled={isGenerating} className={cn('param-btn', modelType === 'geometry_texture' ? 'param-btn-selected' : 'param-btn-unselected')}>几何+纹理</button>
                <button onClick={() => setModelType('geometry')} disabled={isGenerating} className={cn('param-btn', modelType === 'geometry' ? 'param-btn-selected' : 'param-btn-unselected')}>几何+白模</button>
              </div>
            </div>

            <div className="mb-5">
              <label className="param-label">几何精度</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPrecision('standard')} disabled={isGenerating} className={cn('param-btn', precision === 'standard' ? 'param-btn-selected' : 'param-btn-unselected')}>标准</button>
                <button onClick={() => setPrecision('ultra')} disabled={isGenerating} className={cn('param-btn', precision === 'ultra' ? 'param-btn-selected' : 'param-btn-unselected')}>超清</button>
              </div>
            </div>

            {error && <div className="mb-4 p-3 bg-[var(--accent-red-light)] border border-[var(--accent-red)]/30 rounded-lg text-sm text-[var(--accent-red)]">{error}</div>}
            </div>
          </div>
          <div className="p-5 border-t border-[var(--border-color)]">
            <button onClick={handleGenerate} disabled={isGenerating || (generationMode === 'image-3d' && ((imageMode === 'single' && !uploadedImage) || (imageMode === 'multiple' && !multiViewImages.front))) || (generationMode === 'text-3d' && !prompt.trim())} className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]">
              {isGenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />生成中...</> : <><Box className="w-4 h-4" />开始生成 <span className="btn-power">⚡{cost}</span></>}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg-primary)] flex items-center justify-center p-8">
          {isGenerating ? (
            <div className="text-center">
              <div className="w-32 h-32 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-4 border relative">
                <LoadingSpinner size="lg" className="text-[var(--gold)]" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-24"><LoadingProgressBar progress={progress} /></div>
              </div>
              <p className="text-lg text-[var(--text-secondary)]">AI 生成 3D 模型中...</p>
              <p className="text-sm text-[var(--text-muted)]">{Math.round(progress)}%</p>
            </div>
          ) : result ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full max-w-lg aspect-square bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden">
                {/* @ts-expect-error - model-viewer is a custom element */}
                <model-viewer src={`/api/proxy-model?url=${encodeURIComponent(result)}`} auto-rotate={autoRotate} camera-controls alt="3D 模型" className="w-full h-full" />
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-48 h-48 border-2 border-dashed border-[var(--border-color)] rounded-xl flex flex-col items-center justify-center mb-4 hover:border-[var(--gold)]">
                <Box className="w-10 h-10 text-[var(--text-muted)] mb-2" />
              </div>
              <p className="text-base text-[var(--text-primary)] mb-1">{generationMode === 'text-3d' ? '输入提示词生成3D模型' : '上传图片生成3D模型'}</p>
              <p className="text-sm text-[var(--text-muted)]">AI 3D 生成引擎就绪</p>
            </div>
          )}
        </div>

        {showHistory && (
          <div className="w-[260px] bg-[var(--bg-secondary)] border-l flex flex-col">
            <div className="h-12 px-4 flex items-center justify-between border-b">
              <span className="text-sm font-medium">历史记录</span>
              <button onClick={() => setShowHistory(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {history.length === 0 ? <p className="text-center text-sm text-[var(--text-muted)] py-8">暂无记录</p> : (
                <div className="grid grid-cols-2 gap-3">
                  {history.map((item) => (
                    <div key={item.id} className="aspect-square bg-[var(--bg-card)] rounded overflow-hidden border hover:border-[var(--gold)] cursor-pointer">
                      <Image src={item.imageUrl!} alt="历史" width={200} height={200} className="w-full h-full object-cover" unoptimized />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => clearHistory()} disabled={history.length === 0} className="w-full py-2 text-sm border rounded disabled:opacity-30">清空历史</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
