/**
 * P1-1 验收测试 - 15 个 AI 服务全部注册到 registry
 *
 * 这是一个集成测试：验证 services/index.ts 的所有 import 都生效
 *
 * 运行命令：npx vitest run --config vitest.node.config.ts src/test/ai-services.test.ts
 * 用 node 环境（而非 jsdom），因为 ai-service 依赖 Node.js 内置模块（fs/path/os）
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('P1-1: AI 服务注册完整性', () => {
  let registry: { has: (t: string) => boolean; list: () => Array<{ type: string; label: string; powerCost: number; requiresImage: boolean }> };

  beforeAll(async () => {
    // 触发注册：导入 services/index.ts
    await import('@/lib/ai-service/services');
    const { registry: r } = await import('@/lib/ai-service/service-registry');
    registry = r;
  });

  const EXPECTED_SERVICES = [
    { type: 'text2img', label: '文生图', powerCost: 10, requiresImage: false },
    { type: 'refine', label: '产品精修', powerCost: 15, requiresImage: true },
    { type: 'relief', label: '浮雕设计', powerCost: 20, requiresImage: true },
    { type: 'sketch', label: '线稿写实', powerCost: 15, requiresImage: true },
    { type: 'blend', label: '多图融合', powerCost: 15, requiresImage: true },
    { type: 'removebg', label: '移除背景', powerCost: 5, requiresImage: true },
    { type: 'upscale', label: '高清放大', powerCost: 5, requiresImage: true },
    { type: 'watermark', label: '去除水印', powerCost: 5, requiresImage: true },
    { type: 'image3d', label: '图转3D', powerCost: 30, requiresImage: true },
    { type: 'multiview', label: '多视图', powerCost: 20, requiresImage: true },
    { type: 'oneclick', label: '一键设计', powerCost: 15, requiresImage: false },
    { type: 'free', label: '自由创作', powerCost: 15, requiresImage: false },
    { type: 'text2video', label: '文生视频', powerCost: 50, requiresImage: false },
    { type: 'img2video', label: '图生视频', powerCost: 40, requiresImage: true },
    { type: 'stereo', label: '平面转雕塑', powerCost: 25, requiresImage: true },
    { type: 'dialogue', label: 'AI 对话', powerCost: 2, requiresImage: false },
    { type: 'ai-assistant', label: 'AI 助手', powerCost: 3, requiresImage: false },
  ];

  it('registry 应该注册 17 个服务', () => {
    const all = registry!.list();
    expect(all.length).toBe(17);
  });

  it.each(EXPECTED_SERVICES)(
    '服务 $type 应注册成功且配置正确',
    ({ type, label, powerCost, requiresImage }) => {
      expect(registry!.has(type)).toBe(true);
      const config = registry!.list().find((s) => s.type === type);
      expect(config).toBeDefined();
      expect(config!.label).toBe(label);
      expect(config!.powerCost).toBe(powerCost);
      expect(config!.requiresImage).toBe(requiresImage);
    }
  );

  it('每个服务都有 execute 函数', () => {
    for (const s of registry!.list()) {
      expect(typeof (s as unknown as { execute: unknown }).execute).toBe('function');
    }
  });
});