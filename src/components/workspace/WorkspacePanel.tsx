'use client';

import { Suspense } from 'react';
import { Image } from 'lucide-react';
import { featureComponents } from '@/lib/feature-registry';
import { useFeatures } from '@/lib/use-features';

interface WorkspacePanelProps {
  activePanel: string;
  power: number;
  onDeductPower: (amount: number, reason: string) => void;
}

function LoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-muted)]">加载中...</p>
      </div>
    </div>
  );
}

export default function WorkspacePanel({
  activePanel,
  power,
  onDeductPower,
}: WorkspacePanelProps) {
  // 从 /api/features 读取功能配置（启用状态），组件映射走统一 registry
  const { features, loading } = useFeatures();

  // 功能开关控制：若功能在配置中存在且被禁用，则显示"已停用"而非组件
  const featureMeta = features.find((f) => f.id === activePanel);
  // 模块级 registry 取值（引用稳定，满足 React 规则）
  const ActivePanelComponent = featureComponents[activePanel];

  // 未注册组件 → 开发中占位
  if (!ActivePanelComponent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <Image
            className="w-16 h-16 text-[var(--text-dim)] mx-auto mb-4 opacity-30"
            role="img"
            aria-label="功能模块"
          />
          <p className="text-[var(--text-muted)]">功能模块开发中...</p>
        </div>
      </div>
    );
  }

  // 配置明确禁用 → 停用占位（即使组件存在）
  if (!loading && featureMeta && featureMeta.enabled === false) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <Image
            className="w-16 h-16 text-[var(--text-dim)] mx-auto mb-4 opacity-30"
            role="img"
            aria-label="功能已停用"
          />
          <p className="text-[var(--text-muted)]">
            「{featureMeta.name || activePanel}」已由管理员停用
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ActivePanelComponent power={power} onDeductPower={onDeductPower} />
    </Suspense>
  );
}
