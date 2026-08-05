'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  Server, Plus, Trash2, Edit, X, Check, RefreshCw, 
  CheckCircle, XCircle, Globe, Clock, Key, Zap
} from 'lucide-react';
import { getAuthHeader } from '@/hooks/useAuth';

interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  authToken?: string;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  timeout: number;
}

interface ConnectionStatus {
  id: string;
  online: boolean;
  version?: string;
  gpu?: string;
  error?: string;
}

export default function ComfyUIConnectionManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  const [editingConn, setEditingConn] = useState<Partial<Connection>>({});
  const [saving, setSaving] = useState(false);

  // 加载连接列表
  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/comfyui/connections', { credentials: 'include', headers: { ...getAuthHeader() } });
      const data = await res.json();
      if (data.success) {
        setConnections(data.data || []);
      }
    } catch (e) {
      console.error('加载连接失败:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 检查单个连接状态
  const checkConnection = useCallback(async (conn: Connection) => {
    setChecking(prev => ({ ...prev, [conn.id]: true }));
    try {
      const res = await fetch(`/api/comfyui/call?connectionId=${conn.id}`, { credentials: 'include' });
      const data = await res.json();
      setStatuses(prev => ({
        ...prev,
        [conn.id]: {
          id: conn.id,
          online: data.online,
          version: data.version,
          gpu: data.gpu,
          error: data.error,
        },
      }));
    } catch (e) {
      setStatuses(prev => ({
        ...prev,
        [conn.id]: {
          id: conn.id,
          online: false,
          error: '检查失败',
        },
      }));
    } finally {
      setChecking(prev => ({ ...prev, [conn.id]: false }));
    }
  }, []);

  // 批量检查所有连接
  const checkAllConnections = useCallback(async () => {
    for (const conn of connections) {
      await checkConnection(conn);
    }
  }, [connections, checkConnection]);

  // 自动检查状态
  useEffect(() => {
    if (connections.length > 0) {
      checkAllConnections();
      const interval = setInterval(checkAllConnections, 30000);
      return () => clearInterval(interval);
    }
  }, [connections.length, checkAllConnections]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // 保存连接
  const handleSave = async () => {
    // 如果没有ID，生成一个
    const connData = {
      ...editingConn,
      // eslint-disable-next-line react-hooks/purity
      id: editingConn.id || `conn-${Date.now()}`,
    };
    
    if (!connData.name || !connData.host) {
      toast.error('请填写必填项');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/comfyui/connections', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(connData),
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(editingConn.id ? '连接已更新' : '连接已创建');
        await loadConnections();
        setShowModal(false);
        resetForm();
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (e) {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除连接
  const handleDelete = async (conn: Connection) => {
    if (!confirm(`确定删除连接 "${conn.name}" 吗？`)) return;

    try {
      const res = await fetch(`/api/admin/comfyui/connections/${conn.id}`, {
        credentials: 'include',
        method: 'DELETE',
        headers: { ...getAuthHeader() },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('连接已删除');
        await loadConnections();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (e) {
      toast.error('删除失败');
    }
  };

  // 设为默认
  const handleSetDefault = async (conn: Connection) => {
    try {
      const res = await fetch('/api/admin/comfyui/connections', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ ...conn, isDefault: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已将 "${conn.name}" 设为默认`);
        await loadConnections();
      }
    } catch (e) {
      toast.error('设置失败');
    }
  };

  const resetForm = () => {
    setEditingConn({
      id: '',
      name: '',
      host: '127.0.0.1',
      port: 8188,
      authToken: '',
      enabled: true,
      isDefault: false,
      priority: 0,
      timeout: 120000,
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (conn: Connection) => {
    setEditingConn({ ...conn });
    setShowModal(true);
  };

  const getStatusIcon = (conn: Connection) => {
    const status = statuses[conn.id];
    if (!status) return <div className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />;
    if (checking[conn.id]) return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
    return status.online 
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusText = (conn: Connection) => {
    const status = statuses[conn.id];
    if (!status) return '检测中...';
    if (checking[conn.id]) return '检测中...';
    if (status.online) return `在线 (v${status.version || '?'})`;
    return status.error || '离线';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--gold)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[var(--text-primary)]">ComfyUI 连接列表</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            管理本地 ComfyUI 服务连接，支持多节点配置
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkAllConnections}
            className="px-3 py-1.5 text-sm bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            刷新状态
          </button>
          <button
            onClick={openAddModal}
            className="px-3 py-1.5 text-sm bg-[var(--gold)] hover:shadow-lg text-black rounded-lg flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            添加连接
          </button>
        </div>
      </div>

      {/* 连接列表 */}
      {connections.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[var(--border-color)] rounded-xl">
          <Server className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3" />
          <p className="text-[var(--text-muted)]">暂无连接配置</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">点击上方{`"添加连接"`}开始配置</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {connections.map(conn => (
            <div
              key={conn.id}
              className={`p-4 rounded-xl border transition-all ${
                statuses[conn.id]?.online
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)]'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* 左侧: 状态 + 信息 */}
                <div className="flex items-center gap-3">
                  {getStatusIcon(conn)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{conn.name}</span>
                      {conn.isDefault && (
                        <span className="px-1.5 py-0.5 text-xs bg-[var(--gold)]/20 text-[var(--gold)] rounded">
                          默认
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {conn.host}:{conn.port}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        超时 {conn.timeout / 1000}s
                      </span>
                      <span>优先级 {conn.priority}</span>
                    </div>
                    <p className="text-xs mt-1 text-[var(--text-muted)]">
                      {getStatusText(conn)}
                      {statuses[conn.id]?.gpu && (
                        <span className="ml-2">| {statuses[conn.id].gpu}</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* 右侧: 操作 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => checkConnection(conn)}
                    disabled={checking[conn.id] === true}
                    className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-all disabled:opacity-50"
                    title="检测连接"
                  >
                    <RefreshCw className={`w-4 h-4 ${checking[conn.id] ? 'animate-spin' : ''}`} />
                  </button>
                  {!conn.isDefault && (
                    <button
                      onClick={() => handleSetDefault(conn)}
                      className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-all"
                      title="设为默认"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(conn)}
                    className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-all"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(conn)}
                    className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-primary)] rounded-xl w-[500px] max-h-[90vh] overflow-auto border border-[var(--border-color)]">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="font-medium text-[var(--text-primary)]">
                {editingConn.id ? '编辑连接' : '添加连接'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-[var(--bg-hover)] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">连接ID *</label>
                  <input
                    type="text"
                    value={editingConn.id || ''}
                    onChange={e => setEditingConn(p => ({ ...p, id: e.target.value }))}
                    placeholder="如: main, backup1"
                    disabled={!!editingConn.id}
                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">显示名称 *</label>
                  <input
                    type="text"
                    value={editingConn.name || ''}
                    onChange={e => setEditingConn(p => ({ ...p, name: e.target.value }))}
                    placeholder="如: ComfyUI-主节点"
                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">主机地址 *</label>
                  <input
                    type="text"
                    value={editingConn.host || ''}
                    onChange={e => setEditingConn(p => ({ ...p, host: e.target.value }))}
                    placeholder="127.0.0.1"
                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">端口 *</label>
                  <input
                    type="number"
                    value={editingConn.port || 8188}
                    onChange={e => setEditingConn(p => ({ ...p, port: parseInt(e.target.value) || 8188 }))}
                    placeholder="8188"
                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-muted)]">
                  <Key className="w-3 h-3 inline mr-1" />
                  认证 Token (可选)
                </label>
                <input
                  type="password"
                  value={editingConn.authToken || ''}
                  onChange={e => setEditingConn(p => ({ ...p, authToken: e.target.value }))}
                  placeholder="如有认证请输入"
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">优先级</label>
                  <input
                    type="number"
                    value={editingConn.priority || 0}
                    onChange={e => setEditingConn(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">超时 (秒)</label>
                  <input
                    type="number"
                    value={(editingConn.timeout || 120000) / 1000}
                    onChange={e => setEditingConn(p => ({ ...p, timeout: (parseInt(e.target.value) || 120) * 1000 }))}
                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--text-muted)]">&nbsp;</label>
                  <label className="flex items-center gap-2 h-[38px] px-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingConn.isDefault || false}
                      onChange={e => setEditingConn(p => ({ ...p, isDefault: e.target.checked }))}
                      className="w-4 h-4 rounded accent-[var(--gold)]"
                    />
                    <span className="text-sm">设为默认</span>
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingConn.enabled ?? true}
                  onChange={e => setEditingConn(p => ({ ...p, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--gold)]"
                />
                <span className="text-sm">启用此连接</span>
              </label>
            </div>

            <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-lg text-sm transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-[var(--gold)] hover:shadow-lg text-black rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
