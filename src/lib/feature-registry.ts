/**
 * 功能注册表（统一入口）
 *
 * 目标：Sidebar、WorkspacePanel、Orchestrator、DB 使用同一套 feature_code。
 * 本文件是"组件层"注册表：负责把 feature_code → React 组件 的静态映射集中管理。
 *
 * 说明：
 *   - dynamic import 需要静态路径，无法从 DB 配置动态生成，
 *     因此组件映射保留为静态注册（此处集中，不散落在各页面）。
 *   - 功能元数据（名称/分组/算力/开关）来自 /api/features（DB 或静态配置兜底）。
 *   - 任何新功能只需在此注册组件 + 在 src/config/features.ts 加定义，
 *     即自动出现在 Sidebar / WorkspacePanel / Orchestrator 可见层。
 */

import { lazy, type ComponentType } from 'react';
import type { WorkspaceProps } from '@/constants/workspace';

// ==================== 组件注册 ====================

const Text2Image = lazy(() => import('@/components/workspace/Text2Image'));
const AIDialog = lazy(() => import('@/components/workspace/AIDialog'));
const ReliefDesign = lazy(() => import('@/components/workspace/ReliefDesign'));
const Image3D = lazy(() => import('@/components/workspace/Image3D'));
const Dialog2D3D = lazy(() => import('@/components/workspace/Dialog2D3D'));
const ProductRefine = lazy(() => import('@/components/workspace/ProductRefine'));
const MultiImage = lazy(() => import('@/components/workspace/MultiImage'));
const OneClickDesign = lazy(() => import('@/components/workspace/OneClickDesign'));
const MultiView = lazy(() => import('@/components/workspace/MultiView'));
const SketchRealistic = lazy(() => import('@/components/workspace/SketchRealistic'));
const FreeCreation = lazy(() => import('@/components/workspace/FreeCreation'));
const Text2Video = lazy(() => import('@/components/workspace/Text2Video'));
const Image2Video = lazy(() => import('@/components/workspace/Image2Video'));
const RemoveBackground = lazy(() => import('@/components/workspace/RemoveBackground'));
const Upscale = lazy(() => import('@/components/workspace/Upscale'));
const RemoveWatermark = lazy(() => import('@/components/workspace/RemoveWatermark'));
const TryOnEffect = lazy(() => import('@/components/workspace/TryOnEffect'));

/**
 * feature_code → 组件 静态映射（唯一真源）
 *
 * ⚠️ key 必须与以下保持一致：
 *   - src/config/features.ts 的 FEATURE_DEFINITIONS.id
 *   - src/config/api-config.ts 的 FEATURE_API_MAP / featureConfigs.id
 *   - src/db/schema/features.ts 的 features.id
 *   - Sidebar 的 LABEL_MAP / ICON_MAP
 */
export const featureComponents: Record<string, ComponentType<WorkspaceProps>> = {
  text2img: Text2Image,
  dialogue: AIDialog,
  relief: ReliefDesign,
  image3d: Image3D,
  '2dto3d': Dialog2D3D,
  refine: ProductRefine,
  blend: MultiImage,
  oneclick: OneClickDesign,
  multiview: MultiView,
  sketch: SketchRealistic,
  free: FreeCreation,
  text2video: Text2Video,
  img2video: Image2Video,
  removebg: RemoveBackground,
  upscale: Upscale,
  watermark: RemoveWatermark,
  tryon: TryOnEffect,
};

/**
 * 组件层已注册的 feature_code 集合
 * 用于一致性校验：与配置层对比，发现"配置有但组件无"或"组件有但配置无"
 */
export const registeredFeatureCodes: readonly string[] = Object.keys(featureComponents);

/** 获取 feature_code 对应组件（未注册返回 undefined） */
export function getFeatureComponent(code: string): ComponentType<WorkspaceProps> | undefined {
  return featureComponents[code];
}

/** 是否已注册 */
export function isFeatureRegistered(code: string): boolean {
  return code in featureComponents;
}
