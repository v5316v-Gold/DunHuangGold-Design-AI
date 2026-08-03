'use client';

import { useState, ReactNode } from 'react';
import Image from 'next/image';
import ImageLoader from '@/components/ui/ImageLoader';
import { Download, RefreshCw, X, ZoomIn, ZoomOut, RotateCcw, Clock, Maximize2, Droplet, Trash2, CheckSquare, Square } from 'lucide-react';
import { SingleImageUploadBox } from '@/components/ui/SingleImageUploadBox';
import { getTaskCost } from '@/lib/power';
import { cn } from '@/lib/utils';
import { callApi } from '@/lib/api-service';
import { WorkspaceProps } from '@/constants/workspace';

interface HistoryItem {
  id: string;
  imageUrl: string;
  resolution: string;
  ratio: string;
  timestamp: Date;
}

interface ResolutionOption {
  value: string;
  label: string;
  desc: string;
  recommended?: boolean;
}

interface AspectRatioOption {
  value: string;
  label: string;
  desc: string;
}

export interface ImageWorkspaceConfig {
  /** 功能ID，用于API调用和算力获取 */
  featureId: string;
  /** 功能名称 */
  title: string;
  /** 生成按钮文字 */
  buttonText: string;
  /** 扣减算力原因 */
  deductReason: string;
  /** 下载文件名前缀 */
  downloadPrefix: string;
  /** 空状态图标 */
  emptyIcon: ReactNode;
  /** 空状态标题 */
  emptyTitle: string;
  /** 空状态描述 */
  emptyDesc: string;
  /** 按钮图标（可选，默认使用功能对应的图标） */
  buttonIcon?: ReactNode;
  /** API调用参数处理函数 */
  buildApiParams: (params: { image: string; resolution: string; ratio: string }) => Record<string, unknown>;
}

interface ImageWorkspaceProps extends WorkspaceProps {
  config: ImageWorkspaceConfig;
}

const resolutions: ResolutionOption[] = [
  { value: '1K', label: '1K', desc: '快速' },
  { value: '2K', label: '2K', desc: '推荐', recommended: true },
  { value: '4K', label: '4K', desc: '最高质量' },
];

const aspectRatios: AspectRatioOption[] = [
  { value: 'auto', label: 'Auto', desc: '自动' },
  { value: '1:1', label: '1:1', desc: '方形' },
  { value: '2:3', label: '2:3', desc: '竖版' },
  { value: '3:2', label: '3:2', desc: '横版' },
  { value: '3:4', label: '3:4', desc: '竖版' },
  { value: '4:3', label: '4:3', desc: '横版' },
  { value: '4:5', label: '4:5', desc: '竖版' },
  { value: '5:4', label: '5:4', desc: '横版' },
  { value: '9:16', label: '9:16', desc: '手机' },
  { value: '16:9', label: '16:9', desc: '宽屏' },
  { value: '21:9', label: '21:9', desc: '超宽' },
];

export function ImageWorkspace({ power, onDeductPower, config }: ImageWorkspaceProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resolution, setResolution] = useState('2K');
  const [ratio, setRatio] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());

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

  const removeFromHistory = (id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  };
  const cost = getTaskCost(config.featureId);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) { setError('请先上传图片'); return; }
    if (power < cost) { setError(`算力不足！需要: ${cost}`); return; }
    
    const currentTaskId = `task_${Date.now()}`;
    setTaskId(currentTaskId);
    setIsGenerating(true);
    setError(null);
    
    try {
      const apiParams = config.buildApiParams({
        image: uploadedImage,
        resolution,
        ratio,
      });
      
      const response = await callApi<string>(config.featureId, {
        params: apiParams,
      });
      
      if (response.success && response.data) {
        setResult(response.data);
        
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          imageUrl: response.data,
          resolution,
          ratio,
          timestamp: new Date(),
        };
        setHistory((prev) => [newItem, ...prev]);
        
        onDeductPower(cost, config.deductReason);
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
      link.download = `${config.downloadPrefix}-${resolution}-${Date.now()}.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(downloadUrl, '_blank');
    }
  };

  const displayTaskId = `${config.title}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
          <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-6">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-5">{config.title}</h2>
            
            {/* 主体图片 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">主体图片</label>
              <SingleImageUploadBox
                value={uploadedImage}
                onChange={setUploadedImage}
                placeholder="点击或拖拽上传图片"
                subText={config.emptyDesc}
                disabled={isGenerating}
                onClear={() => { setResult(null); setTaskId(null); }}
              />
            </div>

            {/* 分辨率 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">分辨率</label>
              <div className="grid grid-cols-3 gap-2">
                {resolutions.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setResolution(item.value)}
                    disabled={isGenerating}
                    className={cn(
                      'px-4 py-2 rounded-lg border text-center transition-all disabled:opacity-50',
                      resolution === item.value
                        ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--gold)]'
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

            {/* 图片比例 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">图片比例</label>
              <div className="grid grid-cols-4 gap-2">
                {aspectRatios.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setRatio(item.value)}
                    disabled={isGenerating}
                    className={cn(
                      'px-4 py-2 rounded-lg border text-center transition-all disabled:opacity-50',
                      ratio === item.value
                        ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--gold)]'
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
              disabled={isGenerating || !uploadedImage}
              className="w-full h-10 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all hover:shadow-lg shadow-[0_0_12px_rgba(200,164,92,0.4)]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  {config.buttonIcon || <Maximize2 className="w-4 h-4" />}
                  {config.buttonText}
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
                {resolution} · {aspectRatios.find(r => r.value === ratio)?.label}
              </span>
            )}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} 
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] disabled:opacity-30"
                disabled={!result}
              >
                <ZoomOut className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <span className="text-xs text-[var(--text-muted)] w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button 
                onClick={() => setZoom(z => Math.min(3, z + 0.25))} 
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] disabled:opacity-30"
                disabled={!result}
              >
                <ZoomIn className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <button 
                onClick={() => setZoom(1)} 
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] disabled:opacity-30"
                disabled={!result}
              >
                <RotateCcw className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
              <button 
                onClick={() => handleDownload()}
                disabled={!result} 
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] disabled:opacity-30"
              >
                <Download className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          {/* 预览内容 */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-[linear-gradient(rgba(200,164,92,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(200,164,92,.03)_1px,transparent_1px)] bg-[length:20px_20px]">
            {result ? (
              <div style={{ transform: `scale(${zoom})` }}>
                <ImageLoader
                  src={result}
                  alt="Generated"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-fade-in transition-transform duration-200"
                  showPlaceholder={false}
                />
              </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[var(--border-color)]">
                  {config.emptyIcon}
                </div>
                <p className="text-lg text-[var(--text-secondary)] mb-2">{config.emptyTitle}</p>
                <p className="text-sm text-[var(--text-muted)]">{config.emptyDesc}</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧历史记录侧边栏 */}
        {showHistory && (
          <div className="w-[280px] min-w-[280px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col animate-slide-in-right">
            <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="w-5 h-5 rounded flex items-center justify-center transition-all">
                  {selectedHistory.size === history.length && history.length > 0 ? <CheckSquare className="w-4 h-4 text-[var(--gold)]" /> : <Square className="w-4 h-4 text-[var(--text-muted)]" />}
                </button>
                <span className="text-sm font-medium text-[var(--text-primary)]">历史记录</span>
                {selectedHistory.size > 0 && <span className="text-xs text-[var(--text-muted)]">({selectedHistory.size})</span>}
              </div>
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
                <div className="grid grid-cols-2 gap-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square bg-[var(--bg-card)] rounded-xl overflow-hidden border-2 transition-all cursor-pointer"
                      style={{ borderColor: selectedHistory.has(item.id) ? 'var(--gold)' : 'var(--border-color)' }}
                      onClick={() => toggleSelect(item.id)}
                    >
                      <Image
                        src={item.imageUrl}
                        alt="历史记录"
                        className="w-full h-full object-cover"
                        width={200}
                        height={200}
                        unoptimized
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                        className="absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: selectedHistory.has(item.id) ? 'var(--gold)' : 'rgba(0,0,0,0.5)' }}
                      >
                        {selectedHistory.has(item.id) ? <CheckSquare className="w-3.5 h-3.5 text-black" /> : <Square className="w-3.5 h-3.5 text-white" />}
                      </button>
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
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-[10px] text-white">
                        {item.resolution}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-color)]">
              {selectedHistory.size > 0 ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadSelected}
                    className="flex-1 py-2 text-sm text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--gold)] transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />下载 ({selectedHistory.size})
                  </button>
                  <button
                    onClick={() => {
                      selectedHistory.forEach(id => removeFromHistory(id));
                      setSelectedHistory(new Set());
                    }}
                    className="flex-1 py-2 text-sm text-[var(--accent-red)] border border-[var(--accent-red)]/30 rounded-lg hover:bg-[var(--accent-red)]/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />删除 ({selectedHistory.size})
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setHistory([])}
                  disabled={history.length === 0}
                  className="w-full h-10 text-sm text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  清空历史
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { resolutions, aspectRatios };
export type { HistoryItem, ResolutionOption, AspectRatioOption };
