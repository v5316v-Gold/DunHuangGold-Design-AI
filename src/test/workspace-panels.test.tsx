/**
 * Stage 2 · 17 个 workspace 面板组件单测
 *
 * 目标：验证每个功能面板在 jsdom 下能挂载、渲染标题、具备可交互控件，
 *       并对关键面板的「真实反馈」（空输入/未上传 → 主按钮禁用）做断言。
 *
 * 隔离策略：mock 掉所有涉及网络/IndexedDB/文件读写的 hooks，
 *          使组件在纯 jsdom 环境确定性渲染，不依赖后端/ComfyUI/云 API。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import type { WorkspaceProps } from '@/constants/workspace';

/* ============================ 依赖 mock ============================ */

// next/image → 普通 <img>，规避 Next 图片优化在 jsdom 的报错
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src?: unknown; alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : ''} alt={alt ?? ''} />
  ),
}));

// sonner toast（含 .error/.success 等静态方法，避免调用时抛错）
vi.mock('sonner', () => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  });
  return { toast, Toaster: () => null };
});

vi.mock('@/hooks/useAiGeneration', () => ({
  useAiGeneration: () => ({
    isGenerating: false,
    progress: 0,
    error: null,
    generate: vi.fn().mockResolvedValue(null),
    reset: vi.fn(),
    setError: vi.fn(),
    setProgress: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGenerationHistory', () => ({
  useGenerationHistory: () => ({
    history: [],
    isLoading: false,
    error: null,
    addToHistory: vi.fn(),
    removeFromHistory: vi.fn(),
    removeWithUndo: vi.fn(),
    clearHistory: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    uploadedImage: null,
    uploadedImages: [],
    files: null,
    isDragging: false,
    error: null,
    handleDrop: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleFileSelect: vi.fn(),
    processFile: vi.fn(),
    clear: vi.fn(),
    setError: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePromptOptimize', () => ({
  usePromptOptimize: () => ({ handleOptimizePrompt: vi.fn() }),
}));

vi.mock('@/hooks/usePromptTranslate', () => ({
  usePromptTranslate: () => ({ handleTranslatePrompt: vi.fn() }),
}));

vi.mock('@/hooks/useDownload', () => ({
  useDownload: () => ({ handleDownload: vi.fn() }),
}));

// api-client：保留 API_ROUTES 等常量，stub 掉请求方法（避免 AIDialog 挂载时重试退避）
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  const ok = { success: true, data: {} };
  return {
    ...actual,
    apiClient: {
      get: vi.fn().mockResolvedValue(ok),
      post: vi.fn().mockResolvedValue(ok),
      put: vi.fn().mockResolvedValue(ok),
      patch: vi.fn().mockResolvedValue(ok),
      delete: vi.fn().mockResolvedValue(ok),
    },
  };
});

/* ============================ 面板导入 ============================ */

import Text2Image from '@/components/workspace/Text2Image';
import AIDialog from '@/components/workspace/AIDialog';
import ReliefDesign from '@/components/workspace/ReliefDesign';
import Image3D from '@/components/workspace/Image3D';
import Dialog2D3D from '@/components/workspace/Dialog2D3D';
import ProductRefine from '@/components/workspace/ProductRefine';
import MultiImage from '@/components/workspace/MultiImage';
import OneClickDesign from '@/components/workspace/OneClickDesign';
import MultiView from '@/components/workspace/MultiView';
import SketchRealistic from '@/components/workspace/SketchRealistic';
import FreeCreation from '@/components/workspace/FreeCreation';
import Text2Video from '@/components/workspace/Text2Video';
import Image2Video from '@/components/workspace/Image2Video';
import RemoveBackground from '@/components/workspace/RemoveBackground';
import Upscale from '@/components/workspace/Upscale';
import RemoveWatermark from '@/components/workspace/RemoveWatermark';
import TryOnEffect from '@/components/workspace/TryOnEffect';

/* ============================ 面板表 ============================ */

interface PanelEntry {
  id: string;
  title: string;
  Component: ComponentType<WorkspaceProps>;
  /** 标题是否为 heading（h2/h3）角色；Dialog2D3D 无标题 heading，用首屏 label 定位 */
  isHeading?: boolean;
}

const PANELS: PanelEntry[] = [
  { id: 'text2img', title: '文案生图', Component: Text2Image },
  { id: 'dialogue', title: '敦煌 AI 助手', Component: AIDialog },
  { id: 'relief', title: '图转浮雕图', Component: ReliefDesign },
  { id: 'image3d', title: '3D 模型', Component: Image3D },
  { id: '2dto3d', title: '主体图片', Component: Dialog2D3D, isHeading: false },
  { id: 'refine', title: '产品精修', Component: ProductRefine },
  { id: 'blend', title: '多图融合', Component: MultiImage },
  { id: 'oneclick', title: '一键设计', Component: OneClickDesign },
  { id: 'multiview', title: '生成多视图', Component: MultiView },
  { id: 'sketch', title: '线稿转写实', Component: SketchRealistic },
  { id: 'free', title: '自由创作区', Component: FreeCreation },
  { id: 'text2video', title: '文生视频', Component: Text2Video },
  { id: 'img2video', title: '图生视频', Component: Image2Video },
  { id: 'removebg', title: '移除背景', Component: RemoveBackground },
  { id: 'upscale', title: '高清放大', Component: Upscale },
  { id: 'watermark', title: '去除水印', Component: RemoveWatermark },
  { id: 'tryon', title: '佩戴效果', Component: TryOnEffect },
];

const defaultProps: WorkspaceProps = { power: 1000, onDeductPower: vi.fn() };

/* ============================ 用例 ============================ */

describe('Stage 2 · 17 个 workspace 面板', () => {
  describe.each(PANELS)('$id · $title', ({ title, Component, isHeading }) => {
    it('渲染标题', async () => {
      render(<Component {...defaultProps} />);
      // heading 角色精确命中标题，避免「移除背景」等同时匹配按钮/空状态文案
      const el = isHeading === false
        ? await screen.findByText(title)
        : await screen.findByRole('heading', { name: title });
      expect(el).toBeInTheDocument();
    });

    it('包含可交互控件（按钮）', () => {
      render(<Component {...defaultProps} />);
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });
});

describe('真实反馈 · 主操作按钮状态', () => {
  it('text2img：空提示词 → 「开始生成」禁用', async () => {
    render(<Text2Image {...defaultProps} />);
    await screen.findByText('文案生图');
    expect(screen.getByRole('button', { name: /开始生成/ })).toBeDisabled();
  });

  it('text2video：空描述 → 「生成视频」禁用', async () => {
    render(<Text2Video {...defaultProps} />);
    await screen.findByText('文生视频');
    expect(screen.getByRole('button', { name: /生成视频/ })).toBeDisabled();
  });

  it('img2video：未上传首帧 → 「开始生成」禁用', async () => {
    render(<Image2Video {...defaultProps} />);
    await screen.findByText('图生视频');
    expect(screen.getByRole('button', { name: /开始生成/ })).toBeDisabled();
  });

  it('2dto3d：未上传图片 → 「开始生成」禁用', async () => {
    render(<Dialog2D3D {...defaultProps} />);
    await screen.findByText('主体图片');
    expect(screen.getByRole('button', { name: /开始生成/ })).toBeDisabled();
  });

  it('upscale（ImageWorkspace）：未上传图片 → 「开始增强」禁用', async () => {
    render(<Upscale {...defaultProps} />);
    await screen.findByText('高清放大');
    expect(screen.getByRole('button', { name: /开始增强/ })).toBeDisabled();
  });

  it('dialogue：空输入 → 「发送」禁用，且「新建对话」可用', async () => {
    render(<AIDialog {...defaultProps} />);
    await screen.findByText('敦煌 AI 助手');
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /新建对话/ })).toBeEnabled();
  });
});
