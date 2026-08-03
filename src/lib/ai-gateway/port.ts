/**
 * AI Gateway Port 接口（Hexagonal 架构）
 *
 * 职责：定义 AI 服务的接口契约，与具体实现解耦
 *
 * 依赖规则：
 * - Port 只定义接口，不依赖 Adapter
 * - Adapter 实现 Port，可以替换
 * - Use Case 依赖 Port，不知道具体 Adapter
 *
 * 这是一个渐进式重构：新文件，不动旧代码
 * 旧 ServiceConfig 仍可用，未来逐步迁移
 */

import type { AIServiceType, GenerationResult } from '@/lib/ai-service/types';

// ============================================================
// Port: AI 生成
// ============================================================

export interface GenerationRequest {
  service: AIServiceType;
  prompt?: string;
  image?: string;
  images?: string[];
  width?: number;
  height?: number;
  count?: number;
  resolution?: string;
  ratio?: string;
  [key: string]: unknown;
}

export interface IAIGenerationPort {
  /** Port 唯一标识 */
  readonly name: string;
  /** 是否可用（健康检查） */
  isAvailable(): Promise<boolean>;
  /** 执行生成 */
  execute(req: GenerationRequest): Promise<GenerationResult>;
}

// ============================================================
// Port: LoRA 管理
// ============================================================

export interface LoraInfo {
  id: string;
  name: string;
  triggerWords: string[];
  filePath: string;
  baseModel?: string;
}

export interface ILoraPort {
  readonly name: string;
  /** 加载某服务启用的 LoRA */
  loadActiveLoras(serviceType: AIServiceType): Promise<LoraInfo[]>;
  /** 把 LoRA 列表注入到 ComfyUI 工作流 JSON */
  injectIntoWorkflow(workflowJson: unknown, loras: LoraInfo[]): unknown;
  /** 把触发词拼接到 prompt */
  injectTriggers(prompt: string, loras: LoraInfo[]): string;
}

// ============================================================
// Port: 工作流管理
// ============================================================

export interface WorkflowInfo {
  id: string;
  name: string;
  serviceType: AIServiceType;
  version: number;
  workflowJson: unknown;
  inputSchema?: unknown;
  enabled: boolean;
}

export interface IWorkflowPort {
  readonly name: string;
  /** 加载某服务的默认工作流 */
  loadDefault(serviceType: AIServiceType): Promise<WorkflowInfo | null>;
  /** 列出所有启用的工作流 */
  listEnabled(): Promise<WorkflowInfo[]>;
}

// ============================================================
// Port: 算力
// ============================================================

export interface IPowerPort {
  readonly name: string;
  /** 冻结算力（任务入队时） */
  freeze(userId: string, taskId: string, amount: number): Promise<boolean>;
  /** 实扣算力（任务完成时） */
  deduct(userId: string, taskId: string): Promise<boolean>;
  /** 解冻算力（任务失败/取消时） */
  unfreeze(userId: string, taskId: string): Promise<boolean>;
}

// ============================================================
// Port: 存储
// ============================================================

export interface IStoragePort {
  readonly name: string;
  /** 保存生成的图片到本地 */
  saveImage(url: string): Promise<string | null>;
  /** 保存到对象存储 */
  saveToCloud(buffer: Buffer, filename: string): Promise<string>;
}