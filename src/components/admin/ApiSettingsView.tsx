'use client';
import { toast } from 'sonner';

import React, { useState, useEffect } from 'react';
import { 
  Cloud, Server, Cpu, 
  CheckCircle, XCircle, AlertCircle, 
  RefreshCw, Save, Play, 
  ChevronDown, ChevronUp,
  Plug, Settings, MessageCircle,
  Eye, EyeOff, Zap, Workflow, Sparkles,
  Plus, Edit, Trash2, X, Coins
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FEATURE_LIST, getFeature } from '@/config/features';
import { 
  CloudApiConfig, 
  ComfyUIConfig, 
  LocalLLMConfig,
  CloudProvider,
  CLOUD_PROVIDERS,
  LLM_PROVIDERS,
  getDefaultComfyUIConfig,
  getDefaultLocalLLMConfig
} from '@/config/api-settings';
import ComfyUIWorkflowManager from '@/components/admin/ComfyUIWorkflowManager';
import PromptConfigSection from './PromptConfigSection';
import { ModelsEditor, type ModelItem } from './ModelsEditor';

/* eslint-disable @typescript-eslint/no-explicit-any */


// 优化：功能分类颜色映射
const CATEGORY_STYLES: Record<string, { bg: string; border: string; badge: string; icon: string }> = {
  'image': { bg: 'from-blue-500/5 to-blue-600/5', border: 'border-blue-500/30', badge: 'bg-blue-500/10 text-blue-600', icon: 'text-blue-500' },
  'video': { bg: 'from-purple-500/5 to-purple-600/5', border: 'border-purple-500/30', badge: 'bg-purple-500/10 text-purple-600', icon: 'text-purple-500' },
  '3d': { bg: 'from-orange-500/5 to-orange-600/5', border: 'border-orange-500/30', badge: 'bg-orange-500/10 text-orange-600', icon: 'text-orange-500' },
  'chat': { bg: 'from-green-500/5 to-green-600/5', border: 'border-green-500/30', badge: 'bg-green-500/10 text-green-600', icon: 'text-green-500' },
  'default': { bg: 'from-gray-500/5 to-gray-600/5', border: 'border-gray-500/30', badge: 'bg-gray-500/10 text-gray-600', icon: 'text-gray-500' },
};

function getCategoryStyle(category?: string) {
  return CATEGORY_STYLES[category || 'default'];
}

// ==================== 云端API设置组件 ====================

// 连接对象接口
interface CloudConnectionDisplay {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  endpoint: string;
  model: string;
  timeout: number;
  enabled: boolean;
  isDefault: boolean;
  // LLM 扩展字段
  providerLabel?: string;
  availableModels?: ModelItem[];
}

function CloudApiSettings() {
  const [activeTab, setActiveTab] = useState<'apis' | 'features'>('apis');
  const [connections, setConnections] = useState<Record<string, Partial<CloudConnectionDisplay>>>({});
  const [configs, setConfigs] = useState<Record<string, Partial<CloudApiConfig>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingConn, setEditingConn] = useState<Partial<CloudConnectionDisplay> | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/cloud', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setConnections(data.data.connections || {});
        setConfigs(data.data.featureConfigs || {});
      }
    } catch (e) { console.error('加载失败', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  // ---- 连接管理 ----
  const saveConnection = async () => {
    if (!editingConn?.id) return;
    setSaving(editingConn.id);
    try {
      const res = await fetch('/api/settings/cloud', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveConnection', connection: editingConn }),
      });
      const data = await res.json();
      if (data.success) {
        setConnections(prev => ({ ...prev, [editingConn!.id!]: { ...editingConn as any } }));
        setEditingConn(null);
      } else toast.error(data.error);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  };

  const deleteConnection = async (id: string) => {
    if (!confirm('确定删除此连接？')) return;
    try {
      await fetch('/api/settings/cloud', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteConnection', connectionId: id }),
      });
      setConnections(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e) { console.error(e); }
  };

  // ---- 功能配置 ----
  const updateConfig = (featureId: string, updates: Partial<CloudApiConfig>) => {
    setConfigs(prev => ({ ...prev, [featureId]: { ...prev[featureId], ...updates } }));
  };

  const saveFeatureConfig = async (featureId: string) => {
    setSaving(featureId);
    try {
      const res = await fetch('/api/settings/cloud', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 只提交核心字段：启用、绑定连接、算力消耗
        body: JSON.stringify({ featureId, config: { enabled: configs[featureId]?.enabled, connectionId: configs[featureId]?.connectionId, cost: configs[featureId]?.cost } }),
      });
      const data = await res.json();
      if (data.success) setExpandedFeature(null);
      else toast.error(data.error);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  };

  const connList = Object.values(connections);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--gold)]" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部标签切换 */}
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] w-fit">
        <button
          onClick={() => setActiveTab('apis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'apis' ? 'bg-[var(--gold)] text-black shadow' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
          }`}
        >
          <Plug className="w-4 h-4" /> 大模型API
        </button>
        <button
          onClick={() => setActiveTab('features')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'features' ? 'bg-[var(--gold)] text-black shadow' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
          }`}
        >
          <Settings className="w-4 h-4" /> 功能配置
        </button>
      </div>

      {/* ========== 大模型API ========= */}
      {activeTab === 'apis' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">API连接列表</h3>
              <p className="text-xs text-muted-foreground mt-0.5">管理云端API凭证，可被多个功能复用</p>
            </div>
            <Button size="sm" onClick={() => setEditingConn({ id: Date.now().toString(), name: '', provider: 'minimax', apiKey: '', endpoint: '', model: '', timeout: 60000, enabled: true, isDefault: false } as any)} className="gap-1">
              <Plus className="w-4 h-4" /> 新建连接
            </Button>
          </div>

          {/* 连接列表 */}
          <div className="grid gap-3">
            {connList.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-[var(--border-color)] rounded-lg">
                暂无连接配置，点击{`"新建连接"`}添加
              </div>
            )}
            {connList.map(conn => (
              <Card key={conn.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${conn.enabled ? 'bg-[var(--gold)]/20' : 'bg-muted'}`}>
                        <Cloud className={`w-5 h-5 ${conn.enabled ? 'text-[var(--gold)]' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">{conn.name || conn.id}</span>
                          {conn.isDefault && <Badge variant="outline" className="text-xs">默认</Badge>}
                          <Badge variant={conn.enabled ? 'default' : 'secondary'} className="text-xs">{conn.enabled ? '启用' : '禁用'}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {CLOUD_PROVIDERS[conn.provider as keyof typeof CLOUD_PROVIDERS]?.name || conn.provider} · {conn.endpoint || '未设置地址'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingConn(conn as any)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => deleteConnection(conn.id!)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========== 功能配置 ========= */}
      {activeTab === 'features' && (
        <FeatureConfigPanel
          configs={configs}
          connections={connections}
          expanded={expandedFeature}
          onToggle={setExpandedFeature}
          onUpdate={updateConfig}
          onSave={saveFeatureConfig}
          saving={saving}
        />
      )}

      {/* ========== 连接编辑弹窗 ========= */}
      {editingConn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[500px] max-h-[85vh] overflow-auto">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base">{connections[editingConn.id!] ? '编辑连接' : '新建连接'}</CardTitle>
              <button onClick={() => setEditingConn(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">连接ID</Label>
                  <Input value={editingConn.id || ''} onChange={e => setEditingConn(p => ({ ...p, id: e.target.value }))} placeholder="如: openai-main" className="h-9 font-mono text-sm" disabled={!!connections[editingConn.id!]} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">显示名称</Label>
                  <Input value={editingConn.name || ''} onChange={e => setEditingConn(p => ({ ...p, name: e.target.value }))} placeholder="如: OpenAI 主账号" className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">服务商</Label>
                <select className="w-full h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]" value={editingConn.provider || 'minimax'} onChange={e => {
                  const p = e.target.value as CloudProvider;
                  setEditingConn(prev => ({ ...prev, provider: p, endpoint: CLOUD_PROVIDERS[p]?.defaultEndpoint || '', model: CLOUD_PROVIDERS[p]?.defaultModel || '' }));
                }}>
                  {Object.entries(CLOUD_PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Provider 显示名</Label>
                <Input value={editingConn.providerLabel || ''} onChange={e => setEditingConn(p => ({ ...p, providerLabel: e.target.value }))} placeholder="如: MiniMax (China)" className="h-9" />
                <p className="text-xs text-muted-foreground">显示在用户面前的中文名，留空则用服务商 ID</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">API Key</Label>
                <div className="relative">
                  <Input type={showApiKey[editingConn.id!] ? 'text' : 'password'} value={editingConn.apiKey || ''} onChange={e => setEditingConn(p => ({ ...p, apiKey: e.target.value }))} placeholder="sk-xxxxxxxx" className="h-9 pr-10" />
                  <button onClick={() => setShowApiKey(p => ({ ...p, [editingConn!.id!]: !p[editingConn!.id!] }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showApiKey[editingConn!.id!] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">API地址</Label>
                <Input value={editingConn.endpoint || ''} onChange={e => setEditingConn(p => ({ ...p, endpoint: e.target.value }))} placeholder="https://api.example.com" className="h-9 font-mono text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">默认模型</Label>
                  {(editingConn.availableModels || []).filter((m: ModelItem) => m.enabled).length > 0 ? (
                    <select
                      value={editingConn.model || ''}
                      onChange={e => setEditingConn(p => ({ ...p, model: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]"
                    >
                      <option value="">（请选择）</option>
                      {(editingConn.availableModels as ModelItem[] || [])
                        .filter((m: ModelItem) => m.enabled)
                        .map((m: ModelItem) => (
                          <option key={m.id} value={m.id}>{m.label} ({m.id})</option>
                        ))
                      }
                    </select>
                  ) : (
                    <Input value={editingConn.model || ''} onChange={e => setEditingConn(p => ({ ...p, model: e.target.value }))} placeholder="如: gpt-4o" className="h-9" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">超时 (ms)</Label>
                  <Input type="number" value={editingConn.timeout || 60000} onChange={e => setEditingConn(p => ({ ...p, timeout: parseInt(e.target.value) || 60000 }))} className="h-9" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editingConn.enabled ?? true} onChange={e => setEditingConn(p => ({ ...p, enabled: e.target.checked }))} className="w-4 h-4 rounded accent-[var(--gold)]" />
                  <span className="text-sm">启用</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editingConn.isDefault ?? false} onChange={e => setEditingConn(p => ({ ...p, isDefault: e.target.checked }))} className="w-4 h-4 rounded accent-[var(--gold)]" />
                  <span className="text-sm">设为默认</span>
                </label>
              </div>

              {/* 可用模型清单（仅 LLM 连接 id 开头为 llm- 时显示）*/}
              {editingConn.id?.startsWith('llm-') && (
                <div className="space-y-1.5 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">可用模型清单</Label>
                    <span className="text-xs text-muted-foreground">
                      共 {(editingConn.availableModels || []).length} 个，
                      启用 {(editingConn.availableModels || []).filter((m: ModelItem) => m.enabled).length} 个
                    </span>
                  </div>
                  <ModelsEditor
                    models={editingConn.availableModels || []}
                    onChange={(models) => setEditingConn(p => ({ ...p, availableModels: models }))}
                    fetchConfig={{
                      provider: editingConn.provider || 'minimax',
                      apiKey: editingConn.apiKey || '',
                      endpoint: editingConn.endpoint || '',
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setEditingConn(null)}>取消</Button>
                <Button size="sm" onClick={saveConnection} disabled={saving !== null || !editingConn.id} className="gap-1">
                  {saving !== null ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ========== 功能配置面板（子组件）==========

function FeatureConfigPanel({
  configs, connections, expanded, onToggle, onUpdate, onSave, saving,
}: {
  configs: Record<string, Partial<CloudApiConfig>>;
  connections: Record<string, Partial<CloudConnectionDisplay>>;
  expanded: string | null;
  onToggle: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<CloudApiConfig>) => void;
  onSave: (id: string) => void;
  saving: string | null;
}) {
  const connList = Object.values(connections);

  const groupedFeatures = FEATURE_LIST.reduce((acc, feature) => {
    const info = getFeature(feature.id);
    const category = info?.category || 'default';
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, typeof FEATURE_LIST>);

  const categoryNames: Record<string, string> = {
    'image': '🖼️ 图像生成',
    'video': '🎬 视频生成',
    '3d': '🎲 3D建模',
    'chat': '💬 AI对话',
  };

  return (
    <div className="space-y-6">
      {Object.entries(groupedFeatures).map(([category, features]) => {
        const style = getCategoryStyle(category);
        return (
          <div key={category} className="space-y-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r ${style.bg} border-l-4 ${style.border}`}>
              <span className={`text-sm font-medium ${style.icon}`}>{categoryNames[category] || category}</span>
              <Badge variant="outline" className={`ml-auto ${style.badge}`}>{features.length} 个功能</Badge>
            </div>
            <div className="grid gap-3">
              {features.map(feature => {
                const featureInfo = getFeature(feature.id);
                const config = configs[feature.id] || { id: feature.id, enabled: false, cost: 0 };
                const isExpanded = expanded === feature.id;
                const boundConn = config.connectionId ? connections[config.connectionId] : null;

                return (
                  <Card key={feature.id} className={`overflow-hidden transition-all duration-200 ${isExpanded ? `shadow-lg ${style.border}` : ''}`}>
                    {/* 折叠时显示一行 */}
                    <CardHeader className={`py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? style.bg : ''}`} onClick={() => onToggle(isExpanded ? null : feature.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${style.bg} border ${style.border} flex items-center justify-center`}>
                            <Sparkles className={`w-4 h-4 ${style.icon}`} />
                          </div>
                          <div>
                            <CardTitle className="text-sm flex items-center gap-2">
                              {featureInfo?.name}
                              {config.enabled && boundConn ? (
                                <Badge variant="default" className="text-xs">{boundConn.name || boundConn.id}</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">{config.enabled ? '未绑定' : '未启用'}</Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs">{featureInfo?.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {boundConn && (
                            <span className="text-xs text-[var(--gold)] hidden sm:inline">
                              {CLOUD_PROVIDERS[boundConn.provider as keyof typeof CLOUD_PROVIDERS]?.name}
                            </span>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </CardHeader>

                    {/* 展开后简化表单 */}
                    {isExpanded && (
                      <CardContent className={`py-4 px-4 border-t ${style.bg} space-y-4`}>
                        <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                          <input type="checkbox" id={`feat-enabled-${feature.id}`} checked={config.enabled} onChange={e => { e.stopPropagation(); onUpdate(feature.id, { enabled: e.target.checked }); }} className="w-4 h-4 rounded accent-[var(--gold)]" />
                          <Label htmlFor={`feat-enabled-${feature.id}`} className="font-medium cursor-pointer text-sm">启用此功能</Label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-background/50 rounded-lg">
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <Plug className="w-3 h-3" /> 绑定API连接
                            </Label>
                            <select className="w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]" value={config.connectionId || ''} onChange={e => { e.stopPropagation(); onUpdate(feature.id, { connectionId: e.target.value }); }}>
                              <option value="">-- 请选择连接 --</option>
                              {connList.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name || c.id} ({CLOUD_PROVIDERS[c.provider as keyof typeof CLOUD_PROVIDERS]?.name})
                                </option>
                              ))}
                            </select>
                            {boundConn && (
                              <p className="text-xs text-muted-foreground">
                                模型: {boundConn.model || '默认'} · 超时: {boundConn.timeout || 60000}ms
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <Coins className="w-3 h-3" /> 算力消耗
                            </Label>
                            <Input type="number" value={config.cost || 0} onChange={e => { e.stopPropagation(); onUpdate(feature.id, { cost: parseInt(e.target.value) || 0 }); }} placeholder="0" className="h-10" />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => onToggle(null)}>收起</Button>
                          <Button size="sm" onClick={() => onSave(feature.id)} disabled={saving === feature.id} className="gap-1">
                            {saving === feature.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== 本地ComfyUI设置组件 ====================

function ComfyUISettings() {
  const [configs, setConfigs] = useState<Record<string, Partial<ComfyUIConfig>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comfyuiStatus, setComfyuiStatus] = useState<{ connected: boolean; info?: any }>({ connected: false });
  const [checking, setChecking] = useState(false);

  const loadConfigs = async () => {
    try {
      const res = await fetch('/api/settings/comfyui', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setConfigs(data.data);
      }
    } catch (e) {
      console.error('加载ComfyUI配置失败', e);
    } finally {
      setLoading(false);
    }
  };

  const checkComfyUI = async () => {
    setChecking(true);
    try {
      const res = await fetch('http://127.0.0.1:8188/system_stats');
      setComfyuiStatus({ connected: res.ok, info: await res.json().catch(() => null) });
    } catch {
      setComfyuiStatus({ connected: false });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    loadConfigs();
    checkComfyUI();
  }, []);

  const updateConfig = (featureId: string, updates: Partial<ComfyUIConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [featureId]: {
        ...prev[featureId],
        ...updates,
      },
    }));
  };

  const saveConfig = async (featureId: string) => {
    setSaving(featureId);
    try {
      const res = await fetch('/api/settings/comfyui', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureId,
          config: configs[featureId],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExpanded(null);
      } else {
        toast('保存失败: ${data.error}');
      }
    } catch (e: any) {
      toast('保存失败: ${e.message}');
    } finally {
      setSaving(null);
    }
  };

  // 过滤掉chat类别（AI对话不需要ComfyUI）
  const comfyuiFeatures = FEATURE_LIST.filter(f => {
    const info = getFeature(f.id);
    return info?.category !== 'chat';
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--gold)]" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${comfyuiStatus.connected ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">本地ComfyUI配置</h3>
            <p className="text-xs text-muted-foreground">配置本地工作流，节省云端算力</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${comfyuiStatus.connected ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {comfyuiStatus.connected ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>已连接 (127.0.0.1:8188)</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                <span>未连接</span>
              </>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={checkComfyUI} disabled={checking} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> 
            {checking ? '检测中...' : '重新检测'}
          </Button>
        </div>
      </div>

      {/* 提示信息 */}
      {!comfyuiStatus.connected && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600">ComfyUI 未连接</p>
            <p className="text-amber-600/70 mt-1">请确保 ComfyUI 已在本地运行，地址为 127.0.0.1:8188</p>
          </div>
        </div>
      )}

      {/* 功能列表 */}
      <div className="space-y-3">
        {comfyuiFeatures.map((feature) => {
          const featureInfo = getFeature(feature.id);
          const config = configs[feature.id] || { ...getDefaultComfyUIConfig(feature.id), id: feature.id };
          const isExpanded = expanded === feature.id;

          return (
            <Card key={feature.id} className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-lg border-[var(--gold)]/50' : ''}`}>
              <CardHeader className={`py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-gradient-to-r from-[var(--gold)]/5 to-transparent' : ''}`} onClick={() => setExpanded(isExpanded ? null : feature.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/30 flex items-center justify-center">
                      <Workflow className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        {featureInfo?.name}
                        <Badge variant={config.enabled ? 'default' : 'secondary'} className="text-xs">
                          {config.enabled ? '已启用' : '未启用'}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">{featureInfo?.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {config.workflowId && (
                      <code className="text-xs bg-muted px-2 py-0.5 rounded hidden sm:inline">
                        {config.workflowId.substring(0, 8)}...
                      </code>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="py-4 px-4 border-t bg-gradient-to-r from-[var(--gold)]/5 to-transparent space-y-4">
                  {/* 启用开关 */}
                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                    <input
                      type="checkbox"
                      id={`comfy-enabled-${feature.id}`}
                      checked={config.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateConfig(feature.id, { enabled: e.target.checked });
                      }}
                      className="w-4 h-4 rounded accent-[var(--gold)]"
                    />
                    <Label htmlFor={`comfy-enabled-${feature.id}`} className="font-medium cursor-pointer">
                      启用此功能的本地ComfyUI
                    </Label>
                  </div>

                  {/* 配置表单 */}
                  <div className="grid gap-4 p-4 bg-background/50 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Workflow className="w-3 h-3" /> Workflow ID
                      </Label>
                      <Input 
                        value={config.workflowId || ''}
                        onChange={(e) => updateConfig(feature.id, { workflowId: e.target.value })}
                        placeholder="在ComfyUI中复制工作流ID"
                        className="h-9 font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">在ComfyUI中打开工作流，点击{`"Share"`}复制Workflow ID</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">使用的模型（可选）</Label>
                      <Input 
                        value={config.model || ''}
                        onChange={(e) => updateConfig(feature.id, { model: e.target.value })}
                        placeholder="如: sd_xl_base_1.0.safetensors"
                        className="h-9"
                      />
                    </div>

                    {config.model && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span>将使用本地模型: {config.model}</span>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setExpanded(null)}>
                      收起
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => saveConfig(feature.id)} 
                      disabled={saving === feature.id}
                      className="gap-2"
                    >
                      {saving === feature.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      保存
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 本地大模型设置组件 ====================

function LocalLLMSettings() {
  const [config, setConfig] = useState<Partial<LocalLLMConfig>>({
    id: 'ai-chat',
    ...getDefaultLocalLLMConfig(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; models?: string[] } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    const timer = setTimeout(() => { loadConfig(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/settings/llm', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
      }
    } catch (e) {
      console.error('加载大模型配置失败', e);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (updates: Partial<LocalLLMConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/llm', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: '配置保存成功！' });
      } else {
        setTestResult({ success: false, message: data.error || '保存失败' });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/llm', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', config }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ 
          success: true, 
          message: `连接成功！`,
          models: data.data.models 
        });
      } else {
        setTestResult({ success: false, message: data.error });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--gold)]" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--gold)] to-amber-600 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">本地大模型配置</h3>
            <p className="text-xs text-muted-foreground">配置AI对话使用的本地LLM服务</p>
          </div>
        </div>
        <Badge variant={config.enabled ? 'default' : 'secondary'} className="text-sm px-3 py-1">
          {config.enabled ? '已启用' : '未启用'}
        </Badge>
      </div>

      {/* 主配置卡片 */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-green-500/5 to-transparent py-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              AI对话模型配置
            </CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="llm-enabled"
                checked={config.enabled}
                onChange={(e) => updateConfig({ enabled: e.target.checked })}
                className="w-4 h-4 rounded accent-[var(--gold)]"
              />
              <Label htmlFor="llm-enabled" className="text-sm cursor-pointer">启用</Label>
            </div>
          </div>
          <CardDescription>配置本地大模型服务，用于AI智能对话功能</CardDescription>
        </CardHeader>

        <CardContent className="py-6 px-4 space-y-6">
          {/* 服务商选择 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Server className="w-3 h-3" /> 服务商
              </Label>
              <Select 
                value={config.provider} 
                onValueChange={(v) => updateConfig({ provider: v as any })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LLM_PROVIDERS).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">{info.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Cpu className="w-3 h-3" /> 模型名称
              </Label>
              <Input 
                value={config.model || ''}
                onChange={(e) => updateConfig({ model: e.target.value })}
                placeholder="如: qwen2.5:7b, llama3.2"
                className="h-10"
              />
            </div>
          </div>

          {/* 服务地址 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Plug className="w-3 h-3" /> 服务地址
            </Label>
            <Input 
              value={config.baseUrl || ''}
              onChange={(e) => updateConfig({ baseUrl: e.target.value })}
              placeholder="http://127.0.0.1:11434"
              className="h-10 font-mono"
            />
          </div>

          {/* 高级设置折叠 */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              高级设置
            </summary>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">超时时间 (ms)</Label>
                <Input 
                  type="number"
                  value={config.timeout || 120000}
                  onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) || 120000 })}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">API Key（可选）</Label>
                <div className="relative">
                  <Input 
                    type={showApiKey ? 'text' : 'password'}
                    value={config.apiKey || ''}
                    onChange={(e) => updateConfig({ apiKey: e.target.value })}
                    placeholder="可选"
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="col-span-2 flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <input
                  type="checkbox"
                  id="llm-stream"
                  checked={config.stream}
                  onChange={(e) => updateConfig({ stream: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--gold)]"
                />
                <Label htmlFor="llm-stream" className="cursor-pointer">
                  <span className="font-medium">启用流式输出</span>
                  <span className="text-xs text-muted-foreground ml-2">实时显示AI生成的回复</span>
                </Label>
              </div>
            </div>
          </details>

          {/* 测试结果 */}
          {testResult && (
            <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.message}
                  </p>
                  {testResult.models && testResult.models.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">检测到的模型：</p>
                      <div className="flex flex-wrap gap-1">
                        {testResult.models.slice(0, 5).map((m, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                        ))}
                        {testResult.models.length > 5 && (
                          <Badge variant="outline" className="text-xs">+{testResult.models.length - 5} 更多</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button 
              variant="outline" 
              onClick={testConnection} 
              disabled={testing || !config.baseUrl}
              className="gap-2"
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              测试连接
            </Button>
            <Button onClick={saveConfig} disabled={saving} className="gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 服务说明 */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--gold)]" />
            常用服务地址
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-sm">Ollama</p>
            <code className="text-xs text-muted-foreground">http://127.0.0.1:11434</code>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-sm">LM Studio</p>
            <code className="text-xs text-muted-foreground">http://127.0.0.1:1234</code>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium text-sm">vLLM</p>
            <code className="text-xs text-muted-foreground">http://127.0.0.1:8000</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== 主组件 ====================

export default function ApiSettingsView() {
  return (
    <div className="h-full">
      <Tabs defaultValue="cloud" className="w-full">
        <TabsList className="mb-6 grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="cloud" className="gap-2">
            <Cloud className="w-4 h-4" />
            <span className="hidden sm:inline">云端API</span>
          </TabsTrigger>
          <TabsTrigger value="comfyui" className="gap-2">
            <Server className="w-4 h-4" />
            <span className="hidden sm:inline">本地ComfyUI</span>
          </TabsTrigger>
          <TabsTrigger value="llm" className="gap-2">
            <Cpu className="w-4 h-4" />
            <span className="hidden sm:inline">本地大模型</span>
          </TabsTrigger>
          <TabsTrigger value="assistant" className="gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">助手设置</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cloud" className="mt-0">
          <CloudApiSettings />
        </TabsContent>

        <TabsContent value="comfyui" className="mt-0">
          <ComfyUIWorkflowManager />
        </TabsContent>

        <TabsContent value="llm" className="mt-0">
          <LocalLLMSettings />
        </TabsContent>

        <TabsContent value="assistant" className="mt-0">
          <PromptConfigSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
