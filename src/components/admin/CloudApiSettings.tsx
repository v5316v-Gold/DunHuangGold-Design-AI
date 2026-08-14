'use client';

import { useState } from 'react';
import { RefreshCw, Play, Edit, CheckCircle, XCircle, Sparkles } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */


interface CloudApiSettingsProps {
  apiData: any;
  onRefresh: () => void;
  onToggle: (id: string) => void;
  onTest: (id: string, source: string) => void;
}

const CLOUD_FEATURES = [
  { id: 'llm-chat', name: 'AI对话', icon: '💬' },
  { id: 'image-generate', name: '图片生成', icon: '🖼️' },
  { id: 'image-edit', name: '图片编辑', icon: '✏️' },
  { id: '3d-modeling', name: '3D建模', icon: '🎲' },
  { id: 'video-generate', name: '视频生成', icon: '🎬' },
];

export default function CloudApiSettings({ apiData, onRefresh, onToggle, onTest }: CloudApiSettingsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleSave = async (id: string, config: any) => {
    // 保存逻辑
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* AI 助手配置 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">AI 写作助手</h3>
            <p className="text-xs text-[var(--text-muted)]">配置全局AI写作助手的API Key</p>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">服务商</label>
            <select className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
              <option value="zhipu">智谱AI</option>
              <option value="doubao">豆包</option>
              <option value="openai">OpenAI</option>
              <option value="qwen">通义千问</option>
              <option value="kimi">Kimi</option>
              <option value="minimax">MiniMax</option>
            </select>
          </div>
          <div className="col-span-5">
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">API Key</label>
            <input
              type="password"
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">模型</label>
            <select className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
              <option>glm-4</option>
              <option>glm-4-flash</option>
            </select>
          </div>
          <div className="col-span-1 flex items-end">
            <button className="w-full py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium">
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 云端功能配置列表 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-primary)]">云端API配置</h3>
          <button 
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--gold)] hover:text-black transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        </div>
        
        <div className="divide-y divide-[var(--border-color)]">
          {CLOUD_FEATURES.map((feature) => {
            const config = apiData?.configs?.[feature.id];
            const isEnabled = config?.enabled ?? true;
            const hasApiKey = !!config?.cloud?.apiKey;
            
            return (
              <div key={feature.id} className="p-4 hover:bg-[var(--bg-card)] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{feature.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{feature.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {hasApiKey ? '已配置' : '未配置'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTest(feature.id, 'cloud')}
                      className="px-3 py-1.5 bg-[var(--bg-secondary)] rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)] transition-all"
                      disabled={testingId === feature.id}
                    >
                      {testingId === feature.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      测试
                    </button>
                    
                    <button
                      onClick={() => onToggle(feature.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isEnabled
                          ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                          : 'bg-gray-500/20 text-gray-500 hover:bg-gray-500/30'
                      }`}
                    >
                      {isEnabled ? (
                        <><CheckCircle className="w-3 h-3 inline mr-1" />启用</>
                      ) : (
                        <><XCircle className="w-3 h-3 inline mr-1" />禁用</>
                      )}
                    </button>
                    
                    <button className="px-3 py-1.5 bg-[var(--bg-card)] rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--gold)] hover:text-black transition-all">
                      <Edit className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
