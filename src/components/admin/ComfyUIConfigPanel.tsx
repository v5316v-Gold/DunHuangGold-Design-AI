'use client';
import { toast } from 'sonner';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { CheckCircle, XCircle, RefreshCw, Save, Wrench, Play } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */


interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
  status: 'configured' | 'pending' | 'error';
  workflowId: string;
  nodeMapping?: any;
}

interface ComfyUIStatus {
  connected: boolean;
  systemInfo?: any;
  queueStatus?: { queueRunning: number; queuePending: number };
}

// 工作流列表
const WORKFLOWS: WorkflowInfo[] = [
  { id: 'text2img', name: '文生图', description: '文本生成图片', status: 'pending', workflowId: '' },
  { id: 'refine', name: '图片精修', description: 'Img2Img 风格转换', status: 'pending', workflowId: '' },
  { id: 'removebg', name: '背景移除', description: '移除图片背景', status: 'pending', workflowId: '' },
  { id: 'upscale', name: '图片放大', description: '超分辨率放大', status: 'pending', workflowId: '' },
  { id: 'watermark', name: '去除水印', description: 'AI 去水印', status: 'pending', workflowId: '' },
  { id: 'sketch', name: '素描转真实', description: '素描图转真实照片', status: 'pending', workflowId: '' },
  { id: 'relief', name: '浮雕效果', description: '敦煌风格浮雕', status: 'pending', workflowId: '' },
  { id: 'blend', name: '多图融合', description: '多图混合', status: 'pending', workflowId: '' },
];

export default function ComfyUIConfigPanel() {
  const [status, setStatus] = useState<ComfyUIStatus>({ connected: false });
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>(WORKFLOWS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempWorkflowId, setTempWorkflowId] = useState('');
  const [testing, setTesting] = useState<string | null>(null);

  // 检查 ComfyUI 连接状态
  const checkConnection = async () => {
    try {
      const res = await fetch('/api/comfyui', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health' }),
      });
      const data = await res.json();
      
      if (data.success && data.data) {
        // 获取更多信息
        const [sysRes, queueRes] = await Promise.all([
          fetch('/api/comfyui', {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'systemInfo' }),
          }),
          fetch('/api/comfyui', {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'queueStatus' }),
          }),
        ]);
        
        const sysData = await sysRes.json();
        const queueData = await queueRes.json();
        
        setStatus({
          connected: true,
          systemInfo: sysData.data,
          queueStatus: queueData.data,
        });
      } else {
        setStatus({ connected: false });
      }
    } catch {
      setStatus({ connected: false });
    }
  };

  // 加载工作流配置
  const loadWorkflows = async () => {
    try {
      const res = await fetch('/api/comfyui', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listConfigured' }),
      });
      const data = await res.json();
      const configured = data.data || [];
      
      const updated = WORKFLOWS.map(w => ({
        ...w,
        status: configured.includes(w.id) ? 'configured' as const : 'pending' as const,
      }));
      setWorkflows(updated);
    } catch (e) {
      console.error('加载工作流配置失败', e);
    }
  };

  useEffect(() => {
    checkConnection();
    loadWorkflows();
  }, []);

  // 保存工作流 ID
  const saveWorkflowId = (id: string) => {
    const updated: WorkflowInfo[] = workflows.map(w => 
      w.id === id ? { ...w, workflowId: tempWorkflowId, status: (tempWorkflowId ? 'configured' : 'pending') as WorkflowInfo['status'] } : w
    );
    setWorkflows(updated);
    setEditingId(null);
    setTempWorkflowId('');
    
    // TODO: 调用 API 保存到配置文件或数据库
    // 这里老祖需要手动在 comfyui-workflows.ts 中填入
    toast(`功能 "${id}" 的工作流 ID 已记录：${tempWorkflowId}\n\n请手动在 src/config/comfyui-workflows.ts 中填入此 ID`);
  };

  // 测试工作流
  const testWorkflow = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch('/api/comfyui', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: id,
          params: { prompt: 'test prompt' },
        }),
      });
      const data = await res.json();
      
      if (data.success && data.images?.length > 0) {
        toast(`✅ ${id} 测试成功！\n生成的图片: ${data.images.length} 张`);
      } else {
        toast(`❌ ${id} 测试失败: ${data.error || '未知错误'}`);
      }
    } catch (e: any) {
      toast(`❌ ${id} 测试失败: ${e.message}`);
    }
    setTesting(null);
  };

  return (
    <div className="space-y-6">
      {/* 连接状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            ComfyUI 连接状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {status.connected ? (
              <>
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  已连接
                </Badge>
                {status.queueStatus && (
                  <span className="text-sm text-muted-foreground">
                    队列: {status.queueStatus.queueRunning} 运行中, {status.queueStatus.queuePending} 等待
                  </span>
                )}
              </>
            ) : (
              <Badge variant="destructive">
                <XCircle className="w-4 h-4 mr-1" />
                未连接
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={checkConnection}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 工作流配置列表 */}
      <Card>
        <CardHeader>
          <CardTitle>工作流配置</CardTitle>
          <CardDescription>
            在 ComfyUI 中验证工作流后，将 workflow ID 填入下方
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{workflow.name}</h4>
                    <Badge variant={workflow.status === 'configured' ? 'default' : 'secondary'}>
                      {workflow.status === 'configured' ? '已配置' : '待配置'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{workflow.description}</p>
                  {workflow.workflowId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Workflow ID: {workflow.workflowId}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {editingId === workflow.id ? (
                    <>
                      <Input
                        placeholder="填入 workflow ID"
                        value={tempWorkflowId}
                        onChange={(e) => setTempWorkflowId(e.target.value)}
                        data-testid={`workflow-id-input-${workflow.id}`}
                        className="w-48"
                      />
                      <Button size="sm" onClick={() => saveWorkflowId(workflow.id)} data-testid={`workflow-id-save-${workflow.id}`}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        取消
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        data-testid={`workflow-id-config-${workflow.id}`}
                        onClick={() => {
                          setEditingId(workflow.id);
                          setTempWorkflowId(workflow.workflowId);
                        }}
                      >
                        配置
                      </Button>
                      {workflow.status === 'configured' && (
                        <Button 
                          size="sm" 
                          variant="default"
                          disabled={testing === workflow.id}
                          onClick={() => testWorkflow(workflow.id)}
                        >
                          {testing === workflow.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          测试
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>配置步骤</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>在 ComfyUI 中创建并验证工作流</li>
            <li>保存工作流，记录其 Prompt ID 或 workflow JSON</li>
            <li>在上方表格中点击{`"配置"`}，填入工作流 ID</li>
            <li>点击{`"测试"`}验证功能是否正常</li>
            <li>确认无误后即可在前端使用</li>
          </ol>
          
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">提示：</p>
            <p className="text-xs text-muted-foreground mt-1">
              如果工作流需要特殊的节点映射（如自定义的输入输出节点），
              需要同时修改 <code>src/config/comfyui-workflows.ts</code> 中的 nodeMapping 配置。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
