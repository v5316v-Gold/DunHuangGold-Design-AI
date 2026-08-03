'use client';

/**
 * 模型中心管理视图（任务三）
 *
 * 功能：
 * - 顶部：标题 + 类型筛选（全部/lora/base-model/controlnet）+ 上传/登记按钮 + 刷新
 * - 上传弹窗：文件选择 + 类型 + 名称 + 版本 + 描述 + 触发词 + 基础模型 + 权重 + 绑定功能
 *   （文件上传走 /api/admin/models/upload，显示真实上传进度；也可仅登记元数据）
 * - 表格：名称、类型、版本、大小、SHA256、绑定功能、权重、状态开关、操作（删除）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Upload,
  RefreshCw,
  Trash2,
  Plus,
  X,
  HardDrive,
  FileBox,
  Boxes,
} from 'lucide-react';

type ModelType = 'lora' | 'base-model' | 'controlnet';

interface ModelItem {
  id: string;
  modelType: ModelType;
  name: string;
  filePath: string | null;
  originalFilename: string | null;
  version: string | null;
  fileSize: number | null;
  sha256: string | null;
  boundFeatures: string[];
  enabled: boolean;
  triggerWords: string[];
  baseModel: string | null;
  weight: string | null;
  description: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  lora: 'LoRA',
  'base-model': '基础模型',
  controlnet: 'ControlNet',
};

const TYPE_BADGE: Record<string, string> = {
  lora: 'text-[var(--gold)] bg-[var(--gold-muted)] border border-[var(--gold-border)]',
  'base-model': 'text-[var(--info)] bg-[var(--info-light)] border border-[var(--border-color)]',
  controlnet: 'text-[var(--success)] bg-[var(--success-light)] border border-[var(--border-color)]',
};

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function truncateSha(sha: string | null): string {
  if (!sha) return '-';
  if (sha.length <= 16) return sha;
  return `${sha.slice(0, 10)}…${sha.slice(-6)}`;
}

function parseWeight(weight: string | null): string {
  if (!weight) return '-';
  const n = parseFloat(weight);
  return Number.isFinite(n) ? n.toFixed(2) : weight;
}

const inputCls =
  'w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/40 transition-all placeholder:text-[var(--text-muted)]';

const labelCls = 'block text-xs text-[var(--text-muted)] mb-1.5';

export default function ModelsManagementView() {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | ModelType>('all');
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/admin/models?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setModels(data.data?.items || []);
        setTotal(data.data?.total || 0);
      } else {
        setError(data.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const toggleEnabled = async (m: ModelItem) => {
    try {
      const res = await fetch('/api/admin/models', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, enabled: !m.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(m.enabled ? `「${m.name}」已停用` : `「${m.name}」已启用`);
        fetchModels();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('操作失败');
    }
  };

  const handleDelete = async (m: ModelItem) => {
    const msg = `确定删除模型「${m.name}」吗？\n${m.filePath ? '将同时删除落盘文件（不可恢复）。' : ''}`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch('/api/admin/models', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, deleteFile: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('模型已删除');
        fetchModels();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部：标题 + 筛选 + 操作 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[var(--gold)]" />
            模型中心
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            管理 LoRA / 基础模型 / ControlNet 文件，共 {total} 个模型
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 类型筛选 */}
          <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-1">
            {(['all', 'lora', 'base-model', 'controlnet'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  typeFilter === t
                    ? 'bg-[var(--gold)] text-black font-medium shadow-[0_0_12px_rgba(200,164,92,0.35)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--gold)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {t === 'all' ? '全部' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <button
            onClick={fetchModels}
            disabled={loading}
            className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold-border)] transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:bg-[var(--gold-hover)] transition-all flex items-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.25)]"
          >
            <Plus className="w-4 h-4" />
            上传 / 登记模型
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[var(--error-light)] text-[var(--error)] text-sm border border-[var(--error)]/30">
          {error}
        </div>
      )}

      {/* 模型表格 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--text-muted)]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[var(--gold)]" />
            加载中...
          </div>
        ) : models.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-muted)]">
            <FileBox className="w-10 h-10 mx-auto mb-3 text-[var(--text-dim)]" />
            暂无模型，点击右上角「上传 / 登记模型」添加
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-medium">名称</th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">版本</th>
                  <th className="px-4 py-3 font-medium">大小</th>
                  <th className="px-4 py-3 font-medium">SHA256</th>
                  <th className="px-4 py-3 font-medium">绑定功能</th>
                  <th className="px-4 py-3 font-medium">权重</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-hover)]/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-primary)]">{m.name}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5 max-w-[240px] truncate">
                        {m.originalFilename || m.filePath || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[m.modelType] || ''}`}
                      >
                        {TYPE_LABELS[m.modelType] || m.modelType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{m.version || '-'}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                      {formatSize(m.fileSize)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        title={m.sha256 || undefined}
                        className="font-mono text-xs text-[var(--text-muted)]"
                      >
                        {truncateSha(m.sha256)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.boundFeatures && m.boundFeatures.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {m.boundFeatures.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--text-dim)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{parseWeight(m.weight)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleEnabled(m)}
                        className={`w-11 h-6 rounded-full relative transition-all ${
                          m.enabled
                            ? 'bg-[var(--success)] shadow-[0_0_10px_rgba(74,154,122,0.4)]'
                            : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
                        }`}
                        title={m.enabled ? '点击停用' : '点击启用'}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            m.enabled ? 'left-[22px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(m)}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-light)] transition-all"
                        title="删除模型"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchModels();
          }}
        />
      )}
    </div>
  );
}

/* ==================== 上传 / 登记弹窗 ==================== */

function UploadModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [metadataOnly, setMetadataOnly] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [modelType, setModelType] = useState<ModelType>('lora');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [filePath, setFilePath] = useState('');
  const [description, setDescription] = useState('');
  const [triggerWords, setTriggerWords] = useState('');
  const [baseModel, setBaseModel] = useState('');
  const [weight, setWeight] = useState('0.8');
  const [boundFeatures, setBoundFeatures] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const splitList = (s: string) =>
    s
      .split(/[,，]/)
      .map((x) => x.trim())
      .filter(Boolean);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metadataOnly && !file) {
      toast.error('请选择要上传的模型文件');
      return;
    }
    if (!name.trim()) {
      toast.error('请填写模型名称');
      return;
    }

    setSubmitting(true);
    setProgress(0);

    try {
      if (metadataOnly) {
        // 仅登记元数据
        const res = await fetch('/api/admin/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelType,
            name: name.trim(),
            version: version.trim() || '1.0.0',
            filePath: filePath.trim() || undefined,
            description: description.trim() || undefined,
            triggerWords: splitList(triggerWords),
            boundFeatures: splitList(boundFeatures),
            baseModel: baseModel.trim() || undefined,
            weight,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('模型已登记');
          onSuccess();
        } else {
          toast.error(data.error || '登记失败');
        }
      } else {
        // 文件上传（XHR 显示真实进度）
        const formData = new FormData();
        formData.append('file', file!);
        formData.append('modelType', modelType);
        formData.append('name', name.trim());
        formData.append('version', version.trim() || '1.0.0');
        formData.append('description', description.trim());
        formData.append('triggerWords', triggerWords);
        formData.append('boundFeatures', boundFeatures);
        formData.append('baseModel', baseModel.trim());
        formData.append('weight', weight);

        const result = await new Promise<{ ok: boolean; data: any }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/admin/models/upload');
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              setProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
            }
          };
          xhr.onload = () => {
            try {
              resolve({ ok: xhr.status >= 200 && xhr.status < 300, data: JSON.parse(xhr.responseText) });
            } catch {
              reject(new Error('响应解析失败'));
            }
          };
          xhr.onerror = () => reject(new Error('网络错误'));
          xhr.send(formData);
        });

        if (result.ok && result.data?.success) {
          setProgress(100);
          toast.success('模型上传成功');
          onSuccess();
        } else {
          toast.error(result.data?.error || '上传失败');
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)]">
      <div className="w-full max-w-2xl bg-[var(--bg-secondary)] border border-[var(--border-gold)] rounded-xl shadow-[var(--shadow-gold-lg)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[var(--gold)]" />
            {metadataOnly ? '登记模型（仅元数据）' : '上传模型文件'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 space-y-4">
          {/* 模式切换 */}
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={metadataOnly}
              onChange={(e) => setMetadataOnly(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4"
            />
            文件已在执行机上（仅登记元数据，不上传）
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>模型类型 *</label>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value as ModelType)}
                className={inputCls}
              >
                <option value="lora">LoRA</option>
                <option value="base-model">基础模型（Base Model）</option>
                <option value="controlnet">ControlNet</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="如 sd15-lora-gold-foil"
                required
              />
            </div>
          </div>

          {metadataOnly ? (
            <div>
              <label className={labelCls}>文件路径（执行机上的路径）</label>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                className={`${inputCls} font-mono`}
                placeholder="/models/loras/sd15-lora-gold-foil.safetensors"
              />
            </div>
          ) : (
            <div>
              <label className={labelCls}>模型文件 *</label>
              <div
                className="flex items-center gap-3 p-3 border border-dashed border-[var(--border-color)] rounded-lg hover:border-[var(--gold-border)] transition-all cursor-pointer bg-[var(--bg-card)]"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-5 h-5 text-[var(--gold)] shrink-0" />
                <span className="text-sm text-[var(--text-secondary)] truncate">
                  {file ? file.name : '点击选择文件（支持 .safetensors / .ckpt / .pt / .bin 等）'}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>版本</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className={inputCls}
                placeholder="1.0.0"
              />
            </div>
            <div>
              <label className={labelCls}>权重（LoRA 默认权重 0-1）</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>基础模型（LoRA 依赖）</label>
              <input
                type="text"
                value={baseModel}
                onChange={(e) => setBaseModel(e.target.value)}
                className={inputCls}
                placeholder="如 sd-15 / sdxl-base"
              />
            </div>
            <div>
              <label className={labelCls}>触发词（逗号分隔）</label>
              <input
                type="text"
                value={triggerWords}
                onChange={(e) => setTriggerWords(e.target.value)}
                className={inputCls}
                placeholder="dunhuang-gold, ornate-jewelry"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>绑定功能 featureCode（逗号分隔）</label>
            <input
              type="text"
              value={boundFeatures}
              onChange={(e) => setBoundFeatures(e.target.value)}
              className={inputCls}
              placeholder="text2img, refine"
            />
          </div>

          <div>
            <label className={labelCls}>描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="模型说明、用途等"
            />
          </div>

          {/* 上传进度 */}
          {!metadataOnly && submitting && (
            <div>
              <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                <span>上传中...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden border border-[var(--border-color)]">
                <div
                  className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-[var(--gold)] text-black hover:bg-[var(--gold-hover)] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {metadataOnly ? '登记中...' : '上传中...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {metadataOnly ? '登记' : '上传'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
