/**
 * LoRA Manager（W2 占位实现）
 *
 * 当前：内存实现（重启丢失）
 * W3：替换为 DB + 文件系统实现
 */

import type { ILoraPort, LoraInfo } from '../port';
import type { AIServiceType } from '@/lib/ai-service/types';

export class InMemoryLoraManager implements ILoraPort {
  readonly name = 'lora-in-memory';

  private loras: LoraInfo[] = [];

  async loadActiveLoras(_serviceType: AIServiceType): Promise<LoraInfo[]> {
    return this.loras;
  }

  injectIntoWorkflow(workflowJson: unknown, loras: LoraInfo[]): unknown {
    if (!loras.length) return workflowJson;
    const wf = JSON.parse(JSON.stringify(workflowJson));

    // 找到 LoRALoader 节点
    for (const [id, node] of Object.entries(wf as Record<string, any>)) {
      if (node.class_type === 'LoRALoader') {
        const lora = loras[0];  // 简化：只挂第一个
        if (lora) {
          node.inputs.lora_name = lora.filePath;
          node.inputs.strength_model = 0.8;
          node.inputs.strength_clip = 0.8;
        }
      }
    }
    return wf;
  }

  injectTriggers(prompt: string, loras: LoraInfo[]): string {
    if (!loras.length) return prompt;
    const triggers = loras.flatMap((l) => l.triggerWords).join(', ');
    return `${triggers}, ${prompt}`;
  }

  /** 测试用：注册 LoRA */
  register(lora: LoraInfo): void {
    this.loras.push(lora);
  }
}