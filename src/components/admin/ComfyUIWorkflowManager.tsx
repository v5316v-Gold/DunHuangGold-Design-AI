'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { Plus, Trash2, Edit, Server, Workflow, Code, Upload } from 'lucide-react';
import { getAuthHeader } from '@/hooks/useAuth';

/* eslint-disable @typescript-eslint/no-explicit-any */


// 工作流配置接口
interface Workflow {
  id: string;
  featureId: string;
  workflowJson: any;
  nodeMapping: Record<string, any>;
  defaultParams: Record<string, any>;
  fixedParams: Record<string, any>;
  connectionId: string;
  connection: { id: string; name: string; host: string; port: number } | null;
  enabled: boolean;
  isDefault: boolean;
  description: string;
  executionCount: number;
  lastExecutedAt: string;
}

// 连接配置接口
interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  authToken: string | null;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  timeout: number;
}

// 解析结果接口
interface ParseResult {
  nodes: Array<{
    id: string;
    type: string;
    inputs: Array<{ field: string; type: string; required: boolean; connected: boolean; value?: any }>;
    outputs: string[];
  }>;
  suggestedMappings: Record<string, { nodeId: string; field: string; type: string; required: boolean; default?: any }>;
  fixedNodes: string[];
  warnings: string[];
}

// 功能列表
const FEATURES = [
  // 图片生成类
  { id: 'text2img', name: '文案生图', category: '图片生成' },
  { id: 'product-refine', name: '产品精修', category: '图片生成' },
  { id: 'multi-image', name: '多图融合', category: '图片生成' },
  { id: 'one-click-design', name: '一键设计', category: '图片生成' },
  { id: 'multi-view', name: '生成多视图', category: '图片生成' },
  { id: 'sketch-realistic', name: '线稿/写实', category: '图片生成' },
  { id: 'free-creation', name: '自由创作区', category: '图片生成' },
  { id: 'remove-background', name: '移除背景', category: '图片生成' },
  { id: 'upscale', name: '高清放大', category: '图片生成' },
  { id: 'remove-watermark', name: '去除水印', category: '图片生成' },
  // 3D类
  { id: 'relief', name: '浮雕图生成', category: '3D类' },
  { id: 'image-3d', name: '3D模型生成', category: '3D类' },
  { id: 'stereo', name: '图像转立体', category: '3D类' },
  // 视频类
  { id: 'text2video', name: '文生视频', category: '视频类' },
  { id: 'image2video', name: '图生视频', category: '视频类' },
  // 特殊类
  { id: 'tryon', name: '佩戴效果', category: '特殊' },
];

export default function ComfyUIWorkflowManager() {
  // 状态
  const [activeTab, setActiveTab] = useState<'connections' | 'workflows'>('connections');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  
  // 编辑状态
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  
  // 解析状态
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [workflowJsonText, setWorkflowJsonText] = useState('');
  const [saving, setSaving] = useState(false);

  // 加载数据
  const loadConnections = async () => {
    try {
      const res = await fetch('/api/admin/comfyui/connections', { credentials: 'include', headers: { ...getAuthHeader() } });
      const data = await res.json();
      if (data.success) {
        setConnections(data.data);
      }
    } catch (e) {
      console.error('加载连接失败:', e);
    }
  };

  const loadWorkflows = async () => {
    try {
      const res = await fetch('/api/admin/comfyui/workflows', { credentials: 'include', headers: { ...getAuthHeader() } });
      const data = await res.json();
      if (data.success) {
        setWorkflows(data.data);
      }
    } catch (e) {
      console.error('加载工作流失败:', e);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadConnections(), loadWorkflows()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  // 测试连接
  const testConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(prev => ({ ...prev, [id]: null }));
    try {
      const res = await fetch(`/api/admin/comfyui/connections/${id}`, { credentials: 'include', method: 'POST', headers: { ...getAuthHeader() } });
      const data = await res.json();
      setTestResult(prev => ({ ...prev, [id]: data.data }));
    } catch (e) {
      setTestResult(prev => ({ ...prev, [id]: { online: false, error: String(e) } }));
    }
    setTestingId(null);
  };

  // 保存连接
  const saveConnection = async (conn: Partial<Connection>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/comfyui/connections', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(conn),
      });
      const data = await res.json();
      if (data.success) {
        await loadConnections();
        setEditingConnection(null);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      console.error('保存失败:', e);
    }
    setSaving(false);
  };

  // 删除连接
  const deleteConnection = async (id: string) => {
    if (!confirm('确定删除此连接？')) return;
    try {
      await fetch(`/api/admin/comfyui/connections/${id}`, { credentials: 'include', method: 'DELETE', headers: { ...getAuthHeader() } });
      await loadConnections();
    } catch (e) {
      console.error('删除失败:', e);
    }
  };

  // 解析工作流
  const parseWorkflow = async () => {
    if (!workflowJsonText.trim()) return;
    try {
      const json = JSON.parse(workflowJsonText);
      const res = await fetch('/api/admin/comfyui/workflows/parse', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ workflow_json: json }),
      });
      const data = await res.json();
      if (data.success) {
        setParseResult(data.data);
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error('JSON 解析失败: ' + String(e));
    }
  };

  // 保存工作流
  const saveWorkflow = async (wf: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/comfyui/workflows', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(wf),
      });
      const data = await res.json();
      if (data.success) {
        await loadWorkflows();
        setEditingWorkflow(null);
        setParseResult(null);
        setWorkflowJsonText('');
      } else {
        toast.error(data.error);
      }
    } catch (e) {
      console.error('保存失败:', e);
    }
    setSaving(false);
  };

  // 删除工作流
  const deleteWorkflow = async (id: string) => {
    if (!confirm('确定删除此工作流？')) return;
    try {
      await fetch(`/api/admin/comfyui/workflows/${id}`, { credentials: 'include', method: 'DELETE', headers: { ...getAuthHeader() } });
      await loadWorkflows();
    } catch (e) {
      console.error('删除失败:', e);
    }
  };

  // 启用/禁用
  const toggleWorkflow = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/admin/comfyui/workflows/${id}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ action: enabled ? 'enable' : 'disable' }),
      });
      await loadWorkflows();
    } catch (e) {
      console.error('操作失败:', e);
    }
  };

  // 渲染连接管理
  const renderConnections = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">ComfyUI 连接列表</h3>
        <Button onClick={() => setEditingConnection({} as Connection)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> 添加连接
        </Button>
      </div>

      <div className="grid gap-4">
        {connections.map(conn => (
          <Card key={conn.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Server className={`w-5 h-5 ${conn.enabled ? 'text-green-500' : 'text-gray-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{conn.name}</span>
                      {conn.isDefault && <Badge variant="outline">默认</Badge>}
                      <Badge variant={conn.enabled ? 'default' : 'secondary'}>
                        {conn.enabled ? '启用' : '禁用'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {conn.host}:{conn.port}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection(conn.id)}
                    disabled={testingId === conn.id}
                  >
                    {testingId === conn.id ? '测试中...' : '测试'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingConnection(conn)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteConnection(conn.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              
              {testResult[conn.id] && (
                <div className={`mt-3 p-3 rounded text-sm ${
                  testResult[conn.id].online ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {testResult[conn.id].online ? (
                    <span>✅ 在线 | 延迟: {testResult[conn.id].latencyMs}ms</span>
                  ) : (
                    <span>❌ 离线 | {testResult[conn.id].error}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {connections.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            暂无连接配置
          </div>
        )}
      </div>
    </div>
  );

  // 渲染工作流管理
  const renderWorkflows = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">工作流配置</h3>
        <Button onClick={() => {
          setEditingWorkflow({
            id: '',
            featureId: 'text2img',
            workflowJson: {},
            nodeMapping: {},
            defaultParams: {},
            fixedParams: {},
            connectionId: connections.find(c => c.isDefault)?.id || '',
            connection: null,
            enabled: false,
            isDefault: false,
            description: '',
            executionCount: 0,
            lastExecutedAt: '',
          });
          setParseResult(null);
          setWorkflowJsonText('');
        }} size="sm">
          <Plus className="w-4 h-4 mr-1" /> 添加工作流
        </Button>
      </div>

      <div className="grid gap-4">
        {workflows.map(wf => (
          <Card key={wf.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Workflow className={`w-5 h-5 ${wf.enabled ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className="font-medium">{wf.featureId}</span>
                    {wf.isDefault && <Badge variant="outline">默认</Badge>}
                    <Badge variant={wf.enabled ? 'default' : 'secondary'}>
                      {wf.enabled ? '启用' : '禁用'}
                    </Badge>
                  </div>
                  {wf.description && (
                    <div className="text-sm text-muted-foreground mt-1">{wf.description}</div>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    {wf.connection && <span>连接: {wf.connection.name}</span>}
                    <span>执行: {wf.executionCount} 次</span>
                    {wf.lastExecutedAt && <span>最后: {new Date(wf.lastExecutedAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleWorkflow(wf.id, !wf.enabled)}
                  >
                    {wf.enabled ? '禁用' : '启用'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditingWorkflow(wf);
                    setWorkflowJsonText(wf.workflowJson ? JSON.stringify(wf.workflowJson, null, 2) : '');
                    setParseResult(null);
                  }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteWorkflow(wf.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              
              {wf.nodeMapping && Object.keys(wf.nodeMapping).length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {Object.keys(wf.nodeMapping).map(key => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {workflows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            暂无工作流配置
          </div>
        )}
      </div>
    </div>
  );

  // 渲染连接编辑弹窗
  const renderConnectionModal = () => {
    if (!editingConnection) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-[500px] max-h-[80vh] overflow-auto">
          <CardHeader>
            <CardTitle>{editingConnection.id ? '编辑连接' : '新建连接'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>连接 ID</Label>
              <Input
                value={editingConnection.id || ''}
                onChange={e => setEditingConnection({ ...editingConnection, id: e.target.value })}
                placeholder="如: local, server-1"
                disabled={!!editingConnection.id}
              />
            </div>
            <div>
              <Label>名称</Label>
              <Input
                value={editingConnection.name || ''}
                onChange={e => setEditingConnection({ ...editingConnection, name: e.target.value })}
                placeholder="如: 本地 ComfyUI"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>主机地址</Label>
                <Input
                  value={editingConnection.host || ''}
                  onChange={e => setEditingConnection({ ...editingConnection, host: e.target.value })}
                  placeholder="127.0.0.1"
                />
              </div>
              <div>
                <Label>端口</Label>
                <Input
                  type="number"
                  value={editingConnection.port || 8188}
                  onChange={e => setEditingConnection({ ...editingConnection, port: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>认证 Token (可选)</Label>
              <Input
                type="password"
                value={editingConnection.authToken || ''}
                onChange={e => setEditingConnection({ ...editingConnection, authToken: e.target.value })}
                placeholder="如有 Token 请输入"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingConnection.enabled ?? true}
                  onChange={e => setEditingConnection({ ...editingConnection, enabled: e.target.checked })}
                />
                <span className="text-sm">启用</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingConnection.isDefault ?? false}
                  onChange={e => setEditingConnection({ ...editingConnection, isDefault: e.target.checked })}
                />
                <span className="text-sm">设为默认</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingConnection(null)}>取消</Button>
              <Button onClick={() => saveConnection(editingConnection)} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // 渲染工作流编辑弹窗
  const renderWorkflowModal = () => {
    if (!editingWorkflow) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-[900px] max-h-[90vh] overflow-auto">
          <CardHeader>
            <CardTitle>{editingWorkflow.id ? '编辑工作流' : '新建工作流'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>工作流 ID</Label>
                <Input
                  value={editingWorkflow.id || ''}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, id: e.target.value })}
                  placeholder="如: text2img-turbo"
                  disabled={!!editingWorkflow.id}
                />
              </div>
              <div>
                <Label>所属功能</Label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]"
                  value={editingWorkflow.featureId}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, featureId: e.target.value })}
                >
                  {FEATURES.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <Label>描述</Label>
              <Input
                value={editingWorkflow.description || ''}
                onChange={e => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                placeholder="工作流描述"
              />
            </div>
            
            <div>
              <Label>关联连接</Label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]"
                value={editingWorkflow.connectionId || ''}
                onChange={e => setEditingWorkflow({ ...editingWorkflow, connectionId: e.target.value })}
              >
                <option value="">请选择连接</option>
                {connections.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.host})</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>工作流 JSON</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = async (e: any) => {
                      const file = e.target.files[0];
                      if (file) {
                        const text = await file.text();
                        setWorkflowJsonText(text);
                        try {
                          const json = JSON.parse(text);
                          const res = await fetch('/api/admin/comfyui/workflows/parse', {
                            credentials: 'include',
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
                            body: JSON.stringify({ workflow_json: json }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setParseResult(data.data);
                          }
                        } catch (err) {
                          toast.error('JSON 解析失败');
                        }
                      }
                    };
                    input.click();
                  }}>
                    <Upload className="w-4 h-4 mr-1" /> 导入
                  </Button>
                  <Button size="sm" variant="outline" onClick={parseWorkflow}>
                    <Code className="w-4 h-4 mr-1" /> 解析
                  </Button>
                </div>
              </div>
              <Textarea
                value={workflowJsonText}
                onChange={e => setWorkflowJsonText(e.target.value)}
                placeholder="粘贴 ComfyUI 导出的工作流 JSON..."
                className="font-mono text-sm h-48"
              />
            </div>

            {parseResult && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">解析结果</h4>
                
                <div className="mb-3">
                  <span className="text-sm text-muted-foreground">
                    检测到 {parseResult.nodes.length} 个节点
                  </span>
                </div>

                {parseResult.warnings.length > 0 && (
                  <div className="mb-3 p-2 bg-yellow-50 rounded text-sm">
                    {parseResult.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
                  </div>
                )}

                <div className="mb-3">
                  <Label className="text-sm">建议的节点映射:</Label>
                  <div className="mt-2 space-y-2">
                    {Object.entries(parseResult.suggestedMappings).map(([key, mapping]: [string, any]) => (
                      <div key={key} className="flex items-center gap-4 text-sm">
                        <span className="w-32 font-medium">{key}</span>
                        <span className="text-muted-foreground">
                          → 节点 {mapping.nodeId} / {mapping.field}
                        </span>
                        {mapping.required && <Badge variant="destructive">必填</Badge>}
                      </div>
                    ))}
                  </div>
                </div>

                {parseResult.fixedNodes.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    固定节点（不暴露）: {parseResult.fixedNodes.join(', ')}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingWorkflow.enabled ?? false}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, enabled: e.target.checked })}
                />
                <span className="text-sm">启用</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingWorkflow.isDefault ?? false}
                  onChange={e => setEditingWorkflow({ ...editingWorkflow, isDefault: e.target.checked })}
                />
                <span className="text-sm">设为默认</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setEditingWorkflow(null);
                setParseResult(null);
                setWorkflowJsonText('');
              }}>取消</Button>
              <Button
                onClick={() => {
                  // 构建工作流数据
                  const wf = {
                    ...editingWorkflow,
                    workflowJson: workflowJsonText ? JSON.parse(workflowJsonText) : null,
                    nodeMapping: parseResult?.suggestedMappings || {},
                  };
                  saveWorkflow(wf);
                }}
                disabled={saving || !workflowJsonText}
              >
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return <div className="p-8 text-center">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 标签页 */}
      <div className="flex gap-2 border-b pb-2">
        <button
          className={`px-4 py-2 rounded-t-lg ${activeTab === 'connections' ? 'bg-[var(--bg-card)] font-medium' : ''}`}
          onClick={() => setActiveTab('connections')}
        >
          <Server className="w-4 h-4 inline mr-1" /> 连接管理
        </button>
        <button
          className={`px-4 py-2 rounded-t-lg ${activeTab === 'workflows' ? 'bg-[var(--bg-card)] font-medium' : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          <Workflow className="w-4 h-4 inline mr-1" /> 工作流配置
        </button>
      </div>

      {/* 内容 */}
      {activeTab === 'connections' ? renderConnections() : renderWorkflows()}

      {/* 弹窗 */}
      {renderConnectionModal()}
      {renderWorkflowModal()}
    </div>
  );
}
