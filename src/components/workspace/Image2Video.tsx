'use client';

import { useState, useCallback, type ComponentProps } from 'react';
import Image from 'next/image';
import { usePageState } from '@/hooks/usePageState';
import { apiClient, API_ROUTES } from '@/lib/api-client';
import { toast } from 'sonner';
import { Upload, Download, RefreshCw, Video, Play, Pause, X, Clock, Info, Image as ImageIcon, Film } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { callApi } from '@/lib/api-service';
import { PromptInput } from '@/components/ui/PromptInput';
import { WorkspaceProps } from '@/constants/workspace';

/* eslint-disable @typescript-eslint/no-explicit-any */


interface HistoryItem {
  id: string;
  videoUrl: string;
  startImageUrl: string;
  endImageUrl: string | null;
  prompt: string;
  resolution: string;
  ratio: string;
  timestamp: Date;
}

const resolutions = [
  { value: '720p', label: '720P', desc: '标准' },
  { value: '1080p', label: '1080P', desc: '高清' },
];

const videoRatios = [
  { value: 'auto', label: '自动', desc: '默认' },
  { value: '16:9', label: '16:9', desc: '横版' },
  { value: '9:16', label: '9:16', desc: '竖版' },
];

// ImageUploadBox 子组件（模块级别）
function ImageUploadBox({ 
  type, 
  image, 
  isDragging,
  onUpload,
  onClear,
  onDrop,
  onDragOver,
  onDragLeave,
}: { 
  type: 'start' | 'end'; 
  image: string | null; 
  isDragging: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
}) {
  return (
    <div className="flex-1">
      <div className="relative">
        <label
          className={cn(
            'flex flex-col items-center justify-center aspect-square border border-dashed rounded-xl cursor-pointer transition-all overflow-hidden',
            isDragging
              ? 'border-[var(--gold)] bg-[var(--gold-muted)]'
              : 'border-[var(--border-color)] hover:border-[var(--gold)] bg-[var(--bg-card)]'
          )}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          {image ? (
            <Image src={image} alt="起始图片" width={400} height={400} className="w-full h-full object-cover" unoptimized />
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              <ImageIcon className="w-8 h-8 text-[var(--text-muted)] mb-2" />
            </div>
          )}
          <input type="file" accept="image/jpeg,image/png" onChange={onUpload} className="hidden" />
        </label>
        {image && (
          <button
            onClick={onClear}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--text-secondary)] text-center mt-2">
        {type === 'start' ? '首帧图片' : '尾帧图片'}
      </p>
    </div>
  );
}

export default function Image2Video({ power, onDeductPower }: WorkspaceProps) {
  const [startImage, setStartImage] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [prompt, setPrompt] = usePageState('img2video-prompt', '');
  const [resolution, setResolution] = useState('720p');
  const [ratio, setRatio] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const cost = getTaskCost('image2video');

  const handleImageUpload = (type: 'start' | 'end') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (type === 'start') {
          setStartImage(ev.target?.result as string);
        } else {
          setEndImage(ev.target?.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = useCallback((type: 'start' | 'end') => (e: React.DragEvent) => {
    e.preventDefault();
    if (type === 'start') setIsDraggingStart(false);
    else setIsDraggingEnd(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (type === 'start') {
          setStartImage(ev.target?.result as string);
        } else {
          setEndImage(ev.target?.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDragOver = useCallback((type: 'start' | 'end') => (e: React.DragEvent) => {
    e.preventDefault();
    if (type === 'start') setIsDraggingStart(true);
    else setIsDraggingEnd(true);
  }, []);

  const handleDragLeave = useCallback((type: 'start' | 'end') => (e: React.DragEvent) => {
    e.preventDefault();
    if (type === 'start') setIsDraggingStart(false);
    else setIsDraggingEnd(false);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  const handleGenerate = async () => {
    if (!startImage) { setError('请先上传首帧图片'); return; }
    if (power < cost) { setError(`算力不足！需要: ${cost}`); return; }
    
    const currentTaskId = `task_${Date.now()}`;
    setTaskId(currentTaskId);
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    
    const interval = setInterval(() => setProgress((p) => (p < 90 ? p + 10 : p)), 500);
    
    try {
      // 使用配置化API调用
      const response = await callApi<string>('video-generate', {
        params: {
          type: 'image2video',
          image: startImage,
          endImage,
          prompt,
          resolution,
          ratio,
        },
        onProgress: setProgress,
      });
      
      setProgress(100);
      
      if (response.success && response.data) {
        setResult(response.data);
        
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          videoUrl: response.data,
          startImageUrl: startImage,
          endImageUrl: endImage,
          prompt: prompt || '图生视频',
          resolution,
          ratio,
          timestamp: new Date(),
        };
        setHistory((prev) => [newItem, ...prev]);
        
        onDeductPower(cost, '图生视频');
      } else {
        setError(response.error || '生成失败');
      }
    } catch (err: any) { setError(err.message || '生成失败'); }
    finally { clearInterval(interval); setIsGenerating(false); }
  };

  const handleDownload = () => {
    if (!result) return;
    window.open(result, '_blank');
  };

  const clearImage = (type: 'start' | 'end') => {
    if (type === 'start') {
      setStartImage(null);
    } else {
      setEndImage(null);
    }
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

  const displayTaskId = `图生视频_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-ai-assistant-enabled>
      {/* 顶部状态栏 */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)]">SYSTEM READY</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--text-muted)]">{taskId ? taskId.slice(0, 12) + '...' : displayTaskId}</span>
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
          {/* 可滚动内容区 */}
          <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
          <div className="p-6">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">图生视频</h2>
            
            {/* 首尾帧图片 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">首尾帧图片</label>
              <div className="flex gap-3">
                <ImageUploadBox
                  type="start"
                  image={startImage}
                  isDragging={isDraggingStart}
                  onUpload={handleImageUpload('start')}
                  onClear={() => clearImage('start')}
                  onDrop={handleDrop('start')}
                  onDragOver={handleDragOver('start')}
                  onDragLeave={handleDragLeave('start')}
                />
                <ImageUploadBox
                  type="end"
                  image={endImage}
                  isDragging={isDraggingEnd}
                  onUpload={handleImageUpload('end')}
                  onClear={() => clearImage('end')}
                  onDrop={handleDrop('end')}
                  onDragOver={handleDragOver('end')}
                  onDragLeave={handleDragLeave('end')}
                />
              </div>
              <p className="text-xs text-[var(--gold)] mt-2">支持 JPG、PNG 格式，首帧必填，尾帧可选</p>
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
                placeholder="描述您想要生成的视频内容..."
                height="h-20"
                bgClass="bg-[var(--bg-tertiary)]"
              />
            </div>

            {/* 分辨率 */}
            <div className="mb-5">
              <label className="param-label">视频分辨率</label>
              <div className="grid grid-cols-2 gap-2">
                {resolutions.map((item) => (
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
                    <div className="text-xs text-[var(--text-muted)]">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 视频比例 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">视频比例</label>
              <div className="grid grid-cols-3 gap-2">
                {videoRatios.map((item) => (
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
                    <div className="text-xs text-[var(--text-muted)]">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 视频时长 */}
            <div className="mb-6">
              <label className="param-label">视频时长</label>
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Info className="w-4 h-4" />
                <span>有声视频·固定时长8秒</span>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mb-4 p-3 bg-[rgba(139,58,58,0.1)] border border-[rgba(139,58,58,0.3)] rounded-lg text-sm text-[var(--accent-red)]">
                {error}
              </div>
            )}

            {/* 生成按钮 */}
          </div>
          </div>

          {/* 固定底部按钮区 */}
          <div className="p-5 border-t border-[var(--border-color)]">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !startImage}
              className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  开始生成
                  <span className="btn-power">⚡{cost}</span>
                </>
              )}
            </button>
            <p className="text-center text-xs text-[var(--text-muted)] mt-3">⌘ + Enter to run</p>
          </div>
        </div>

        {/* 中间预览区域 */}
        <div className="flex-1 bg-[var(--bg-primary)] flex flex-col">
          {/* 顶部工具栏 */}
          <div className="h-12 px-4 flex items-center justify-end border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
            {result && (
              <span className="text-xs text-[var(--text-muted)] mr-2">
                {resolution} · {videoRatios.find(r => r.value === ratio)?.label}
              </span>
            )}
            <button 
              onClick={handleDownload}
              disabled={!result} 
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] disabled:opacity-30"
            >
              <Download className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>

          {/* 预览内容 */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-[linear-gradient(rgba(200,164,92,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(200,164,92,.03)_1px,transparent_1px)] bg-[length:20px_20px]">
            {isGenerating ? (
              <div className="text-center">
                <div className="w-24 h-24 bg-[var(--bg-card)] rounded-full flex items-center justify-center mx-auto mb-6 border border-[var(--border-color)] relative">
                  <Video className="w-12 h-12 text-[var(--gold)]" />
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="var(--border-color)" strokeWidth="6" fill="none" />
                    <circle cx="50" cy="50" r="45" stroke="var(--gold)" strokeWidth="6" fill="none" strokeDasharray={`${progress * 2.83} 283`} strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-lg text-[var(--text-secondary)] mb-2">视频生成中...</p>
                <p className="text-sm text-[var(--text-muted)]">{progress}%</p>
                <div className="w-64 h-2 bg-[var(--bg-tertiary)] rounded-full mt-4 mx-auto overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : result ? (
              <div className="w-full max-w-2xl animate-fade-in">
                <div 
                  className="aspect-video bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] flex items-center justify-center relative overflow-hidden group cursor-pointer"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-card)]" />
                  <button className="relative z-10 w-16 h-16 rounded-full bg-[var(--gold)]/90 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                    {isPlaying ? (
                      <Pause className="w-8 h-8 text-black" />
                    ) : (
                      <Play className="w-8 h-8 text-black ml-1" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-4 mt-4">
                  <span className="text-sm text-[var(--text-muted)]">8秒</span>
                  <span className="text-sm text-[var(--text-muted)]">·</span>
                  <span className="text-sm text-[var(--text-muted)]">{resolution}</span>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 bg-[var(--bg-card)] rounded-full flex items-center justify-center mx-auto mb-6 border border-[var(--border-color)]">
                  <Video className="w-12 h-12 text-[var(--text-muted)]" />
                </div>
                <p className="text-lg text-[var(--text-secondary)] mb-2">上传图片生成动态视频</p>
                <p className="text-sm text-[var(--text-muted)]">让静态图片动起来</p>
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
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="group relative bg-[var(--bg-card)] rounded-lg overflow-hidden border border-[var(--border-color)] hover:border-[var(--gold)] transition-all cursor-pointer"
                    >
                      <div className="flex gap-2 p-3">
                        <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-[var(--bg-tertiary)]">
                          <Image src={item.startImageUrl} alt="起始图片" width={48} height={48} className="w-full h-full object-cover" unoptimized />
                        </div>
                        {item.endImageUrl && (
                          <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-[var(--bg-tertiary)]">
                            <Image src={item.endImageUrl} alt="结束图片" width={48} height={48} className="w-full h-full object-cover" unoptimized />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Video className="w-3 h-3 text-[var(--text-muted)]" />
                            <span className="text-xs text-[var(--text-muted)]">8s · {item.resolution}</span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] line-clamp-1">{item.prompt}</p>
                        </div>
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
