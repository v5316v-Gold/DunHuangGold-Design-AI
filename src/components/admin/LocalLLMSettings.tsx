'use client';

import { useState } from 'react';
import { Sparkles, Server, Boxes, Zap, Check } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */


interface LocalLLMSettingsProps {
  onSave: (config: LocalLLMConfig) => void;
}

export interface LocalLLMConfig {
  provider: 'ollama' | 'lmstudio' | 'vllm';
  url: string;
  model: string;
}

const LLM_PROVIDERS = [
  { id: 'ollama', name: 'Ollama', icon: '🦙', description: '本地大模型运行框架', defaultPort: '11434' },
  { id: 'lmstudio', name: 'LM Studio', icon: '💻', description: '本地模型服务器', defaultPort: '1234' },
  { id: 'vllm', name: 'vLLM', icon: '⚡', description: '高性能推理服务', defaultPort: '8000' },
];

export default function LocalLLMSettings({ onSave }: LocalLLMSettingsProps) {
  const [selectedProvider, setSelectedProvider] = useState<'ollama' | 'lmstudio' | 'vllm'>('ollama');
  const [url, setUrl] = useState('http://localhost');
  const [port, setPort] = useState('11434');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);

  const handleProviderChange = (provider: 'ollama' | 'lmstudio' | 'vllm') => {
    setSelectedProvider(provider);
    const p = LLM_PROVIDERS.find(p => p.id === provider);
    if (p) {
      setPort(p.defaultPort);
    }
  };

  const handleSave = () => {
    onSave({
      provider: selectedProvider,
      url: `${url}:${port}`,
      model,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 说明 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">本地大模型配置</h3>
            <p className="text-xs text-[var(--text-muted)]">AI对话专用 - Ollama / LM Studio / vLLM</p>
          </div>
        </div>
        
        <p className="text-sm text-[var(--text-muted)]">
          本地大模型作为云端 AI 的备用方案。当云端服务不可用时，可以使用本地部署的模型进行 AI 对话。
        </p>
      </div>

      {/* 选择提供商 */}
      <div className="grid grid-cols-3 gap-4">
        {LLM_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            onClick={() => handleProviderChange(provider.id as any)}
            className={`p-4 rounded-xl border transition-all ${
              selectedProvider === provider.id
                ? 'border-[var(--gold)] bg-[var(--gold)]/10 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--gold)]/50'
            }`}
          >
            <div className="text-2xl mb-2">{provider.icon}</div>
            <p className="font-medium text-[var(--text-primary)]">{provider.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{provider.description}</p>
          </button>
        ))}
      </div>

      {/* 配置表单 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
        <h4 className="font-medium text-[var(--text-primary)] mb-4">服务配置</h4>
        
        <div className="grid grid-cols-12 gap-4 mb-4">
          <div className="col-span-5">
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">服务地址</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                placeholder="http://localhost"
              />
              <span className="self-center text-[var(--text-muted)]">:</span>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-24 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
              />
            </div>
          </div>
          <div className="col-span-5">
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">模型名称</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
              placeholder={selectedProvider === 'ollama' ? '如: llama3, qwen2.5' : '如: meta-llama/Llama-3-8B-Instruct'}
            />
          </div>
          <div className="col-span-2 flex items-end">
            <button
              onClick={handleSave}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-[var(--gold)] text-black hover:shadow-lg'
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  已保存
                </>
              ) : (
                '保存配置'
              )}
            </button>
          </div>
        </div>

        {/* 连接测试 */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Server className="w-3 h-3" />
          <span>完整地址: {url}:{port}</span>
          {model && (
            <>
              <span className="mx-2">|</span>
              <Boxes className="w-3 h-3" />
              <span>模型: {model}</span>
            </>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
        <h4 className="font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--gold)]" />
          使用提示
        </h4>
        <ul className="text-xs text-[var(--text-muted)] space-y-1 list-disc list-inside">
          <li>本地大模型需要先启动对应服务（Ollama / LM Studio / vLLM）</li>
          <li>确保服务地址和端口配置正确</li>
          <li>模型名称必须与服务中已加载的模型名称完全一致</li>
          <li>本地模型响应速度取决于硬件配置</li>
        </ul>
      </div>
    </div>
  );
}
