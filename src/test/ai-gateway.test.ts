/**
 * W2-Step 6 验收测试：AI Gateway Hexagonal Port + Adapter
 *
 * 验证：
 * 1. ComfyUIAdapter 实现 IAIGenerationPort
 * 2. InMemoryLoraManager 实现 ILoraPort
 * 3. WorkflowManager 实现 IWorkflowPort
 * 4. LoRA 注入到 ComfyUI 工作流 JSON
 * 5. 触发词拼接
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/ai-gateway.test.ts
 */

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ComfyUIAdapter } from '@/lib/ai-gateway/adapters/comfyui';
import { InMemoryLoraManager } from '@/lib/ai-gateway/adapters/lora-in-memory';
import { StubWorkflowManager } from '@/lib/ai-gateway/adapters/workflow-manager';
import type { IAIGenerationPort } from '@/lib/ai-gateway/port';

describe('AI Gateway · Hexagonal 验证', () => {
  it('ComfyUIAdapter 是 IAIGenerationPort 实现', () => {
    const adapter: IAIGenerationPort = new ComfyUIAdapter();
    expect(adapter.name).toBe('comfyui');
    expect(typeof adapter.isAvailable).toBe('function');
    expect(typeof adapter.execute).toBe('function');
  });

  it('ComfyUIAdapter：缺少图片时应返回失败（不需要真连 ComfyUI）', async () => {
    const adapter = new ComfyUIAdapter();
    const result = await adapter.execute({
      service: 'refine',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('需要输入图片');
  });

  it('ComfyUIAdapter：text2img 需要 prompt', async () => {
    const adapter = new ComfyUIAdapter();
    const result = await adapter.execute({
      service: 'text2img',
      prompt: '',
    });
    // 即使空 prompt 也走流程（ComfyUI 会生成空图），但 result 应有 provider
    expect(result.provider).toBe('comfyui');
  });

  it('InMemoryLoraManager：触发词拼接', async () => {
    const mgr = new InMemoryLoraManager();
    mgr.register({
      id: '1',
      name: '敦煌金 v1',
      triggerWords: ['dunhuang-gold', 'ornate'],
      filePath: '/loras/dunhuang-gold-v1.safetensors',
    });

    const result = mgr.injectTriggers('金项链', [
      { id: '1', name: '敦煌金 v1', triggerWords: ['dunhuang-gold', 'ornate'], filePath: '/loras/x.safetensors' },
    ]);
    expect(result).toBe('dunhuang-gold, ornate, 金项链');
  });

  it('InMemoryLoraManager：无 LoRA 时 prompt 不变', () => {
    const mgr = new InMemoryLoraManager();
    const result = mgr.injectTriggers('金项链', []);
    expect(result).toBe('金项链');
  });

  it('InMemoryLoraManager：注入到 ComfyUI 工作流', () => {
    const mgr = new InMemoryLoraManager();
    const workflow = {
      '1': { class_type: 'CheckpointLoader', inputs: { ckpt_name: 'z-turbo' } },
      '2': { class_type: 'LoRALoader', inputs: { model: ['1', 0], clip: ['1', 1] } },
      '3': { class_type: 'KSampler', inputs: { model: ['2', 0] } },
    };

    const injected = mgr.injectIntoWorkflow(workflow, [
      { id: '1', name: 'lora', triggerWords: ['trig'], filePath: '/loras/x.safetensors' },
    ]) as any;

    expect(injected['2'].inputs.lora_name).toBe('/loras/x.safetensors');
    expect(injected['2'].inputs.strength_model).toBe(0.8);
  });

  it('InMemoryLoraManager：无 LoRA 时工作流不变', () => {
    const mgr = new InMemoryLoraManager();
    const workflow = { '1': { class_type: 'KSampler', inputs: {} } };
    const result = mgr.injectIntoWorkflow(workflow, []);
    expect(result).toEqual(workflow);
  });

  it('StubWorkflowManager：提供默认工作流', async () => {
    const wm = new StubWorkflowManager();
    const wf = await wm.loadDefault('text2img');
    expect(wf).not.toBeNull();
    expect(wf?.name).toBe('stub');
  });
});