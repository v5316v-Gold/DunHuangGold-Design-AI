'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Settings, Sparkles, Palette, Monitor, Languages,
  Trash2, Loader2, ChevronDown, ChevronRight, Info,
  Download, Upload, AlertCircle, CheckCircle2, X, Zap
} from 'lucide-react';
import RuleManagerModal from './RuleManagerModal';
import ApiManagerModal from './ApiManagerModal';

/* eslint-disable @typescript-eslint/no-explicit-any */


// ============ 类型定义 ============
interface TranslateSettings {
  preserveNewline: boolean;
  removeRedundantDots: boolean;
  removeExtraSpaces: boolean;
  halfwidthPunctuation: boolean;
  mixedLangRule: string;
  useCache: boolean;
}

interface FeatureSwitches {
  nodeHelpTranslator: boolean;
  imageCaption: boolean;
  translate: boolean;
  expand: boolean;
  tag: boolean;
  history: boolean;
  enabled: boolean;
}

interface InterfaceSettings {
  iconOpacity: number;
  imageCaptionLayout: string;
  promptLayout: string;
}

interface SystemSettings {
  streaming: boolean;
  showStreamingProgress: boolean;
  imageCaptionCreationMode: string;
  promptCreationMode: string;
}

// ============ 服务选项（按功能分离） ============
const IMAGE_CAPTION_SERVICES = [
  { value: 'zhipu', label: '智谱 AI' },
];

const EXPAND_SERVICES = [
  { value: 'zhipu', label: '智谱 AI' },
];

const TRANSLATE_SERVICES = [
  { value: 'baidu', label: '百度翻译' },
  { value: 'zhipu', label: '智谱 AI' },
];

const MIXED_LANG_OPTIONS = [
  { value: 'to_en', label: '译成英文' },
  { value: 'to_zh', label: '译成中文' },
  { value: 'auto_minor', label: '自动翻译小比例语言' },
  { value: 'auto_major', label: '自动翻译大比例语言' },
];

// ============ 工具组件 ============
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

function SettingRow({ label, children, description }: { label: React.ReactNode; children: React.ReactNode; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-[var(--bg-card)]/50 transition-all">
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
      </div>
      <div className="ml-4">{children}</div>
    </div>
  );
}

function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 cursor-help">
      <Info className="w-3 h-3 text-[var(--text-muted)]" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} />
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-xs text-[var(--text-secondary)] whitespace-nowrap z-50 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-t-xl hover:bg-[var(--bg-card)] transition-all"
      >
        <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
          <Icon className="w-4 h-4 text-[var(--gold)]" />
          {title}
        </h3>
        {open ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="bg-[var(--bg-secondary)] border border-t-0 border-[var(--border-color)] rounded-b-xl overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

// Toast 通知
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-bottom ${
      type === 'success'
        ? 'bg-[var(--gold)] text-black border-[var(--gold)]'
        : 'bg-red-500/90 text-white border-red-600'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3 h-3" /></button>
    </div>
  );
}

// AI 诊断弹窗
function DiagnosticModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [results, setResults] = useState<{ name: string; status: 'ok' | 'error' | 'skip'; message: string }[]>([]);
  const [running, setRunning] = useState(false);

  const runDiagnostic = async () => {
    setRunning(true);
    const diagnostics = [
      { name: '百度翻译 API', test: async () => {
        const res = await fetch('/api/admin/app-settings', { credentials: 'include' });
        const data = await res.json();
        return data.success ? 'ok' : 'error';
      }},
      { name: '智谱 AI API', test: async () => {
        const res = await fetch('/api/admin/app-settings', { credentials: 'include' });
        const data = await res.json();
        return data.success ? 'ok' : 'error';
      }},
    ];

    const output: typeof results = [];
    for (const d of diagnostics) {
      try {
        const status = await d.test();
        output.push({ name: d.name, status, message: status === 'ok' ? '连接正常' : '连接失败' });
      } catch {
        output.push({ name: d.name, status: 'error', message: '请求失败' });
      }
    }
    setResults(output);
    setRunning(false);
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">AI 服务诊断</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {results.length === 0 && !running && (
            <p className="text-sm text-[var(--text-muted)] mb-4">点击诊断按钮，检查所有 AI 服务的连接状态。</p>
          )}
          {running && <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="w-4 h-4 animate-spin" /> 正在诊断...</div>}
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              {r.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : r.status === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> : <AlertCircle className="w-4 h-4 text-yellow-500" />}
              <span className="text-sm text-[var(--text-primary)]">{r.name}</span>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{r.message}</span>
            </div>
          ))}
        </div>
        <div className="px-6 pb-4 flex gap-3">
          <button onClick={runDiagnostic} disabled={running} className="flex-1 px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] disabled:opacity-50 flex items-center justify-center gap-2">
            {running && <Loader2 className="w-4 h-4 animate-spin" />}
            {running ? '诊断中...' : '开始诊断'}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg">关闭</button>
        </div>
      </div>
    </div>
  );
}

// ============ 主组件 ============
export default function PromptConfigSection() {
  // 翻译功能设置
  const [translateSettings, setTranslateSettings] = useState<TranslateSettings>({
    preserveNewline: true,
    removeRedundantDots: false,
    removeExtraSpaces: false,
    halfwidthPunctuation: false,
    mixedLangRule: 'to_en',
    useCache: true,
  });

  // 功能开关
  const [featureSwitches, setFeatureSwitches] = useState<FeatureSwitches>({
    nodeHelpTranslator: true,
    imageCaption: true,
    translate: true,
    expand: true,
    tag: true,
    history: true,
    enabled: true,
  });

  // 界面设置
  const [interfaceSettings, setInterfaceSettings] = useState<InterfaceSettings>({
    iconOpacity: 20,
    imageCaptionLayout: 'h',
    promptLayout: 'right-center-v',
  });

  // 系统设置
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    streaming: true,
    showStreamingProgress: false,
    imageCaptionCreationMode: 'auto',
    promptCreationMode: 'auto',
  });

  // 服务选择
  const [selectedServices, setSelectedServices] = useState({
    imageCaption: 'zhipu',
    expand: 'zhipu',
    translate: 'baidu',
  });

  // 弹窗状态
  const [showRuleManager, setShowRuleManager] = useState(false);
  const [showApiManager, setShowApiManager] = useState(false);

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 诊断弹窗
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  // 高级翻译设置折叠
  const [showAdvancedTranslate, setShowAdvancedTranslate] = useState(false);

  // 加载设置
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    const timer = setTimeout(() => { loadSettings(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/app-settings', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        const s = data.data;
        if (s.translate_settings) setTranslateSettings(s.translate_settings);
        if (s.interface_settings) setInterfaceSettings(s.interface_settings);
        if (s.system_settings) setSystemSettings(s.system_settings);
        if (s.feature_switches) setFeatureSwitches(s.feature_switches);
        if (s.selected_services) setSelectedServices(s.selected_services);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存设置
  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/app-settings', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translate_settings: translateSettings,
          interface_settings: interfaceSettings,
          system_settings: systemSettings,
          feature_switches: featureSwitches,
          selected_services: selectedServices,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setHasChanges(false);
        setToast({ message: '设置保存成功', type: 'success' });
      } else {
        setToast({ message: '保存失败：' + (data.error || '未知错误'), type: 'error' });
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      setToast({ message: '保存失败，请检查网络', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // 导出配置
  const exportConfig = () => {
    const config = {
      translate_settings: translateSettings,
      interface_settings: interfaceSettings,
      system_settings: systemSettings,
      feature_switches: featureSwitches,
      selected_services: selectedServices,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assistant-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: '配置已导出', type: 'success' });
  };

  // 导入配置
  const importConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        if (config.translate_settings) setTranslateSettings(config.translate_settings);
        if (config.interface_settings) setInterfaceSettings(config.interface_settings);
        if (config.system_settings) setSystemSettings(config.system_settings);
        if (config.feature_switches) setFeatureSwitches(config.feature_switches);
        if (config.selected_services) setSelectedServices(config.selected_services);
        setHasChanges(true);
        setToast({ message: '配置导入成功，请保存', type: 'success' });
      } catch {
        setToast({ message: '导入失败：文件格式错误', type: 'error' });
      }
    };
    input.click();
  };

  // 清理缓存
  const clearCache = async () => {
    if (!confirm('确定要清理所有历史、标签和翻译缓存吗？')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/admin/clear-cache', { credentials: 'include', method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setToast({ message: '缓存清理成功', type: 'success' });
      } else {
        setToast({ message: '清理失败：' + (data.error || '未知错误'), type: 'error' });
      }
    } catch (error) {
      console.error('清理缓存失败:', error);
      setToast({ message: '清理失败，请检查网络', type: 'error' });
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[var(--gold)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">助手设置</h1>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-xs text-[var(--gold)]">● 有未保存的更改</span>
          )}
          {/* 导出 / 导入 */}
          <button onClick={exportConfig} className="px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1.5 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card)] transition-all">
            <Download className="w-3.5 h-3.5" /> 导出
          </button>
          <button onClick={importConfig} className="px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1.5 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card)] transition-all">
            <Upload className="w-3.5 h-3.5" /> 导入
          </button>
          {/* 诊断 */}
          <button onClick={() => setShowDiagnostic(true)} className="px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--gold)] flex items-center gap-1.5 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card)] transition-all">
            <Zap className="w-3.5 h-3.5" /> 诊断
          </button>
          <button
            onClick={saveSettings}
            disabled={saving || !hasChanges}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              saving || !hasChanges
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                : 'bg-[var(--gold)] text-black hover:bg-[var(--gold-hover)]'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>

      {/* 翻译功能设置 */}
      <SectionCard title="翻译功能设置" icon={Languages}>
        <SettingRow label="使用翻译缓存" description="相同内容使用历史翻译结果，提升速度">
          <Toggle
            enabled={translateSettings.useCache}
            onChange={(v) => { setTranslateSettings(s => ({ ...s, useCache: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="混合语言翻译规则">
          <select
            value={translateSettings.mixedLangRule}
            onChange={(e) => { setTranslateSettings(s => ({ ...s, mixedLangRule: e.target.value })); setHasChanges(true); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            {MIXED_LANG_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </SettingRow>
        {/* 高级设置折叠 */}
        <div className="border-t border-[var(--border-color)]" />
        <button
          onClick={() => setShowAdvancedTranslate(!showAdvancedTranslate)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50 transition-all"
        >
          <span>高级翻译设置</span>
          {showAdvancedTranslate ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {showAdvancedTranslate && (
          <>
            <SettingRow label={<span className="flex items-center">保留换行符<TooltipIcon text="翻译后保留原文的换行格式" /></span>}>
              <Toggle
                enabled={translateSettings.preserveNewline}
                onChange={(v) => { setTranslateSettings(s => ({ ...s, preserveNewline: v })); setHasChanges(true); }}
              />
            </SettingRow>
            <div className="border-t border-[var(--border-color)]" />
            <SettingRow label={<span className="flex items-center">移除多余连续点号<TooltipIcon text="将多余的 ... 统一为 ..." /></span>} description="将多余的...统一为...">
              <Toggle
                enabled={translateSettings.removeRedundantDots}
                onChange={(v) => { setTranslateSettings(s => ({ ...s, removeRedundantDots: v })); setHasChanges(true); }}
              />
            </SettingRow>
            <div className="border-t border-[var(--border-color)]" />
            <SettingRow label={<span className="flex items-center">自动移除多余空格<TooltipIcon text="删除翻译结果中连续的空格" /></span>}>
              <Toggle
                enabled={translateSettings.removeExtraSpaces}
                onChange={(v) => { setTranslateSettings(s => ({ ...s, removeExtraSpaces: v })); setHasChanges(true); }}
              />
            </SettingRow>
            <div className="border-t border-[var(--border-color)]" />
            <SettingRow label={<span className="flex items-center">始终使用半角标点<TooltipIcon text="标点符号转换为英文（半角）" /></span>} description="翻译结果中的标点符号转换为英文">
              <Toggle
                enabled={translateSettings.halfwidthPunctuation}
                onChange={(v) => { setTranslateSettings(s => ({ ...s, halfwidthPunctuation: v })); setHasChanges(true); }}
              />
            </SettingRow>
          </>
        )}
      </SectionCard>

      {/* 配置 */}
      <SectionCard title="配置" icon={Settings}>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">提示词优化和反推规则</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">自定义提示词优化规则和反推规则</p>
            </div>
            <button
              onClick={() => setShowRuleManager(true)}
              className="px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] transition-all"
            >
              规则管理器
            </button>
          </div>
        </div>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="图像反推服务" description="为图像内容反推描述文字">
          <select
            value={selectedServices.imageCaption}
            onChange={(e) => { setSelectedServices(s => ({ ...s, imageCaption: e.target.value })); setHasChanges(true); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            {IMAGE_CAPTION_SERVICES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="提示词优化服务" description="扩展和优化用户输入的提示词">
          <select
            value={selectedServices.expand}
            onChange={(e) => { setSelectedServices(s => ({ ...s, expand: e.target.value })); setHasChanges(true); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            {EXPAND_SERVICES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="翻译服务" description="翻译节点帮助信息和提示词内容">
          <select
            value={selectedServices.translate}
            onChange={(e) => { setSelectedServices(s => ({ ...s, translate: e.target.value })); setHasChanges(true); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            {TRANSLATE_SERVICES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">AI 服务 API 配置</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">配置各 AI 服务的认证信息</p>
            </div>
            <button
              onClick={() => setShowApiManager(true)}
              className="px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] transition-all"
            >
              助手API管理
            </button>
          </div>
        </div>
      </SectionCard>

      {/* 小助手功能开关 */}
      <SectionCard title="小助手功能开关" icon={Sparkles}>
        <SettingRow
          label={<span className="flex items-center">启用节点信息翻译<TooltipIcon text="显示在 ComfyUI 节点上，鼠标悬停时翻译节点帮助文字" /></span>}
          description="ComfyUI 画布中悬浮节点帮助文字的翻译"
        >
          <Toggle
            enabled={featureSwitches.nodeHelpTranslator}
            onChange={(v) => { setFeatureSwitches(s => ({ ...s, nodeHelpTranslator: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow
          label={<span className="flex items-center">启用图像反推<TooltipIcon text="上传图片，AI 生成描述文字" /></span>}
          description="上传图片，AI 生成描述文字"
        >
          <Toggle
            enabled={featureSwitches.imageCaption}
            onChange={(v) => { setFeatureSwitches(s => ({ ...s, imageCaption: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow
          label={<span className="flex items-center">启用翻译功能<TooltipIcon text="翻译节点帮助信息，支持多语言" /></span>}
          description="翻译节点帮助信息，支持多语言"
        >
          <Toggle
            enabled={featureSwitches.translate}
            onChange={(v) => { setFeatureSwitches(s => ({ ...s, translate: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow
          label={<span className="flex items-center">启用提示词优化<TooltipIcon text="对输入的提示词进行扩展和优化" /></span>}
          description="对输入的提示词进行扩展和优化"
        >
          <Toggle
            enabled={featureSwitches.expand}
            onChange={(v) => { setFeatureSwitches(s => ({ ...s, expand: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="启用标签工具" description="为提示词添加结构化标签">
          <Toggle
            enabled={featureSwitches.tag}
            onChange={(v) => { setFeatureSwitches(s => ({ ...s, tag: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="启用历史功能" description="保存和查看历史翻译/优化记录">
          <Toggle
            enabled={featureSwitches.history}
            onChange={(v) => { setFeatureSwitches(s => ({ ...s, history: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="启用小助手" description="全局开关，关闭后小助手面板不显示">
          <Toggle
            enabled={featureSwitches.enabled}
            onChange={(v) => { setFeatureSwitches(s => ({ ...s, enabled: v })); setHasChanges(true); }}
          />
        </SettingRow>
      </SectionCard>

      {/* 界面 */}
      <SectionCard title="界面" icon={Palette} defaultOpen={false}>
        <SettingRow label="小助手图标不透明度">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="20"
              value={interfaceSettings.iconOpacity}
              onChange={(e) => { setInterfaceSettings(s => ({ ...s, iconOpacity: parseInt(e.target.value) })); setHasChanges(true); }}
              className="w-32 accent-[var(--gold)]"
            />
            <span className="text-sm text-[var(--gold)] w-8">{interfaceSettings.iconOpacity}%</span>
          </div>
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="小助手布局（图像反推）">
          <select
            value={interfaceSettings.imageCaptionLayout}
            onChange={(e) => { setInterfaceSettings(s => ({ ...s, imageCaptionLayout: e.target.value })); setHasChanges(true); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            <option value="h">横向</option>
            <option value="v">垂直</option>
          </select>
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="小助手布局（提示词）">
          <select
            value={interfaceSettings.promptLayout}
            onChange={(e) => { setInterfaceSettings(s => ({ ...s, promptLayout: e.target.value })); setHasChanges(true); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            <option value="right-center-v">右中（垂直）</option>
            <option value="bottom-right-h">右下（横向）</option>
            <option value="bottom-right-v">右下（垂直）</option>
            <option value="bottom-center-h">下中（横向）</option>
          </select>
        </SettingRow>
      </SectionCard>

      {/* 系统 */}
      <SectionCard title="系统" icon={Monitor} defaultOpen={false}>
        <SettingRow label="流式输出开关" description="AI 回复逐字显示">
          <Toggle
            enabled={systemSettings.streaming}
            onChange={(v) => { setSystemSettings(s => ({ ...s, streaming: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="控制台流式输出进度日志" description="在浏览器控制台输出详细信息">
          <Toggle
            enabled={systemSettings.showStreamingProgress}
            onChange={(v) => { setSystemSettings(s => ({ ...s, showStreamingProgress: v })); setHasChanges(true); }}
          />
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="小助手创建方式（图像反推）">
          <select
            value={systemSettings.imageCaptionCreationMode}
            onChange={(e) => { setSystemSettings(s => ({ ...s, imageCaptionCreationMode: e.target.value })); setHasChanges(true); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            <option value="auto">自动创建</option>
            <option value="manual">选中节点时创建</option>
          </select>
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <SettingRow label="小助手创建方式（提示词）">
          <select
            value={systemSettings.promptCreationMode}
            onChange={(e) => { setSystemSettings(s => ({ ...s, promptCreationMode: e.target.value })); setHasChanges(true); }}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
          >
            <option value="auto">自动创建</option>
            <option value="manual">选中节点时创建</option>
          </select>
        </SettingRow>
        <div className="border-t border-[var(--border-color)]" />
        <div className="p-4">
          <button
            onClick={clearCache}
            disabled={clearing}
            className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] hover:border-red-500/50 hover:text-red-500 transition-all flex items-center justify-center gap-2"
          >
            {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {clearing ? '清理中...' : '清理历史、标签、翻译缓存'}
          </button>
        </div>
      </SectionCard>

      {/* Toast 通知 */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* 诊断弹窗 */}
      <DiagnosticModal isOpen={showDiagnostic} onClose={() => setShowDiagnostic(false)} />

      {/* 规则管理器弹窗 */}
      <RuleManagerModal isOpen={showRuleManager} onClose={() => setShowRuleManager(false)} />

      {/* 助手API管理弹窗 */}
      <ApiManagerModal isOpen={showApiManager} onClose={() => setShowApiManager(false)} />
    </div>
  );
}
