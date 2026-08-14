'use client';

/**
 * Phase 9.23 · ComfyUI 设置（仅保留"工作流配置"）
 *
 * 文档约束（docs §3.2）：
 *  - 移除"连接管理"tab（连接状态统一在"系统健康"展示）
 *  - 本地 ComfyUI 下仅保留"工作流配置"（上传、版本、依赖解析、Feature Binding）
 *  - 顶部状态卡保留（连接状态简化展示，详细见系统健康）
 */

import React from 'react';
import { Workflow } from 'lucide-react';
import ComfyUIWorkflowConfig from './ComfyUIWorkflowConfig';

export default function ComfyUISettings() {
  // Phase 9.23 收口：仅一个 tab，直接展示工作流配置
  // （连接状态由 /admin/system 查看）
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-color)]">
        <Workflow className="w-5 h-5 text-[var(--gold)]" />
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">工作流配置</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            上传 Workflow JSON → 依赖解析 → 发布门禁 → 绑定 Feature → 启用
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            连接状态、ComfyUI 版本、GPU/VRAM 等详细信息请查看 <a href="/admin/system" className="text-[var(--gold)] hover:underline">系统健康</a>
          </p>
        </div>
      </div>

      {/* 直接展示工作流配置（无 Tab 切换） */}
      <ComfyUIWorkflowConfig />
    </div>
  );
}