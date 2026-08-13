'use client';

import { toast } from 'sonner';

import { Suspense, useState, useEffect } from 'react';

// 标记为动态渲染，避免静态生成时缺少客户端上下文
import dynamic from 'next/dynamic';
import NextImage from 'next/image';
import {
  Users,
  Image,
  ListTodo,
  Coins,
  Settings,
  BarChart3,
  Shield,
  Database,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Check,
  X,
  Plus,
  Minus,
  DollarSign,
  Sparkles,
  Activity,
  Boxes,
} from 'lucide-react';
import ApiSettingsView from '@/components/admin/ApiSettingsView';
import { usePageState } from '@/hooks/usePageState';
import { getAuthHeader } from '@/hooks/useAuth';
import { saveFeatureCosts, getAllFeatureCosts } from '@/lib/feature-costs';

// 直接 import 子页面（去 iframe 嵌入）
import FeaturesPage from './features/page';
import TasksPage from './tasks/page';
import ModelsPage from './models/page';
import SystemPage from './system/page';

// 加载占位组件
function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] min-h-[400px]">
      <div className="flex flex-col items-center gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--gold)]" />
        <span className="text-sm text-[var(--text-muted)]">加载{label}...</span>
      </div>
    </div>
  );
}

// 算力来源类型
type PowerSource = 'cloud' | 'local';

// 本地服务配置
interface LocalServiceConfig {
  type: 'comfyui' | 'ollama' | 'webui' | 'custom';
  host: string;
  port: number;
  apiKey?: string;
  comfyui?: {
    workflowId?: string;
  };
  ollama?: {
    model?: string;
    temperature?: number;
  };
}

// 图片生成 API 提供商类型
type ImageProvider =
  | 'openai'
  | 'stability'
  | 'doubao'
  | 'zhipu'
  | 'qwen'
  | 'kimi'
  | 'minimax'
  | 'custom';

// API类别
type ApiCategory = 'llm' | 'image-generate' | 'image-edit' | '3d-modeling' | 'video-generate';

// 端点配置
interface EndpointConfig {
  apiKey: string;
  url?: string; // 可选：自定义 URL
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  timeout?: number;
  provider?: ImageProvider; // 图片生成 API 提供商
  model?: string; // 模型名称
}

// API 配置类型（新结构）
interface ApiEndpointConfig {
  id: string;
  name: string;
  category: ApiCategory;
  description?: string;
  enabled: boolean;
  source: PowerSource;
  cloud: EndpointConfig;
  local: EndpointConfig & {
    service?: LocalServiceConfig;
  };
  fallback: {
    enabled: boolean;
    mockDelay?: number;
  };
  lastTested?: string;
  cloudTestResult?: 'success' | 'failed' | 'unknown';
  localTestResult?: 'success' | 'failed' | 'unknown';
}

interface ApiMapping {
  configs: Record<string, ApiEndpointConfig>;
  mapping: Record<string, string[]>;
  globalSource?: PowerSource;
}

// 用户数据类型
interface UserItem {
  id: string;
  email: string;
  nickname?: string;
  avatar?: string;
  role: string;
  status: string;
  power: number;
  createdAt: string;
  lastLoginAt?: string | null;
}

// 用户管理组件
function UserManagementSection() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechargeModal, setRechargeModal] = useState<{ open: boolean; user: UserItem | null }>({
    open: false,
    user: null,
  });
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [rechargeReason, setRechargeReason] = useState('');
  const [recharging, setRecharging] = useState(false);

  // 预设充值金额
  const presetAmounts = [50, 100, 200, 500, 1000, 2000, 5000];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openRechargeModal = (user: UserItem) => {
    setRechargeAmount(100);
    setRechargeReason('');
    setRechargeModal({ open: true, user });
  };

  const closeRechargeModal = () => {
    setRechargeModal({ open: false, user: null });
    setRechargeAmount(100);
    setRechargeReason('');
  };

  const handleRecharge = async () => {
    if (!rechargeModal.user || rechargeAmount <= 0) return;

    setRecharging(true);
    try {
      const res = await fetch(`/api/admin/users/${rechargeModal.user.id}/recharge`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: rechargeAmount,
          reason: rechargeReason || '管理员充值',
        }),
      });

      const data = await res.json();
      if (data.success) {
        // 更新用户列表中的余额
        setUsers((prev) =>
          prev.map((u) =>
            u.id === rechargeModal.user?.id ? { ...u, power: data.data.newBalance } : u
          )
        );
        closeRechargeModal();
        toast('充值成功！新余额: ${data.data.newBalance}');
      } else {
        toast.error(data.error || '充值失败');
      }
    } catch (error) {
      console.error('充值失败:', error);
      toast.error('充值失败，请重试');
    } finally {
      setRecharging(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-500">
            <CheckCircle className="w-3 h-3" />
            正常
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-500">
            <Clock className="w-3 h-3" />
            未活跃
          </span>
        );
      case 'banned':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-500">
            <XCircle className="w-3 h-3" />
            已封禁
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-500">
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">用户管理</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--gold)] hover:text-black transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button className="px-4 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:shadow-lg transition-all">
            导出数据
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--bg-card)]">
            <tr>
              {['用户', '邮箱', '剩余算力', '注册时间', '状态', '操作'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  暂无用户数据
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--bg-card)] transition-all">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] text-sm font-medium">
                        {(user.nickname || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-[var(--text-primary)]">
                          {user.nickname || '未设置'}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {user.role === 'vip'
                            ? 'VIP用户'
                            : user.role === 'admin'
                              ? '管理员'
                              : '普通用户'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-[var(--gold)]">
                      {user.power.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{user.createdAt}</td>
                  <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openRechargeModal(user)}
                        className="px-3 py-1 bg-[var(--gold)]/20 text-[var(--gold)] rounded text-xs hover:bg-[var(--gold)] hover:text-black transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        充值
                      </button>
                      <button className="px-3 py-1 bg-[var(--bg-card)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--gold)] hover:text-black transition-all">
                        编辑
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 充值弹窗 */}
      {rechargeModal.open && rechargeModal.user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] w-full max-w-md overflow-hidden">
            {/* 弹窗头部 */}
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[var(--gold)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">算力充值</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    为 {rechargeModal.user.nickname || rechargeModal.user.email} 充值
                  </p>
                </div>
              </div>
              <button
                onClick={closeRechargeModal}
                className="p-1 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-4 space-y-4">
              {/* 当前余额 */}
              <div className="bg-[var(--bg-card)] rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">当前余额</span>
                <span className="text-lg font-bold text-[var(--gold)]">
                  {rechargeModal.user.power.toLocaleString()}
                </span>
              </div>

              {/* 预设金额 */}
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">快速选择</label>
                <div className="grid grid-cols-4 gap-2">
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setRechargeAmount(amount)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        rechargeAmount === amount
                          ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)]'
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义金额 */}
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">
                  自定义金额
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRechargeAmount(Math.max(1, rechargeAmount - 100))}
                    className="p-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)]"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="flex-1 px-4 py-2 bg-[var(--bg-card)] rounded-lg text-center text-[var(--text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                    min={1}
                  />
                  <button
                    onClick={() => setRechargeAmount(rechargeAmount + 100)}
                    className="p-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 充值原因 */}
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">
                  充值备注（可选）
                </label>
                <input
                  type="text"
                  value={rechargeReason}
                  onChange={(e) => setRechargeReason(e.target.value)}
                  placeholder="如：活动赠送、补偿等"
                  className="w-full px-4 py-2 bg-[var(--bg-card)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                />
              </div>

              {/* 充值后余额预览 */}
              <div className="bg-[var(--gold)]/10 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-[var(--gold)]">充值后余额</span>
                <span className="text-lg font-bold text-[var(--gold)]">
                  {(rechargeModal.user.power + rechargeAmount).toLocaleString()}
                  <span className="text-xs font-normal ml-1">
                    (+{rechargeAmount.toLocaleString()})
                  </span>
                </span>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
              <button
                onClick={closeRechargeModal}
                className="flex-1 py-2 bg-[var(--bg-card)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleRecharge}
                disabled={recharging || rechargeAmount <= 0}
                className="flex-1 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {recharging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    充值中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    确认充值
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 模型列表配置
const MODEL_LISTS = {
  llm: {
    zhipu: [
      { id: 'glm-4-7-251222', name: 'GLM-4-7B', description: '70亿参数，通用对话' },
      { id: 'glm-4-9b-20250227', name: 'GLM-4-9B', description: '90亿参数，平衡性能' },
      { id: 'glm-4-flashx', name: 'GLM-4-Flash', description: '超快响应，实时对话' },
      { id: 'glm-4-plus', name: 'GLM-4-Plus', description: '增强版，更强大' },
      { id: 'glm-3-turbo', name: 'GLM-3-Turbo', description: '快速响应，轻量级' },
    ],
    doubao: [
      { id: 'doubao-pro', name: 'Doubao Pro', description: '专业版，高质量' },
      { id: 'doubao-lite', name: 'Doubao Lite', description: '轻量版，快速' },
      { id: 'doubao-pro-128k', name: 'Doubao Pro 128K', description: '长上下文版本' },
    ],
    openai: [
      { id: 'gpt-4', name: 'GPT-4', description: '最强大的模型' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'GPT-4 加速版' },
      { id: 'gpt-4o', name: 'GPT-4o', description: '多模态旗舰' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '快速经济' },
    ],
    qwen: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: '超快响应' },
      { id: 'qwen-plus', name: 'Qwen Plus', description: '平衡性能' },
      { id: 'qwen-max', name: 'Qwen Max', description: '最强能力' },
      { id: 'qwen-max-longcontext', name: 'Qwen Max Long', description: '长上下文' },
    ],
    kimi: [
      { id: 'moonshot-v1', name: 'Moonshot V1', description: '通用对话' },
      { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', description: '长文本处理' },
      { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', description: '快速响应' },
    ],
    minimax: [
      { id: 'abab6.5', name: 'abab6.5', description: '通用对话' },
      { id: 'abab6.5s', name: 'abab6.5s', description: '超快响应' },
      { id: 'abab5.5-chat', name: 'abab5.5-chat', description: '轻量级对话' },
    ],
    ollama: [
      { id: 'llama2', name: 'Llama 2', description: '开源模型' },
      { id: 'llama3', name: 'Llama 3', description: '新一代开源' },
      { id: 'mistral', name: 'Mistral', description: '轻量级开源' },
    ],
    custom: [{ id: 'custom-model', name: '自定义模型', description: '手动输入模型名称' }],
  },
  'image-generate': {
    openai: [
      { id: 'dall-e-3', name: 'DALL-E 3', description: '最新一代，质量最佳' },
      { id: 'dall-e-2', name: 'DALL-E 2', description: '快速生成' },
    ],
    stability: [
      { id: 'stable-diffusion-xl-1024-v1-0', name: 'SDXL 1.0', description: '高清生成' },
      { id: 'stable-diffusion-3', name: 'SD 3', description: '最新版本' },
      { id: 'stable-diffusion-2.1', name: 'SD 2.1', description: '经典版本' },
    ],
    doubao: [
      { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0', description: '高质量文生图' },
      { id: 'doubao-v2', name: 'Doubao V2', description: '快速生成' },
    ],
    zhipu: [
      { id: 'cogview-3', name: 'CogView-3', description: '智谱最新文生图' },
      { id: 'cogview-3-plus', name: 'CogView-3 Plus', description: '增强版' },
      { id: 'cogview', name: 'CogView', description: '经典版本' },
    ],
    qwen: [
      { id: 'wanx-v1', name: 'WanX V1', description: '通义文生图' },
      { id: 'wanx-v3', name: 'WanX V3', description: '最新版本' },
    ],
    kimi: [{ id: 'kimi-image', name: 'Kimi Image', description: 'Kimi文生图' }],
    minimax: [{ id: 'image-01', name: 'Image-01', description: 'MiniMax文生图' }],
    custom: [{ id: 'custom-model', name: '自定义模型', description: '手动输入模型名称' }],
  },
  'video-generate': {
    zhipu: [
      { id: 'cogvideox', name: 'CogVideoX', description: '智谱文生视频' },
      { id: 'cogvideox-5b', name: 'CogVideoX-5B', description: '轻量版' },
      { id: 'cogvideox-2b', name: 'CogVideoX-2B', description: '超快生成' },
    ],
    runway: [
      { id: 'gen-2', name: 'Gen-2', description: 'Runway视频生成' },
      { id: 'gen-3-alpha', name: 'Gen-3 Alpha', description: '最新版本' },
    ],
    pika: [
      { id: 'pika-v1', name: 'Pika V1', description: 'Pika视频生成' },
      { id: 'pika-labs', name: 'Pika Labs', description: '实验版本' },
    ],
    sora: [{ id: 'sora-v1', name: 'Sora V1', description: 'OpenAI Sora' }],
    qwen: [{ id: 'qwen-video', name: 'Qwen Video', description: '通义视频生成' }],
    kimi: [{ id: 'kimi-video', name: 'Kimi Video', description: 'Kimi视频生成' }],
    minimax: [{ id: 'video-01', name: 'Video-01', description: 'MiniMax视频生成' }],
    custom: [{ id: 'custom-model', name: '自定义模型', description: '手动输入模型名称' }],
  },
  'image-edit': {
    zhipu: [{ id: 'cogview-3', name: 'CogView-3', description: '智谱图像编辑' }],
    custom: [{ id: 'custom-model', name: '自定义模型', description: '手动输入模型名称' }],
  },
  '3d-modeling': {
    tripo: [
      { id: 'tripo-3d', name: 'Tripo-3D', description: 'Tripo 3D建模' },
      { id: 'tripo-sr', name: 'Tripo SR', description: '超分辨率' },
    ],
    meshy: [
      { id: 'meshy-v1', name: 'Meshy V1', description: 'Meshy建模 V1' },
      { id: 'meshy-v2', name: 'Meshy V2', description: 'Meshy建模 V2' },
      { id: 'meshy-v3', name: 'Meshy V3', description: 'Meshy建模 V3 (最新)' },
      { id: 'meshy-preview', name: 'Meshy Preview', description: '快速预览模式' },
    ],
    kaedim: [{ id: 'kaedim-3d', name: 'Kaedim 3D', description: 'Kaedim建模' }],
    custom: [{ id: 'custom-model', name: '自定义模型', description: '手动输入模型名称' }],
  },
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = usePageState('admin-active-tab', 'dashboard');

  // 统计数据（从API加载）
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    todayGenerated: 0,
    totalGenerated: 0,
    totalPower: 0,
    usedPower: 0,
    taskTotal: 0,
    taskPending: 0,
  });

  // 待审核作品
  const [pendingWorks, setPendingWorks] = useState<any[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(false);

  // 加载统计数据
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetch('/api/admin/dashboard-stats', { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            // 字段名映射（新 API 嵌套结构 → 老扁平结构）
            const d = data.data || {};
            setStats({
              totalUsers: d.users?.total ?? 0,
              activeUsers: d.users?.today ?? 0,
              totalGenerated: d.works?.total ?? 0,
              todayGenerated: d.works?.today ?? 0,
              totalPower: d.power?.totalBalance ?? 0,
              usedPower: d.power?.todayConsumed ?? 0,
              taskTotal: d.tasks?.total ?? 0,
              taskPending: d.tasks?.pending ?? 0,
            });
          }
        })
        .catch(console.error);
    }
  }, [activeTab]);

  // 加载待审核作品
  useEffect(() => {
    if (activeTab === 'works') {
      setLoadingWorks(true);
      fetch('/api/admin/works', { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPendingWorks(data.data || []);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingWorks(false));
    }
  }, [activeTab]);

  // 审核操作
  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/works', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'approve' ? '作品已通过' : '作品已拒绝');
        setPendingWorks((prev) => prev.filter((w) => w.id !== id));
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (e) {
      toast.error('操作失败');
    }
  };

  const tabs = [
    { key: 'dashboard', label: '数据概览', icon: BarChart3 },
    { key: 'users', label: '用户管理', icon: Users },
    { key: 'works', label: '作品审核', icon: Image },
    { key: 'tasks', label: '任务中心', icon: ListTodo },
    { key: 'power', label: '算力管理', icon: Coins },
    { key: 'features', label: '功能管理', icon: Sparkles },
    { key: 'models', label: '模型中心', icon: Boxes },
    { key: 'api-settings', label: 'API设置', icon: Settings },
    { key: 'system-settings', label: '提示词与规则', icon: Shield },
    { key: 'system', label: '系统健康', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* 侧边栏 */}
      <div className="w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[var(--gold)]" />
            <span className="font-bold text-[var(--text-primary)]">管理后台</span>
          </div>
        </div>
        <nav className="flex-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all mb-1 ${activeTab === tab.key ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'}`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gold)] rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">管理员</p>
              <p className="text-xs text-[var(--text-muted)]">超级权限</p>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* 数据概览 */}
          {activeTab === 'dashboard' && (
            <>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">数据概览</h1>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: '总用户数',
                    value: stats.totalUsers.toLocaleString(),
                    icon: Users,
                    color: 'text-blue-500',
                  },
                  {
                    label: '活跃用户',
                    value: stats.activeUsers.toLocaleString(),
                    icon: TrendingUp,
                    color: 'text-green-500',
                  },
                  {
                    label: '今日生成',
                    value: stats.todayGenerated.toLocaleString(),
                    icon: Image,
                    color: 'text-[var(--gold)]',
                  },
                  {
                    label: '累计生成',
                    value: stats.totalGenerated.toLocaleString(),
                    icon: Database,
                    color: 'text-purple-500',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <item.icon className={`w-6 h-6 ${item.color}`} />
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold text-[var(--text-primary)]">
                      {item.value}
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* 算力统计 */}
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
                  <h3 className="font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-[var(--gold)]" />
                    算力统计
                  </h3>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[var(--text-secondary)]">已使用</span>
                      <span className="text-[var(--text-primary)]">
                        {((stats.usedPower / stats.totalPower) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 bg-[var(--bg-card)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] rounded-full"
                        style={{ width: `${(stats.usedPower / stats.totalPower) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--text-muted)]">总算力:</span>{' '}
                      <span className="text-[var(--text-primary)]">
                        {stats.totalPower.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">已使用:</span>{' '}
                      <span className="text-[var(--text-primary)]">
                        {stats.usedPower.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 系统状态 */}
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-5">
                  <h3 className="font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[var(--gold)]" />
                    系统状态
                  </h3>
                  <div className="space-y-3">
                    {['API服务', '图片生成', '视频生成', '数据库'].map((service, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-[var(--border-color)] last:border-0"
                      >
                        <span className="text-sm text-[var(--text-secondary)]">{service}</span>
                        <span className="flex items-center gap-1 text-sm text-green-500">
                          <CheckCircle className="w-4 h-4" />
                          正常
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 用户管理 */}
          {activeTab === 'users' && <UserManagementSection />}

          {/* 作品审核 */}
          {activeTab === 'works' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">作品审核</h1>
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  待审核: {pendingWorks.length}
                </div>
              </div>
              {loadingWorks ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 animate-spin text-[var(--gold)]" />
                </div>
              ) : pendingWorks.length === 0 ? (
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)]">暂无待审核作品</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {pendingWorks.map((work) => (
                    <div
                      key={work.id}
                      className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden"
                    >
                      <NextImage
                        src={work.image_url || `https://picsum.photos/seed/${work.id}/400/300`}
                        alt={work.title}
                        className="w-full aspect-video object-cover"
                        width={400}
                        height={300}
                        unoptimized
                      />
                      <div className="p-4">
                        <h3 className="font-medium text-[var(--text-primary)] mb-1">
                          {work.title || '无标题'}
                        </h3>
                        <p className="text-sm text-[var(--text-muted)] mb-3">
                          {work.type} · {work.user_id || '未知用户'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(work.id, 'approve')}
                            className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-all"
                          >
                            通过
                          </button>
                          <button
                            onClick={() => handleReview(work.id, 'reject')}
                            className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all"
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 算力管理 */}
          {activeTab === 'power' && <PowerManagementSection />}

          {/* 功能管理 - 直接 import 子页面（去 iframe） */}
          {activeTab === 'features' && (
            <Suspense fallback={<LoadingPanel label="功能管理" />}>
              <FeaturesPage />
            </Suspense>
          )}

          {/* 任务中心 - 直接 import（去 iframe）*/}
          {activeTab === 'tasks' && (
            <Suspense fallback={<LoadingPanel label="任务中心" />}>
              <TasksPage />
            </Suspense>
          )}

          {/* 模型中心 - 直接 import（去 iframe）*/}
          {activeTab === 'models' && (
            <Suspense fallback={<LoadingPanel label="模型中心" />}>
              <ModelsPage />
            </Suspense>
          )}

          {/* API设置 */}
          {activeTab === 'api-settings' && <ApiSettingsView />}

          {/* 系统设置 */}
          {activeTab === 'system-settings' && <SystemSettingsSection activeTab={activeTab} />}

          {/* 系统健康 - 直接 import（去 iframe）*/}
          {activeTab === 'system' && (
            <Suspense fallback={<LoadingPanel label="系统健康" />}>
              <SystemPage />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

// API 设置区域组件
function ApiSettingsSection() {
  return <ApiSettingsView />;
}

// 功能名称映射
const featureNames: Record<string, string> = {
  dialogue: 'AI对话',
  text2img: '文案生图',
  refine: '产品精修',
  blend: '多图融合',
  oneclick: '一键设计',
  multiview: '生成多视图',
  sketch: '线稿/写实',
  free: '自由创作',
  relief: '浮雕设计',
  image3d: '图转3D',
  removebg: '移除背景',
  upscale: '高清放大',
  watermark: '去除水印',
  text2video: '文生视频',
  img2video: '图生视频',
  '2dto3d': '平面转雕塑',
  tryon: '试戴效果',
};

// 算力管理区域组件
function PowerManagementSection() {
  const [powerData, setPowerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activePowerTab, setActivePowerTab] = useState('stats');

  // 用户搜索和充值状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [rechargeReason, setRechargeReason] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [rechargeType, setRechargeType] = useState<'recharge' | 'deduct'>('recharge');

  // 用户列表分页状态
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userTotal, setUserTotal] = useState(0);

  // 算力流水状态
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txFilter, setTxFilter] = useState<{ type?: string; search?: string }>({});

  // 功能算力配置状态
  const [featureCosts, setFeatureCosts] = useState<any[]>([]);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);
  const [editingCosts, setEditingCosts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/admin/power', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPowerData(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 加载功能算力配置
  const loadFeatureCosts = () => {
    setLoadingCosts(true);

    // 先从 localStorage 读取缓存显示
    const cachedCosts = getAllFeatureCosts();
    const cachedFeatures = Object.entries(cachedCosts).map(([feature, cost]) => ({
      feature,
      name: featureNames[feature] || feature,
      cost,
    }));
    setFeatureCosts(cachedFeatures);
    setEditingCosts({ ...cachedCosts });

    // 再从 API 更新最新配置
    fetch('/api/admin/feature-costs', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        console.log('[FeatureCosts] API返回:', data);
        if (data.success && data.data?.features?.length > 0) {
          setFeatureCosts(data.data.features);
          const initial: Record<string, number> = {};
          data.data.features.forEach((f: any) => {
            initial[f.feature] = f.cost;
          });
          setEditingCosts(initial);
        }
      })
      .catch((err) => {
        console.error('[FeatureCosts] 加载失败:', err);
      })
      .finally(() => setLoadingCosts(false));
  };

  useEffect(() => {
    if (activePowerTab === 'feature-costs') {
      loadFeatureCosts();
    }
  }, [activePowerTab]);

  // 加载算力流水
  const loadTransactions = async (page = 1, filters = txFilter) => {
    setLoadingTx(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10',
      });
      if (filters.type) params.set('type', filters.type);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/admin/power/transactions?${params}`, {
        credentials: 'include',
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setTransactions(data.data.transactions || []);
        setTxPage(data.data.pagination.page);
        setTxTotalPages(data.data.pagination.totalPages);
        setTxTotal(data.data.pagination.total);
      }
    } catch (err) {
      console.error('[Power] 加载流水失败:', err);
    } finally {
      setLoadingTx(false);
    }
  };

  // 搜索用户（带分页）
  const handleSearchUsers = async (page = 1) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=10`,
        {
          credentials: 'include',
          headers: getAuthHeader(),
        }
      );
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data.users || []);
        setUserPage(data.data.pagination.page);
        setUserTotalPages(data.data.pagination.totalPages);
        setUserTotal(data.data.pagination.total);
      }
    } catch (err) {
      console.error('[Power] 搜索用户失败:', err);
      toast.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  // 选择用户进行充值
  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setRechargeAmount(100);
    setRechargeReason('');
  };

  // 充值/扣除用户算力
  const handleRechargeUser = async () => {
    if (!selectedUser || rechargeAmount <= 0) return;

    setRecharging(true);
    try {
      // 使用新的统一充值 API
      const res = await fetch('/api/admin/power/recharge', {
        credentials: 'include',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: rechargeAmount,
          type: rechargeType,
          reason: rechargeReason || (rechargeType === 'deduct' ? '管理员扣除' : '管理员充值'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `${rechargeType === 'deduct' ? '扣除' : '充值'}成功！` +
            `${selectedUser.nickname || selectedUser.email} 的算力已更新为 ${data.data.newBalance}`
        );
        // 更新搜索结果中的用户算力
        setSearchResults((prev) =>
          prev.map((u) => (u.id === selectedUser.id ? { ...u, power: data.data.newBalance } : u))
        );
        setSelectedUser(null);
        setRechargeAmount(100);
        setRechargeReason('');
        // 刷新流水记录
        loadTransactions(1, txFilter);
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (err) {
      console.error('[Power] 操作失败:', err);
      toast.error('操作失败');
    } finally {
      setRecharging(false);
    }
  };

  // 加载流水（初始化）
  useEffect(() => {
    if (activePowerTab === 'stats') {
      loadTransactions(1);
    }
  }, [activePowerTab]);

  // 保存功能算力配置
  const handleSaveCosts = async () => {
    setSavingCosts(true);
    try {
      const features: Record<string, number> = {};
      Object.entries(editingCosts).forEach(([key, val]) => {
        features[key] = val;
      });

      const res = await fetch('/api/admin/feature-costs', {
        credentials: 'include',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ features }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('保存成功！');
        // 同时保存到本地缓存，让前端立即生效
        await saveFeatureCosts(features);
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (err) {
      console.error('[Power] 保存功能算力失败:', err);
      toast.error('保存失败');
    } finally {
      setSavingCosts(false);
    }
  };

  // 更新单个功能算力
  const updateCost = (feature: string, value: string) => {
    const num = parseInt(value) || 0;
    setEditingCosts((prev) => ({ ...prev, [feature]: num }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--gold)]" />
      </div>
    );
  }

  const packages = powerData?.packages || [];
  const consumption = powerData?.consumption || [];

  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">算力管理</h1>

      {/* 子标签切换 */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'stats', label: '算力充值' },
          { key: 'feature-costs', label: '算力配置' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActivePowerTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activePowerTab === tab.key
                ? 'bg-[var(--gold)] text-black'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 算力充值 */}
      {activePowerTab === 'stats' && (
        <div className="space-y-6">
          {/* 顶部：用户搜索 + 充值操作 */}
          <div className="grid grid-cols-3 gap-6">
            {/* 左侧：用户列表 */}
            <div className="col-span-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
              <h3 className="font-medium text-[var(--text-primary)] mb-4">用户列表</h3>
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers(1)}
                  placeholder="搜索用户邮箱或昵称..."
                  className="flex-1 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
                />
                <button
                  onClick={() => handleSearchUsers(1)}
                  disabled={searching}
                  className="px-4 py-2 bg-[var(--gold)] text-black font-medium rounded-lg hover:bg-[var(--gold-hover)] disabled:opacity-50 flex items-center gap-2"
                >
                  {searching && <RefreshCw className="w-4 h-4 animate-spin" />}
                  搜索
                </button>
              </div>

              {/* 用户列表 */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className={`p-3 bg-[var(--bg-card)] rounded-lg border cursor-pointer transition-all ${
                        selectedUser?.id === user.id
                          ? 'border-[var(--gold)] ring-1 ring-[var(--gold)]'
                          : 'border-[var(--border-color)] hover:border-[var(--gold)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-[var(--text-primary)]">
                            {user.nickname || '无昵称'}
                          </div>
                          <div className="text-sm text-[var(--text-muted)]">{user.email}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-[var(--gold)]">
                            {user.power?.toLocaleString() || 0}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">算力</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-[var(--text-muted)] py-8">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>搜索用户进行充值操作</p>
                  </div>
                )}
              </div>

              {/* 分页 */}
              {userTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => handleSearchUsers(userPage - 1)}
                    disabled={userPage <= 1}
                    className="px-3 py-1 rounded border border-[var(--border-color)] disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-[var(--text-muted)]">
                    第 {userPage} / {userTotalPages} 页，共 {userTotal} 人
                  </span>
                  <button
                    onClick={() => handleSearchUsers(userPage + 1)}
                    disabled={userPage >= userTotalPages}
                    className="px-3 py-1 rounded border border-[var(--border-color)] disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>

            {/* 右侧：充值操作 */}
            <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
              <h3 className="font-medium text-[var(--text-primary)] mb-4">充值/扣除</h3>
              {selectedUser ? (
                <div className="space-y-4">
                  <div className="p-3 bg-[var(--bg-card)] rounded-lg">
                    <div className="font-medium text-[var(--text-primary)]">
                      {selectedUser.nickname || '无昵称'}
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">{selectedUser.email}</div>
                    <div className="mt-2 text-lg font-bold text-[var(--gold)]">
                      当前算力：{selectedUser.power?.toLocaleString() || 0}
                    </div>
                  </div>

                  {/* 操作类型切换 */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRechargeType('recharge')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        rechargeType === 'recharge'
                          ? 'bg-green-500 text-white'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      充值
                    </button>
                    <button
                      onClick={() => setRechargeType('deduct')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        rechargeType === 'deduct'
                          ? 'bg-red-500 text-white'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      扣除
                    </button>
                  </div>

                  {/* 金额 */}
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-2">
                      {rechargeType === 'deduct' ? '扣除算力' : '充值算力'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={rechargeAmount}
                      onChange={(e) =>
                        setRechargeAmount(Math.max(1, parseInt(e.target.value) || 0))
                      }
                      className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
                    />
                  </div>

                  {/* 快捷金额 */}
                  <div className="flex flex-wrap gap-2">
                    {[50, 100, 200, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setRechargeAmount(amt)}
                        className={`px-3 py-1 text-sm rounded-lg border transition-all ${
                          rechargeAmount === amt
                            ? 'bg-[var(--gold)] text-black border-[var(--gold)]'
                            : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--gold)]'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>

                  {/* 原因 */}
                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-2">备注</label>
                    <input
                      type="text"
                      value={rechargeReason}
                      onChange={(e) => setRechargeReason(e.target.value)}
                      placeholder={rechargeType === 'deduct' ? '扣除原因' : '如：活动赠送'}
                      className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
                    />
                  </div>

                  {/* 预览 */}
                  <div className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--gold)]/30">
                    <div className="text-sm text-[var(--text-muted)]">
                      {rechargeType === 'deduct' ? '扣除后算力' : '充值后算力'}
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        rechargeType === 'deduct' ? 'text-red-500' : 'text-[var(--gold)]'
                      }`}
                    >
                      {rechargeType === 'deduct'
                        ? Math.max(0, (selectedUser.power || 0) - rechargeAmount)
                        : (selectedUser.power || 0) + rechargeAmount}
                    </div>
                  </div>

                  {/* 提交按钮 */}
                  <button
                    onClick={handleRechargeUser}
                    disabled={recharging || rechargeAmount <= 0}
                    className={`w-full py-3 font-medium rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                      rechargeType === 'deduct'
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-[var(--gold)] hover:bg-[var(--gold-hover)] text-black'
                    }`}
                  >
                    {recharging && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {recharging
                      ? '处理中...'
                      : `${rechargeType === 'deduct' ? '扣除' : '充值'} ${rechargeAmount} 算力`}
                  </button>
                </div>
              ) : (
                <div className="text-center text-[var(--text-muted)] py-8">
                  <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>请在左侧选择用户</p>
                </div>
              )}
            </div>
          </div>

          {/* 底部：算力流水记录 */}
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-[var(--text-primary)]">算力操作记录</h3>
              <div className="flex gap-2">
                <select
                  value={txFilter.type || ''}
                  onChange={(e) => {
                    const newFilter = { ...txFilter, type: e.target.value || undefined };
                    setTxFilter(newFilter);
                    loadTransactions(1, newFilter);
                  }}
                  className="px-3 py-1 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded"
                >
                  <option value="">全部类型</option>
                  <option value="recharge">充值</option>
                  <option value="deduct">扣除</option>
                  <option value="consume">消耗</option>
                  <option value="bonus">奖励</option>
                </select>
                <button
                  onClick={() => loadTransactions(1, txFilter)}
                  className="px-3 py-1 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-hover)]"
                >
                  刷新
                </button>
              </div>
            </div>

            {/* 流水表格 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left py-2 px-3 text-[var(--text-muted)]">时间</th>
                    <th className="text-left py-2 px-3 text-[var(--text-muted)]">用户</th>
                    <th className="text-left py-2 px-3 text-[var(--text-muted)]">类型</th>
                    <th className="text-right py-2 px-3 text-[var(--text-muted)]">金额</th>
                    <th className="text-right py-2 px-3 text-[var(--text-muted)]">余额</th>
                    <th className="text-left py-2 px-3 text-[var(--text-muted)]">操作人</th>
                    <th className="text-left py-2 px-3 text-[var(--text-muted)]">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTx ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[var(--gold)]" />
                      </td>
                    </tr>
                  ) : transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-card)]"
                      >
                        <td className="py-2 px-3 text-[var(--text-secondary)]">
                          {new Date(tx.createdAt).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-[var(--text-primary)]">
                            {tx.userNickname || '未知'}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">{tx.userEmail}</div>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              tx.type === 'recharge'
                                ? 'bg-green-500/20 text-green-500'
                                : tx.type === 'deduct'
                                  ? 'bg-red-500/20 text-red-500'
                                  : tx.type === 'consume'
                                    ? 'bg-blue-500/20 text-blue-500'
                                    : 'bg-yellow-500/20 text-yellow-500'
                            }`}
                          >
                            {tx.type === 'recharge'
                              ? '充值'
                              : tx.type === 'deduct'
                                ? '扣除'
                                : tx.type === 'consume'
                                  ? '消耗'
                                  : '奖励'}
                          </span>
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-medium ${
                            tx.amount > 0 ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {tx.amount > 0 ? '+' : ''}
                          {tx.amount}
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                          {tx.balanceAfter}
                        </td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">
                          {tx.operatorEmail || '-'}
                        </td>
                        <td className="py-2 px-3 text-[var(--text-muted)] max-w-32 truncate">
                          {tx.reason || '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[var(--text-muted)]">
                        暂无操作记录
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {txTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => loadTransactions(txPage - 1, txFilter)}
                  disabled={txPage <= 1}
                  className="px-3 py-1 rounded border border-[var(--border-color)] disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="text-sm text-[var(--text-muted)]">
                  第 {txPage} / {txTotalPages} 页，共 {txTotal} 条
                </span>
                <button
                  onClick={() => loadTransactions(txPage + 1, txFilter)}
                  disabled={txPage >= txTotalPages}
                  className="px-3 py-1 rounded border border-[var(--border-color)] disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 算力配置 */}
      {activePowerTab === 'feature-costs' && (
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-[var(--text-primary)]">设计工坊算力配置</h3>
            <button
              onClick={handleSaveCosts}
              disabled={savingCosts}
              className="px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {savingCosts ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> 保存中...
                </>
              ) : (
                '保存设置'
              )}
            </button>
          </div>

          {loadingCosts ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 animate-spin text-[var(--gold)]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {featureCosts.map((item) => (
                <div
                  key={item.feature}
                  className="flex items-center justify-between p-3 bg-[var(--bg-card)] rounded-lg"
                >
                  <span className="text-[var(--text-primary)]">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={editingCosts[item.feature] ?? item.cost}
                      onChange={(e) => updateCost(item.feature, e.target.value)}
                      className="w-20 px-2 py-1 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-center text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">算力</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
// 系统设置区域组件
function SystemSettingsSection({ activeTab }: { activeTab: string }) {
  // 系统配置状态
  const [systemName, setSystemName] = useState('敦煌金AI设计平台');
  const [siteUrl, setSiteUrl] = useState('http://localhost:3000');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowRegister, setAllowRegister] = useState(true);
  const [defaultUserPower, setDefaultUserPower] = useState(100);
  const [maxUploadSize, setMaxUploadSize] = useState(10);
  const [sessionTimeout, setSessionTimeout] = useState(24);
  const [logLevel, setLogLevel] = useState('info');
  const [saving, setSaving] = useState(false);

  // 加载设置
  useEffect(() => {
    if (activeTab === 'system-settings') {
      fetch('/api/admin/system', { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setSystemName(data.data.systemName || '敦煌金AI设计平台');
            setSiteUrl(data.data.siteUrl || 'http://localhost:3000');
            setMaintenanceMode(data.data.maintenanceMode || false);
            setAllowRegister(data.data.allowRegister !== false);
            setDefaultUserPower(data.data.defaultUserPower || 100);
            setMaxUploadSize(data.data.maxUploadSize || 10);
            setSessionTimeout(data.data.sessionTimeout || 24);
            setLogLevel(data.data.logLevel || 'info');
          }
        })
        .catch(console.error);
    }
  }, [activeTab]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/system', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            systemName,
            siteUrl,
            maintenanceMode,
            allowRegister,
            defaultUserPower,
            maxUploadSize,
            sessionTimeout,
            logLevel,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('设置已保存');
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (e) {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">系统设置</h1>

      {/* 基础设置 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 mb-6">
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-[var(--gold)]" />
          基础设置
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-2">系统名称</label>
            <input
              type="text"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-2">网站地址</label>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 用户设置 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 mb-6">
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--gold)]" />
          用户设置
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)]">允许新用户注册</p>
              <p className="text-xs text-[var(--text-muted)]">关闭后只能通过管理员创建账号</p>
            </div>
            <button
              onClick={() => setAllowRegister(!allowRegister)}
              className={`w-12 h-6 rounded-full transition-all relative ${
                allowRegister
                  ? 'bg-[var(--gold)]'
                  : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  allowRegister ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-2">新用户默认算力</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={defaultUserPower}
                onChange={(e) => setDefaultUserPower(parseInt(e.target.value) || 0)}
                className="w-32 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
              />
              <span className="text-sm text-[var(--text-muted)]">点</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-2">会话超时时间</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 0)}
                className="w-32 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
              />
              <span className="text-sm text-[var(--text-muted)]">小时</span>
            </div>
          </div>
        </div>
      </div>

      {/* 文件设置 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 mb-6">
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-[var(--gold)]" />
          文件与存储
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-2">最大上传大小</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={maxUploadSize}
                onChange={(e) => setMaxUploadSize(parseInt(e.target.value) || 0)}
                className="w-32 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
              />
              <span className="text-sm text-[var(--text-muted)]">MB</span>
            </div>
          </div>
          <div>
            <label className="text-sm text-[var(--text-muted)] block mb-2">存储路径</label>
            <input
              type="text"
              value="F:\\dunhuang-design\\uploads"
              readOnly
              className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-muted)] cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* 系统维护 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 mb-6">
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[var(--gold)]" />
          系统维护
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)]">维护模式</p>
              <p className="text-xs text-[var(--text-muted)]">开启后普通用户无法访问</p>
            </div>
            <button
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`w-12 h-6 rounded-full transition-all relative ${
                maintenanceMode
                  ? 'bg-[var(--error)]'
                  : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  maintenanceMode ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex gap-3">
            <button className="px-4 py-2 bg-[var(--error)]/20 text-[var(--error)] rounded-lg text-sm hover:bg-[var(--error)]/30 transition-all">
              清理缓存
            </button>
            <button className="px-4 py-2 bg-[var(--gold)]/20 text-[var(--gold)] rounded-lg text-sm hover:bg-[var(--gold)]/30 transition-all">
              备份数据库
            </button>
            <button className="px-4 py-2 bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-lg text-sm hover:bg-[var(--bg-hover)] transition-all border border-[var(--border-color)]">
              查看日志
            </button>
          </div>
        </div>
      </div>

      {/* 日志设置 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 mb-6">
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[var(--gold)]" />
          日志与监控
        </h2>

        <div>
          <label className="text-sm text-[var(--text-muted)] block mb-2">日志级别</label>
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value)}
            className="w-48 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
          >
            <option value="debug">Debug - 调试</option>
            <option value="info">Info - 信息</option>
            <option value="warn">Warn - 警告</option>
            <option value="error">Error - 错误</option>
          </select>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end gap-3">
        <button className="px-6 py-2 bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-hover)] transition-all border border-[var(--border-color)]">
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[var(--gold)] text-black rounded-lg font-medium hover:bg-[var(--gold-hover)] transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            '保存设置'
          )}
        </button>
      </div>
    </>
  );
}
