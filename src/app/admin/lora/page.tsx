'use client';

/**
 * LoRA 管理 UI（admin）
 *
 * 功能：
 * - 列出所有 LoRA
 * - 创建新 LoRA（填写元数据）
 * - 启用/停用
 * - 删除
 */

// 标记为动态渲染，避免静态生成时缺少客户端上下文

import { useState, useEffect } from 'react';

interface Lora {
  id: string;
  name: string;
  triggerWords: string[];
  filePath: string;
  baseModel?: string;
}

export default function LoraManagement() {
  const [loras, setLoras] = useState<Lora[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchLoras = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lora', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setLoras(data.loras);
      } else {
        setError(data.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoras();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">LoRA 管理</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showCreate ? '取消' : '+ 新建 LoRA'}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {showCreate && (
        <CreateLoraForm
          onSuccess={() => {
            setShowCreate(false);
            fetchLoras();
          }}
        />
      )}

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : loras.length === 0 ? (
        <p className="text-gray-500">暂无 LoRA，点击 + 新建按钮添加</p>
      ) : (
        <div className="grid gap-4">
          {loras.map((lora) => (
            <LoraCard key={lora.id} lora={lora} onUpdate={fetchLoras} />
          ))}
        </div>
      )}
    </div>
  );
}

function LoraCard({ lora, onUpdate }: { lora: Lora; onUpdate: () => void }) {
  const toggleEnabled = async () => {
    await fetch(`/api/admin/lora/${lora.id}/toggle`, { credentials: 'include', method: 'POST' });
    onUpdate();
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{lora.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{lora.filePath}</span>
          </p>
          <p className="text-sm text-gray-600 mt-2">
            <span className="font-medium">触发词:</span> {lora.triggerWords.join(', ')}
          </p>
          {lora.baseModel && (
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">基础模型:</span> {lora.baseModel}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={toggleEnabled}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            切换启用
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateLoraForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [triggerWords, setTriggerWords] = useState('');
  const [scope, setScope] = useState('text2img');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/lora', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          filePath,
          triggerWords: triggerWords
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          scope: scope
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('创建成功！');
        onSuccess();
      } else {
        alert(`失败: ${data.error}`);
      }
    } catch (err) {
      alert(`错误: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
      <h2 className="font-semibold mb-4">新建 LoRA</h2>
      <div className="grid gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">名称 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
            placeholder="敦煌金风格 v1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">文件路径 *</label>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded font-mono text-sm"
            placeholder="/loras/dunhuang-gold-v1.safetensors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">触发词 *（逗号分隔）</label>
          <input
            type="text"
            value={triggerWords}
            onChange={(e) => setTriggerWords(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
            placeholder="dunhuang-gold, ornate-jewelry"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">适用服务 *（逗号分隔）</label>
          <input
            type="text"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
            placeholder="text2img, refine"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? '提交中...' : '创建'}
        </button>
      </div>
    </form>
  );
}
