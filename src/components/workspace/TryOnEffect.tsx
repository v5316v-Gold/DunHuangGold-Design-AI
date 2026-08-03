'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Download, RefreshCw, X, ZoomIn, ZoomOut, Sparkles, Plus } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading';
import { useAiGeneration } from '@/hooks/useAiGeneration';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useImageUpload } from '@/hooks/useImageUpload';
import { usePromptOptimize } from '@/hooks/usePromptOptimize';
import { PromptInput } from '@/components/ui/PromptInput';
import { WorkspaceProps } from '@/constants/workspace';

interface AspectRatio {
  value: string;
  label: string;
  width: number;
  height: number;
  desc: string;
}

const ASPECT_RATIOS: AspectRatio[] = [
  { value: 'auto', label: 'auto', width: 1024, height: 1024, desc: '1024×1024' },
  { value: 'horizontal', label: '横图', width: 1536, height: 1024, desc: '1536×1024' },
  { value: 'vertical', label: '竖图', width: 1024, height: 1536, desc: '1024×1536' },
  { value: '2k-square', label: '2K方图', width: 2048, height: 2048, desc: '2048×2048' },
  { value: '2k-horizontal', label: '2K横图', width: 2048, height: 1152, desc: '2048×1152' },
];

const MODES = [
  { value: 'closeup', label: '近景特写' },
  { value: 'model', label: '模特佩戴' },
];

export default function TryOnEffect({ power, onDeductPower }: WorkspaceProps) {
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('model');
  const [aspectRatio, setAspectRatio] = useState('auto');

  // 提示词优化
  const { handleOptimizePrompt } = usePromptOptimize(() => description, setDescription);
  const [result, setResult] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const cost = getTaskCost('tryon');

  // 单图上传 Hook（用于添加参考图片）
  const { uploadedImage: singleImg, isDragging, handleDrop, handleDragOver, handleDragLeave, handleFileSelect, clear: clearSingle } = useImageUpload({ maxSizeMB: 10 });

  // 同步单图上传
  useEffect(() => {
    if (singleImg && referenceImages.length < 16) {
      setReferenceImages(prev => [...prev, singleImg]);
      clearSingle();
    }
  }, [singleImg]);

  // AI 生成 Hook
  const { isGenerating, progress, error, generate, setError } = useAiGeneration({
    featureId: 'tryon',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      const images = Array.isArray(data) ? data : [data];
      if (images.length > 0 && images[0]) {
        setResult(images[0]);
      }
    },
  });

  const handleGenerate = async () => {
    if (referenceImages.length === 0) {
      setError('请至少上传一张参考图片');
      return;
    }

    const selectedRatio = ASPECT_RATIOS.find(r => r.value === aspectRatio) || ASPECT_RATIOS[0];

    await generate({
      images: referenceImages,
      description,
      mode,
      width: selectedRatio.width,
      height: selectedRatio.height,
    }, '佩戴效果');
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  // 键盘快捷键
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'Enter', modifiers: ['ctrl', 'meta'], handler: handleGenerate, description: '生成' },
    ],
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部状态栏 */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">SYSTEM READY</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧设置面板 */}
        <div className="w-[340px] min-w-[340px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">佩戴效果</h2>

              {/* 参考图片上传 */}
              <div className="mb-5">
                <label className="param-label">
                  参考图片（可选，最多16张）
                </label>
                <div className="text-xs text-[var(--text-muted)] mb-2">{referenceImages.length}/16</div>

                {/* 已上传图片预览 */}
                {referenceImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {referenceImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-color)]">
                        <Image src={img} alt={`参考图${idx + 1}`} width={100} height={100} className="w-full h-full object-cover" unoptimized />
                        <button
                          onClick={() => removeReferenceImage(idx)}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 添加图片按钮 */}
                {referenceImages.length < 16 && (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => document.getElementById('tryon-upload')?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all min-h-[120px]',
                      isDragging ? 'border-[var(--gold)] bg-[var(--gold-muted)]' : 'border-[var(--border-color)] hover:border-[var(--gold)]'
                    )}
                  >
                    <Plus className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-xs text-[var(--text-muted)]">添加图片</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="tryon-upload"
                />
              </div>

              {/* 补充描述 */}
              <div className="mb-5">
                <label className="param-label">
                  补充描述（可选）
                </label>
                <PromptInput
                  value={description}
                  onChange={setDescription}
                  onOptimize={handleOptimizePrompt}
                  isLoading={isGenerating}
                  placeholder="将产品生成模特佩戴效果图，要求产品比例尺寸正确一比一，保证结构细节保留一致性..."
                  height="h-24"
                  bgClass="bg-[var(--bg-tertiary)]"
                />
              </div>

              {/* 模式选择 */}
              <div className="mb-5">
                <label className="param-label">
                  模式（可选）
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      disabled={isGenerating}
                      className={cn(
                        'param-btn',
                        mode === m.value ? 'param-btn-selected' : 'param-btn-unselected'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 图片比例 */}
              <div className="mb-5">
                <label className="param-label">
                  图片比例
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setAspectRatio(r.value)}
                      disabled={isGenerating}
                      className={cn(
                        'param-btn',
                        aspectRatio === r.value ? 'param-btn-selected' : 'param-btn-unselected'
                      )}
                    >
                      <div className="font-medium text-sm">{r.label}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="mb-4 p-3 bg-[rgba(139,58,58,0.1)] border border-[rgba(139,58,58,0.3)] rounded-lg text-sm text-[var(--accent-red)]">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* 固定底部按钮区 */}
          <div className="p-5 border-t border-[var(--border-color)]">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || referenceImages.length === 0}
              className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  开始生成
                  <span className="btn-power">⚡{cost}</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        {/* 预览区域 */}
        <div className="flex-1 bg-[var(--bg-primary)] flex items-center justify-center p-8 relative">
          {isGenerating ? (
            <div className="text-center">
              <LoadingSpinner size="lg" className="text-[var(--gold)] mb-4" />
              <p className="text-lg text-[var(--text-secondary)]">AI 生成中...</p>
              <p className="text-sm text-[var(--text-muted)]">{Math.round(progress)}%</p>
            </div>
          ) : result ? (
            <div className="relative">
              <Image
                src={result}
                alt="生成结果"
                width={800}
                height={600}
                style={{ transform: `scale(${zoom})` }}
                className="max-w-full max-h-[65vh] rounded-xl shadow-2xl"
                unoptimized
              />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                  className="w-8 h-8 rounded bg-[var(--bg-card)] border flex items-center justify-center hover:bg-[var(--bg-hover)]"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                  className="w-8 h-8 rounded bg-[var(--bg-card)] border flex items-center justify-center hover:bg-[var(--bg-hover)]"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => window.open(result, '_blank')}
                  className="w-8 h-8 rounded bg-[var(--bg-card)] border flex items-center justify-center hover:bg-[var(--bg-hover)]"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-[var(--text-muted)]">
              <div className="w-24 h-24 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[var(--border-color)]">
                <Sparkles className="w-12 h-12 text-[var(--text-muted)]" />
              </div>
              <p className="text-lg">上传参考图片开始生成</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
