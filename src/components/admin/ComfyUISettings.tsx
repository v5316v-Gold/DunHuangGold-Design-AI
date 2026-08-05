'use client';

import React, { useState } from 'react';

import { 
  Server, Workflow,
  CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import ComfyUIConnectionManager from './ComfyUIConnectionManager';
import ComfyUIWorkflowConfig from './ComfyUIWorkflowConfig';

type TabType = 'connections' | 'workflows';

export default function ComfyUISettings() {
  const [activeTab, setActiveTab] = useState<TabType>('connections');
  const [overallStatus, setOverallStatus] = useState<{
    online: boolean;
    connection?: { name: string; host: string };
    version?: string;
    gpu?: string;
    error?: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  // 检查整体 ComfyUI 状态
  const checkOverallStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/comfyui/call', { credentials: 'include' });
      const data = await res.json();
      setOverallStatus(data);
    } catch (e) {
      setOverallStatus({
        online: false,
        error: '检查失败',
      });
    } finally {
      setChecking(false);
    }
  };

  React.useEffect(() => {
    checkOverallStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* 整体状态栏 */}
      <div className={`p-4 rounded-xl border flex items-center justify-between ${
        overallStatus?.online
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-red-500/30 bg-red-500/5'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            overallStatus?.online
              ? 'bg-green-500/20'
              : 'bg-red-500/20'
          }`}>
            {checking ? (
              <RefreshCw className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
            ) : overallStatus?.online ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-primary)]">
                ComfyUI {overallStatus?.online ? '在线' : '离线'}
              </span>
              {overallStatus?.version && (
                <span className="text-xs text-[var(--text-muted)]">
                  v{overallStatus.version}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              {overallStatus?.online ? (
                overallStatus.connection 
                  ? `${overallStatus.connection.name} (${overallStatus.connection.host})`
                  : '使用默认连接'
              ) : (
                overallStatus?.error || '请检查连接配置'
              )}
              {overallStatus?.gpu && (
                <span className="ml-2">| {overallStatus.gpu}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkOverallStatus}
            disabled={checking}
            className="px-3 py-1.5 text-sm bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-lg flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-[var(--border-color)] pb-0">
        <button
          onClick={() => setActiveTab('connections')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'connections'
              ? 'border-[var(--gold)] text-[var(--gold)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Server className="w-4 h-4" />
          连接管理
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'workflows'
              ? 'border-[var(--gold)] text-[var(--gold)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Workflow className="w-4 h-4" />
          工作流配置
        </button>
      </div>

      {/* Tab 内容 */}
      <div className="pt-2">
        {activeTab === 'connections' ? (
          <ComfyUIConnectionManager />
        ) : (
          <ComfyUIWorkflowConfig />
        )}
      </div>
    </div>
  );
}
