'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';

type TabType = 'baidu' | 'zhipu' | 'xflow' | 'ollama';

interface TabConfig {
  key: TabType;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { key: 'baidu', label: '百度翻译', icon: '🌐' },
  { key: 'zhipu', label: '智谱', icon: '✨' },
  { key: 'xflow', label: 'xFlow-API聚合', icon: '🔗' },
  { key: 'ollama', label: 'Ollama', icon: '🔧' },
];

interface ApiManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Toggle组件
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return enabled ? (
    <button onClick={() => onChange(false)} className="w-11 h-6 bg-[var(--gold)] rounded-full flex items-center justify-end px-0.5">
      <div className="w-4 h-4 bg-white rounded-full" />
    </button>
  ) : (
    <button onClick={() => onChange(true)} className="w-11 h-6 bg-[var(--bg-tertiary)] rounded-full flex items-center px-0.5">
      <div className="w-4 h-4 bg-[var(--text-muted)] rounded-full" />
    </button>
  );
}

// 设置行组件
function SettingRow({ label, children, description }: { label: string; children: React.ReactNode; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1">
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
      </div>
      <div className="ml-4">{children}</div>
    </div>
  );
}

export default function ApiManagerModal({ isOpen, onClose }: ApiManagerModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('baidu');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // 百度翻译配置
  const [baiduConfig, setBaiduConfig] = useState({
    appId: '',
    secretKey: '',
    enabled: false,
  });

  // 智谱配置
  const [zhipuConfig, setZhipuConfig] = useState({
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    disableThoughtChain: false,
    enableAdvancedParams: false,
    filterThoughtOutput: false,
    translateModel: 'glm-4-flash',
    optimizeModel: 'glm-4-flash',
    enabled: false,
  });

  // xFlow-API聚合配置
  const [xflowConfig, setXflowConfig] = useState({
    apiKey: '',
    baseUrl: 'https://api.xflow.cc/v1',
    closeThoughtChain: true,
    filterThoughtOutput: true,
    llmModel: 'gemini-3-flash-preview-nothinking',
    vlmModel: 'grok-4-1-fast-non-reasoning',
    enabled: false,
  });

  // Ollama配置
  const [ollamaConfig, setOllamaConfig] = useState({
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    translateModel: 'glm-4.7-flash:latest',
    optimizeModel: 'glm-4.7-flash:latest',
    vlmModel: 'qwen3-vl:30b',
    enabled: false,
  });

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dunhuang_token') : null;

      // 加载 baidu 配置（来自 api-config 路由）
      const res = await fetch('/api/admin/api-config?action=list', {
        credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success && data.data) {
        data.data.forEach((config: any) => {
          if (config.id === 'baidu-translate') {
            setBaiduConfig({
              appId: config.appId || '',
              secretKey: config.apiKey || '',
              enabled: config.enabled || false,
            });
          }
        });
      }

      // 加载 AI 助手配置（zhipu/xflow/ollama）来自 ai-assistant-config 路由
      // 如果刚保存过（justSaved=true），跳过 reload，用内存中的值（避免 GET 不返回 apiKey 导致覆盖）
      if (!justSaved) {
        const aiRes = await fetch('/api/admin/ai-assistant-config', {
          credentials: 'include',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const aiData = await aiRes.json();
      if (aiData.success && aiData.data) {
        const cfg = aiData.data;
        if (cfg.provider === 'zhipu') {
          setZhipuConfig({
            apiKey: cfg.apiKey || '',
            baseUrl: cfg.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
            disableThoughtChain: cfg.disableThoughtChain || false,
            enableAdvancedParams: cfg.enableAdvancedParams || false,
            filterThoughtOutput: cfg.filterThoughtOutput || false,
            translateModel: cfg.translateModel || 'glm-4-flash',
            optimizeModel: cfg.optimizeModel || 'glm-4-flash',
            enabled: cfg.enabled || false,
          });
        } else if (cfg.provider === 'xflow') {
          setXflowConfig({
            apiKey: cfg.apiKey || '',
            baseUrl: cfg.baseUrl || 'https://api.xflow.cc/v1',
            closeThoughtChain: cfg.closeThoughtChain || false,
            filterThoughtOutput: cfg.filterThoughtOutput || false,
            llmModel: cfg.llmModel || 'gemini-3-flash-preview-nothinking',
            vlmModel: cfg.vlmModel || 'grok-4-1-fast-non-reasoning',
            enabled: cfg.enabled || false,
          });
        } else if (cfg.provider === 'ollama') {
          setOllamaConfig({
            baseUrl: cfg.baseUrl || 'http://localhost:11434/v1',
            apiKey: cfg.apiKey || '',
            translateModel: cfg.translateModel || 'glm-4.7-flash:latest',
            optimizeModel: cfg.optimizeModel || 'glm-4.7-flash:latest',
            vlmModel: cfg.vlmModel || 'qwen3-vl:30b',
            enabled: cfg.enabled || false,
          });
        }
      }
      } // end if (!justSaved)
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setLoading(false);
      setJustSaved(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const saveConfig = async (id: string, config: Record<string, unknown>) => {
    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dunhuang_token') : null;

      // AI助手配置（zhipu/xflow/ollama）→ ai-assistant-config 路由
      // 其他配置（baidu）→ api-config 路由
      const isAIAssistant = ['zhipu', 'xflow', 'ollama'].includes(id);
      const apiUrl = isAIAssistant ? '/api/admin/ai-assistant-config' : '/api/admin/api-config';

      const bodyData = isAIAssistant ? (() => {
        // 映射 Zhipu/Xflow/Ollama 字段到 AI assistant 路由期望的格式
        if (id === 'zhipu') {
          return { apiKey: config.apiKey, provider: 'zhipu', model: config.translateModel || config.optimizeModel, optimizeModel: config.optimizeModel };
        } else if (id === 'xflow') {
          return { apiKey: config.apiKey, provider: 'xflow', model: config.llmModel, optimizeModel: config.llmModel };
        } else if (id === 'ollama') {
          return { apiKey: config.apiKey, provider: 'ollama', model: config.translateModel || config.optimizeModel, optimizeModel: config.optimizeModel, baseUrl: config.baseUrl };
        }
        return config;
      })() : { id, name: id, ...config, action: 'create' };

      const res = await fetch(apiUrl, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (data.success) {
        setJustSaved(true);
        toast.error('保存成功！');
      } else {
        toast.error('保存失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      toast.error('保存失败: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (activeTab === 'baidu') {
      await saveConfig('baidu-translate', {
        provider: 'baidu',
        apiKey: baiduConfig.secretKey,
        appId: baiduConfig.appId,
        enabled: baiduConfig.enabled,
      });
    } else if (activeTab === 'zhipu') {
      await saveConfig('zhipu', {
        provider: 'zhipu',
        apiKey: zhipuConfig.apiKey,
        url: zhipuConfig.baseUrl,
        disableThoughtChain: zhipuConfig.disableThoughtChain,
        enableAdvancedParams: zhipuConfig.enableAdvancedParams,
        filterThoughtOutput: zhipuConfig.filterThoughtOutput,
        translateModel: zhipuConfig.translateModel,
        optimizeModel: zhipuConfig.optimizeModel,
        enabled: zhipuConfig.enabled,
      });
    } else if (activeTab === 'xflow') {
      await saveConfig('xflow', {
        provider: 'xflow',
        apiKey: xflowConfig.apiKey,
        url: xflowConfig.baseUrl,
        closeThoughtChain: xflowConfig.closeThoughtChain,
        filterThoughtOutput: xflowConfig.filterThoughtOutput,
        llmModel: xflowConfig.llmModel,
        vlmModel: xflowConfig.vlmModel,
        enabled: xflowConfig.enabled,
      });
    } else if (activeTab === 'ollama') {
      await saveConfig('ollama', {
        provider: 'ollama',
        url: ollamaConfig.baseUrl,
        apiKey: ollamaConfig.apiKey,
        translateModel: ollamaConfig.translateModel,
        optimizeModel: ollamaConfig.optimizeModel,
        vlmModel: ollamaConfig.vlmModel,
        enabled: ollamaConfig.enabled,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] w-[700px] h-[700px] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">助手API管理</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-card)] rounded-lg">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Tab切换 */}
        <div className="flex border-b border-[var(--border-color)]">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                activeTab === tab.key
                  ? 'text-[var(--gold)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--gold)]" />
              )}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="h-[calc(100%-120px)] overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-[var(--gold)] animate-spin" />
            </div>
          ) : (
            <>
              {/* 百度翻译 */}
              {activeTab === 'baidu' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">百度翻译配置</h3>
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1 mt-3">AppID</label>
                      <input
                        type="text"
                        value={baiduConfig.appId}
                        onChange={(e) => setBaiduConfig({ ...baiduConfig, appId: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        placeholder="输入百度翻译 AppID"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1 mt-3">Secret Key</label>
                      <input
                        type="password"
                        value={baiduConfig.secretKey}
                        onChange={(e) => setBaiduConfig({ ...baiduConfig, secretKey: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        placeholder="输入 Secret Key"
                      />
                    </div>
                    <div className="py-3 border-t border-[var(--border-color)] mt-3">
                      <button
                        onClick={() => setBaiduConfig({ ...baiduConfig, enabled: !baiduConfig.enabled })}
                        className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          baiduConfig.enabled
                            ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                            : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
                        }`}
                      >
                        {baiduConfig.enabled ? '✅ 已激活百度翻译服务' : '点击激活百度翻译服务'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 智谱 */}
              {activeTab === 'zhipu' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">智谱配置</h3>
                  
                  {/* API设置 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1 mt-3">Base URL</label>
                      <input
                        type="text"
                        value={zhipuConfig.baseUrl}
                        onChange={(e) => setZhipuConfig({ ...zhipuConfig, baseUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        placeholder="https://open.bigmodel.cn/api/paas/v4"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1 mt-3">API Key</label>
                      <input
                        type="password"
                        value={zhipuConfig.apiKey}
                        onChange={(e) => setZhipuConfig({ ...zhipuConfig, apiKey: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        placeholder="输入智谱 API Key"
                      />
                    </div>
                  </div>

                  {/* 高级设置 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <h4 className="text-xs font-medium text-[var(--text-muted)] mt-3 mb-2">高级设置</h4>
                    <div className="border-t border-[var(--border-color)]">
                      <SettingRow label="禁用思考链">
                        <Toggle enabled={zhipuConfig.disableThoughtChain} onChange={(v) => setZhipuConfig({ ...zhipuConfig, disableThoughtChain: v })} />
                      </SettingRow>
                      <div className="border-t border-[var(--border-color)]" />
                      <SettingRow label="开启高级参数">
                        <Toggle enabled={zhipuConfig.enableAdvancedParams} onChange={(v) => setZhipuConfig({ ...zhipuConfig, enableAdvancedParams: v })} />
                      </SettingRow>
                      <div className="border-t border-[var(--border-color)]" />
                      <SettingRow label="过滤思考链输出">
                        <Toggle enabled={zhipuConfig.filterThoughtOutput} onChange={(v) => setZhipuConfig({ ...zhipuConfig, filterThoughtOutput: v })} />
                      </SettingRow>
                    </div>
                  </div>

                  {/* 第二步：大模型选择 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <h4 className="text-xs font-medium text-[var(--text-muted)] mt-3 mb-2">第二步：大模型选择</h4>
                    <div className="border-t border-[var(--border-color)]">
                      <div className="py-3">
                        <label className="block text-xs text-[var(--text-muted)] mb-1">翻译</label>
                        <select
                          value={zhipuConfig.translateModel}
                          onChange={(e) => setZhipuConfig({ ...zhipuConfig, translateModel: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        >
                          <option value="glm-4-flash">glm-4-flash</option>
                          <option value="glm-4">glm-4</option>
                          <option value="glm-4-plus">glm-4-plus</option>
                        </select>
                      </div>
                      <div className="border-t border-[var(--border-color)]" />
                      <div className="py-3">
                        <label className="block text-xs text-[var(--text-muted)] mb-1">提示词优化</label>
                        <select
                          value={zhipuConfig.optimizeModel}
                          onChange={(e) => setZhipuConfig({ ...zhipuConfig, optimizeModel: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        >
                          <option value="glm-4-flash">glm-4-flash</option>
                          <option value="glm-4">glm-4</option>
                          <option value="glm-4-plus">glm-4-plus</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 激活按钮 */}
                  <div className="pt-2">
                    <button
                      onClick={() => setZhipuConfig({ ...zhipuConfig, enabled: !zhipuConfig.enabled })}
                      className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        zhipuConfig.enabled
                          ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                          : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
                      }`}
                    >
                      {zhipuConfig.enabled ? '✅ 已激活智谱服务' : '点击激活智谱服务'}
                    </button>
                  </div>
                </div>
              )}

              {/* xFlow-API聚合 */}
              {activeTab === 'xflow' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">xFlow-API聚合配置</h3>
                  
                  {/* API设置 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1 mt-3">Base URL</label>
                      <input
                        type="text"
                        value={xflowConfig.baseUrl}
                        onChange={(e) => setXflowConfig({ ...xflowConfig, baseUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        placeholder="https://api.xflow.cc/v1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1 mt-3">API Key</label>
                      <input
                        type="password"
                        value={xflowConfig.apiKey}
                        onChange={(e) => setXflowConfig({ ...xflowConfig, apiKey: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        placeholder="输入 API Key"
                      />
                    </div>
                  </div>

                  {/* 高级设置 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <h4 className="text-xs font-medium text-[var(--text-muted)] mt-3 mb-2">高级设置</h4>
                    <div className="border-t border-[var(--border-color)]">
                      <SettingRow label="关闭思考链">
                        <Toggle enabled={xflowConfig.closeThoughtChain} onChange={(v) => setXflowConfig({ ...xflowConfig, closeThoughtChain: v })} />
                      </SettingRow>
                      <div className="border-t border-[var(--border-color)]" />
                      <SettingRow label="过滤思考链输出">
                        <Toggle enabled={xflowConfig.filterThoughtOutput} onChange={(v) => setXflowConfig({ ...xflowConfig, filterThoughtOutput: v })} />
                      </SettingRow>
                    </div>
                  </div>

                  {/* 模型选择 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <h4 className="text-xs font-medium text-[var(--text-muted)] mt-3 mb-2">模型选择</h4>
                    <div className="border-t border-[var(--border-color)]">
                      <div className="py-3">
                        <label className="block text-xs text-[var(--text-muted)] mb-1">LLM（大语言模型）</label>
                        <select
                          value={xflowConfig.llmModel}
                          onChange={(e) => setXflowConfig({ ...xflowConfig, llmModel: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        >
                          <option value="gemini-3-flash-preview-nothinking">gemini-3-flash-preview-nothinking</option>
                          <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                          <option value="grok-4-1-fast-non-reasoning">grok-4-1-fast-non-reasoning</option>
                        </select>
                      </div>
                      <div className="border-t border-[var(--border-color)]" />
                      <div className="py-3">
                        <label className="block text-xs text-[var(--text-muted)] mb-1">VLM（视觉语言模型）</label>
                        <select
                          value={xflowConfig.vlmModel}
                          onChange={(e) => setXflowConfig({ ...xflowConfig, vlmModel: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        >
                          <option value="grok-4-1-fast-non-reasoning">grok-4-1-fast-non-reasoning</option>
                          <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                          <option value="grok-2">grok-2</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 激活按钮 */}
                  <div className="pt-2">
                    <button
                      onClick={() => setXflowConfig({ ...xflowConfig, enabled: !xflowConfig.enabled })}
                      className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        xflowConfig.enabled
                          ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                          : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
                      }`}
                    >
                      {xflowConfig.enabled ? '✅ 已激活xFlow服务' : '点击激活xFlow服务'}
                    </button>
                  </div>
                </div>
              )}

              {/* Ollama */}
              {activeTab === 'ollama' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Ollama配置</h3>
                  
                  {/* API设置 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1 mt-3">Base URL</label>
                      <input
                        type="text"
                        value={ollamaConfig.baseUrl}
                        onChange={(e) => setOllamaConfig({ ...ollamaConfig, baseUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        placeholder="http://localhost:11434/v1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1 mt-3">API Key <span className="text-[var(--text-muted)]">（可选）</span></label>
                      <input
                        type="password"
                        value={ollamaConfig.apiKey}
                        onChange={(e) => setOllamaConfig({ ...ollamaConfig, apiKey: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                        placeholder="输入 API Key（可选）"
                      />
                    </div>
                  </div>

                  {/* 第二步：LLM选择 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <h4 className="text-xs font-medium text-[var(--text-muted)] mt-3 mb-2">第二步：大模型选择</h4>
                    <div className="border-t border-[var(--border-color)]">
                      <div className="py-3">
                        <label className="block text-xs text-[var(--text-muted)] mb-1">翻译</label>
                        <input
                          type="text"
                          value={ollamaConfig.translateModel}
                          onChange={(e) => setOllamaConfig({ ...ollamaConfig, translateModel: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                          placeholder="glm-4.7-flash:latest"
                        />
                      </div>
                      <div className="border-t border-[var(--border-color)]" />
                      <div className="py-3">
                        <label className="block text-xs text-[var(--text-muted)] mb-1">提示词优化</label>
                        <input
                          type="text"
                          value={ollamaConfig.optimizeModel}
                          onChange={(e) => setOllamaConfig({ ...ollamaConfig, optimizeModel: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                          placeholder="glm-4.7-flash:latest"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 第三步：VLM选择 */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] px-4">
                    <h4 className="text-xs font-medium text-[var(--text-muted)] mt-3 mb-2">第三步：VLM选择</h4>
                    <div className="border-t border-[var(--border-color)]">
                      <div className="py-3">
                        <label className="block text-xs text-[var(--text-muted)] mb-1">图像视频分析和多模态任务</label>
                        <input
                          type="text"
                          value={ollamaConfig.vlmModel}
                          onChange={(e) => setOllamaConfig({ ...ollamaConfig, vlmModel: e.target.value })}
                          className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
                          placeholder="qwen3-vl:30b"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 激活按钮 */}
                  <div className="pt-2">
                    <button
                      onClick={() => setOllamaConfig({ ...ollamaConfig, enabled: !ollamaConfig.enabled })}
                      className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        ollamaConfig.enabled
                          ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                          : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
                      }`}
                    >
                      {ollamaConfig.enabled ? '✅ 已激活Ollama服务' : '点击激活Ollama服务'}
                    </button>
                  </div>
                </div>
              )}

            </>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-color)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] transition-all flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
