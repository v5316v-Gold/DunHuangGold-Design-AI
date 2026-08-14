'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  Settings, Save, Play, RefreshCw, Check, X, ChevronDown, ChevronUp,
  Code, Eye, Download, Upload, AlertCircle, CheckCircle, Loader2
} from 'lucide-react';
import { getAuthHeader } from '@/hooks/useAuth';

/* eslint-disable @typescript-eslint/no-explicit-any */


// 功能列表
const FEATURES = [
  // 图片生成类
  { id: 'text2img', name: '文案生图', category: '图片生成', icon: '🖼️' },
  { id: 'product-refine', name: '产品精修', category: '图片生成', icon: '✨' },
  { id: 'multi-image', name: '多图融合', category: '图片生成', icon: '🎨' },
  { id: 'one-click-design', name: '一键设计', category: '图片生成', icon: '⚡' },
  { id: 'multi-view', name: '生成多视图', category: '图片生成', icon: '📦' },
  { id: 'sketch-realistic', name: '线稿/写实', category: '图片生成', icon: '✏️' },
  { id: 'free-creation', name: '自由创作区', category: '图片生成', icon: '🎨' },
  { id: 'remove-background', name: '移除背景', category: '图片生成', icon: '✂️' },
  { id: 'upscale', name: '高清放大', category: '图片生成', icon: '📐' },
  { id: 'remove-watermark', name: '去除水印', category: '图片生成', icon: '🧹' },
  // 3D类
  { id: 'relief', name: '浮雕图生成', category: '3D类', icon: '🏔️' },
  { id: 'image-3d', name: '3D模型生成', category: '3D类', icon: '🎲' },
  { id: 'stereo', name: '图像转立体', category: '3D类', icon: '👁️' },
  // 视频类
  { id: 'text2video', name: '文生视频', category: '视频类', icon: '🎬' },
  { id: 'image2video', name: '图生视频', category: '视频类', icon: '🎥' },
  // 特殊类
  { id: 'tryon', name: '佩戴效果', category: '特殊', icon: '💍' },
];

// 节点类型
const NODE_TYPES = [
  { key: 'prompt', label: '正向提示词', required: true },
  { key: 'negativePrompt', label: '负向提示词', required: false },
  { key: 'inputImage', label: '输入图片', required: false },
  { key: 'width', label: '宽度', required: false },
  { key: 'height', label: '高度', required: false },
  { key: 'model', label: '模型', required: false },
  { key: 'seed', label: '种子', required: false },
  { key: 'steps', label: '步数', required: false },
  { key: 'cfg', label: 'CFG', required: false },
  { key: 'sampler', label: '采样器', required: false },
  { key: 'denoise', label: '去噪强度', required: false },
  { key: 'outputImage', label: '输出图片', required: true },
];

// Section 组件（模块级别，避免每次渲染重新创建）
interface SectionProps {
  id: string;
  title: string;
  expandedSection: string | null;
  setExpandedSection: (id: string | null) => void;
  children: React.ReactNode;
}

function Section({ id, title, expandedSection, setExpandedSection, children }: SectionProps) {
  return (
    <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
        className="w-full px-4 py-3 bg-[var(--bg-secondary)] flex items-center justify-between hover:bg-[var(--bg-hover)] transition-all"
      >
        <span className="font-medium text-sm text-[var(--text-primary)]">{title}</span>
        {expandedSection === id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expandedSection === id && (
        <div className="p-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

interface WorkflowConfig {
  id: string;
  featureId: string;
  workflowJson: Record<string, any>;
  nodeMapping: Record<string, string>;
  defaultParams: Record<string, any>;
  fixedParams: Record<string, any>;
  connectionId: string;
  enabled: boolean;
  description?: string;
}

interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
}

export default function ComfyUIWorkflowConfig() {
  const [selectedFeature, setSelectedFeature] = useState(FEATURES[0]);
  const [configs, setConfigs] = useState<Record<string, WorkflowConfig>>({});
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; images?: string[]; error?: string } | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('nodeMapping');

  // 当前编辑的配置
  const [config, setConfig] = useState<Partial<WorkflowConfig>>({
    featureId: FEATURES[0].id,
    workflowJson: {},
    nodeMapping: {},
    defaultParams: {},
    fixedParams: {},
    connectionId: '',
    enabled: false,
  });

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 加载工作流配置
      const [configRes, connRes] = await Promise.all([
        fetch('/api/settings/comfyui', { credentials: 'include', headers: { ...getAuthHeader() } }),
        fetch('/api/admin/comfyui/connections', { credentials: 'include', headers: { ...getAuthHeader() } }),
      ]);
      
      const configData = await configRes.json();
      const connData = await connRes.json();

      if (configData.success) {
        setConfigs(configData.data || {});
      }
      
      if (connData.success) {
        setConnections(connData.data || []);
      }
    } catch (e) {
      console.error('加载数据失败:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Use deferred callback to avoid synchronous setState in effect
    const timer = setTimeout(() => { loadData(); }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // 切换功能时加载配置
  useEffect(() => {
    const featureConfig = configs[selectedFeature.id];
    const timer = setTimeout(() => {
      if (featureConfig) {
        setConfig(featureConfig);
      } else {
        setConfig({
          featureId: selectedFeature.id,
          workflowJson: {},
          nodeMapping: {},
          defaultParams: {},
          fixedParams: {},
          connectionId: '',
          enabled: false,
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedFeature, configs]);

  // 保存配置
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/comfyui', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          featureId: selectedFeature.id,
          workflowId: selectedFeature.id,
          nodeMapping: config.nodeMapping || {},
          defaultParams: config.defaultParams || {},
          fixedParams: config.fixedParams || {},
          connectionId: config.connectionId || '',
          enabled: config.enabled ?? false,
          description: config.description || '',
          workflowJson: config.workflowJson || {},
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('配置已保存');
        await loadData();
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (e) {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 测试执行
  const handleTest = async () => {
    if (!config.workflowJson || Object.keys(config.workflowJson).length === 0) {
      toast.error('请先填写工作流 JSON');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/comfyui/call', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          featureId: selectedFeature.id,
          prompt: 'a beautiful sunset over mountains, high quality, 8k',
        }),
      });
      const data = await res.json();
      setTestResult(data);
      
      if (data.success) {
        toast.success('测试成功！');
      } else {
        toast.error(data.error || '测试失败');
      }
    } catch (e) {
      setTestResult({ success: false, error: '请求失败' });
      toast.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  // 解析工作流 JSON
  const parseWorkflow = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      setConfig(p => ({ ...p, workflowJson: parsed }));
      
      // 自动提取节点 ID
      const nodeIds = Object.keys(parsed);
      const suggestedMapping: Record<string, string> = {};
      
      // 简单的自动映射建议
      for (const nodeId of nodeIds) {
        const node = parsed[nodeId];
        if (!node || !node.class_type) continue;
        
        const classType = node.class_type.toLowerCase();
        
        if (classType.includes('cliptextencode') || classType.includes('text')) {
          if (!suggestedMapping.prompt && node.inputs?.text) {
            suggestedMapping.prompt = nodeId;
          } else if (!suggestedMapping.negativePrompt) {
            suggestedMapping.negativePrompt = nodeId;
          }
        }
        if (classType.includes('saveimage') || classType.includes('preview')) {
          if (!suggestedMapping.outputImage) {
            suggestedMapping.outputImage = nodeId;
          }
        }
        if (classType.includes('loadimage')) {
          if (!suggestedMapping.inputImage) {
            suggestedMapping.inputImage = nodeId;
          }
        }
        if (classType.includes('emptysd') || classType.includes('empty')) {
          if (!suggestedMapping.width) {
            suggestedMapping.width = nodeId;
          }
        }
      }
      
      // 更新节点映射
      if (Object.keys(suggestedMapping).length > 0) {
        setConfig(p => ({ 
          ...p, 
          workflowJson: parsed,
          nodeMapping: { ...p.nodeMapping, ...suggestedMapping }
        }));
        toast.info('已自动识别部分节点，请检查并调整');
      }
      
      return true;
    } catch (e) {
      toast.error('JSON 格式错误');
      return false;
    }
  };

  const updateNodeMapping = (key: string, value: string) => {
    setConfig(p => ({
      ...p,
      nodeMapping: { ...p.nodeMapping, [key]: value },
    }));
  };

  const updateDefaultParam = (key: string, value: any) => {
    setConfig(p => ({
      ...p,
      defaultParams: { ...p.defaultParams, [key]: value },
    }));
  };

  const updateFixedParam = (key: string, value: any) => {
    setConfig(p => ({
      ...p,
      fixedParams: { ...p.fixedParams, [key]: value },
    }));
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
      {/* 功能选择 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--text-muted)]">选择功能:</span>
        <select
          value={selectedFeature.id}
          onChange={e => {
            const feature = FEATURES.find(f => f.id === e.target.value);
            if (feature) setSelectedFeature(feature);
          }}
          className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm flex-1 max-w-xs"
        >
          {FEATURES.map(f => (
            <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
          ))}
        </select>
        <span className="text-xs text-[var(--text-muted)]">
          {selectedFeature.category}
        </span>
      </div>

      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
          <label className="text-xs text-[var(--text-muted)] block mb-2">绑定连接</label>
          <select
            value={config.connectionId || ''}
            onChange={e => setConfig(p => ({ ...p, connectionId: e.target.value }))}
            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
          >
            <option value="">使用默认连接</option>
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.host}:{c.port})</option>
            ))}
          </select>
        </div>
        <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] flex items-center justify-between">
          <div>
            <label className="text-xs text-[var(--text-muted)] block">启用本地执行</label>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              启用后该功能将使用 ComfyUI 执行
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.enabled ?? false}
            onChange={e => setConfig(p => ({ ...p, enabled: e.target.checked }))}
            className="w-5 h-5 rounded accent-[var(--gold)]"
          />
        </div>
      </div>

      {/* 节点映射 */}
      <Section id="nodeMapping" title="🔗 节点映射 (Node Mapping)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          将功能参数映射到 ComfyUI 工作流的节点 ID。从 ComfyUI 导出工作流后，填写对应的节点编号。
        </p>
        <div className="grid grid-cols-2 gap-3">
          {NODE_TYPES.map(node => (
            <div key={node.key} className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-muted)] w-28 flex items-center gap-1">
                {node.label}
                {node.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={config.nodeMapping?.[node.key] || ''}
                onChange={e => updateNodeMapping(node.key, e.target.value)}
                placeholder={node.key === 'outputImage' ? '如: 9' : '节点ID'}
                className="flex-1 px-2 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-sm font-mono"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* 默认参数 */}
      <Section id="defaultParams" title="⚙️ 默认参数 (Default Params)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          工作流的默认参数值，用户可以在前端调整
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)] w-16">宽度</label>
            <input
              type="number"
              value={config.defaultParams?.width || 512}
              onChange={e => updateDefaultParam('width', parseInt(e.target.value) || 512)}
              className="flex-1 px-2 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)] w-16">高度</label>
            <input
              type="number"
              value={config.defaultParams?.height || 512}
              onChange={e => updateDefaultParam('height', parseInt(e.target.value) || 512)}
              className="flex-1 px-2 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)] w-16">步数</label>
            <input
              type="number"
              value={config.defaultParams?.steps || 20}
              onChange={e => updateDefaultParam('steps', parseInt(e.target.value) || 20)}
              className="flex-1 px-2 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)] w-16">CFG</label>
            <input
              type="number"
              step="0.1"
              value={config.defaultParams?.cfg || 7.0}
              onChange={e => updateDefaultParam('cfg', parseFloat(e.target.value) || 7.0)}
              className="flex-1 px-2 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)] w-16">采样器</label>
            <input
              type="text"
              value={config.defaultParams?.sampler || 'euler'}
              onChange={e => updateDefaultParam('sampler', e.target.value)}
              className="flex-1 px-2 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)] w-16">去噪</label>
            <input
              type="number"
              step="0.1"
              value={config.defaultParams?.denoise || 1.0}
              onChange={e => updateDefaultParam('denoise', parseFloat(e.target.value) || 1.0)}
              className="flex-1 px-2 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-sm"
            />
          </div>
        </div>
      </Section>

      {/* 固定参数 */}
      <Section id="fixedParams" title="🔒 固定参数 (Fixed Params)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          固定添加到提示词的内容，如敦煌风格前缀
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">提示词前缀</label>
            <input
              type="text"
              value={config.fixedParams?.promptPrefix || ''}
              onChange={e => updateFixedParam('promptPrefix', e.target.value)}
              placeholder="如: 敦煌风格, 高细节, 8K画质,"
              className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">提示词后缀</label>
            <input
              type="text"
              value={config.fixedParams?.promptSuffix || ''}
              onChange={e => updateFixedParam('promptSuffix', e.target.value)}
              placeholder="如: masterpiece, best quality"
              className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">固定负向提示词</label>
            <input
              type="text"
              value={config.fixedParams?.negativePrompt || ''}
              onChange={e => updateFixedParam('negativePrompt', e.target.value)}
              placeholder="如: low quality, blurry, watermark"
              className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm"
            />
          </div>
        </div>
      </Section>

      {/* 工作流 JSON */}
      <Section id="workflowJson" title="📋 工作流 JSON (Workflow JSON)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          从 ComfyUI 导出的完整工作流 JSON。粘贴后可自动识别部分节点。
        </p>
        <textarea
          value={JSON.stringify(config.workflowJson || {}, null, 2)}
          onChange={e => {
            try {
              const parsed = JSON.parse(e.target.value);
              setConfig(p => ({ ...p, workflowJson: parsed }));
            } catch {
              // 临时显示错误 JSON，让用户修正
              setConfig(p => ({ ...p, workflowJson: e.target.value as any }));
            }
          }}
          placeholder={'{\n  "nodes": {...},\n  "workflow_version": "1.0"\n}'}
          className="w-full h-64 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm font-mono resize-none"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => parseWorkflow(JSON.stringify(config.workflowJson))}
            className="px-3 py-1.5 text-xs bg-[var(--bg-hover)] hover:bg-[var(--bg-card)] rounded-lg flex items-center gap-1.5 transition-all"
          >
            <Code className="w-3 h-3" />
            解析并自动映射
          </button>
        </div>
      </Section>

      {/* 测试结果 */}
      {testResult && (
        <div className={`p-4 rounded-xl border ${
          testResult.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span className={`font-medium ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
              {testResult.success ? '测试成功' : '测试失败'}
            </span>
          </div>
          {testResult.error && (
            <p className="text-xs text-red-400">{testResult.error}</p>
          )}
          {testResult.images && testResult.images.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {testResult.images.map((img, i) => (
                <Image key={i} src={img} alt="" className="w-24 h-24 object-cover rounded border border-[var(--border-color)]" width={96} height={96} unoptimized />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleTest}
          disabled={testing || !config.workflowJson || Object.keys(config.workflowJson || {}).length === 0}
          className="px-4 py-2 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-lg text-sm flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          测试执行
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-[var(--gold)] hover:shadow-lg text-black rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存配置
        </button>
      </div>
    </div>
  );
}
