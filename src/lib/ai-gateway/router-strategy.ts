/**
 * AI Gateway Router 策略层
 *
 * 借鉴 litellm Router 的多策略路由设计：
 * - priority: 按配置优先级（默认，兼容现有 executor 链）
 * - least_busy: 选当前负载最低的 provider（对齐 litellm least_busy）
 * - lowest_latency: 选最近延迟最低的 provider（对齐 litellm lowest_latency）
 * - fallback_only: 仅按降级链顺序（对齐 litellm fallback）
 *
 * 与现有 FeatureOrchestrator 的关系：
 * - Orchestrator 负责"执行链"（executor 类型级别）
 * - Router 负责"provider 选择"（同一 executor 内的具体 provider）
 * - 二者叠加：Orchestrator 选 executor，Router 选 provider
 */

export type RouterStrategy = 'priority' | 'least_busy' | 'lowest_latency' | 'fallback_only';

export interface ProviderStats {
  /** provider 标识 */
  provider: string;
  /** 当前进行中的请求数 */
  inflight: number;
  /** 最近一次调用延迟（ms） */
  lastLatencyMs: number;
  /** 累计成功次数 */
  successCount: number;
  /** 累计失败次数 */
  failCount: number;
  /** 是否健康（熔断状态） */
  healthy: boolean;
  /** 最近失败时间戳（ms） */
  lastFailAt?: number;
}

export interface RouterConfig {
  /** 路由策略 */
  strategy: RouterStrategy;
  /** provider 优先级链（priority/fallback_only 用） */
  priorityChain: string[];
  /** 熔断阈值：连续失败 N 次熔断 */
  failThreshold: number;
  /** 熔断冷却时间（ms） */
  cooldownMs: number;
  /** 统计窗口（least_busy/lowest_latency 用） */
  windowMs: number;
}

export class AIGatewayRouter {
  private stats = new Map<string, ProviderStats>();
  private configs = new Map<string, RouterConfig>();

  /**
   * 注册一个功能的路由配置
   */
  register(featureId: string, config: RouterConfig): void {
    this.configs.set(featureId, config);
    // 初始化所有 provider 统计
    for (const p of config.priorityChain) {
      if (!this.stats.has(p)) {
        this.stats.set(p, {
          provider: p,
          inflight: 0,
          lastLatencyMs: 0,
          successCount: 0,
          failCount: 0,
          healthy: true,
        });
      }
    }
  }

  /**
   * 选择当前应使用的 provider
   *
   * 流程：
   * 1. 过滤不健康的 provider（熔断中）
   * 2. 按策略排序候选
   * 3. 返回第一个
   */
  async select(featureId: string): Promise<string | null> {
    const config = this.configs.get(featureId);
    if (!config) return null;

    // 1. 过滤健康 provider（检查冷却期）
    const candidates = config.priorityChain.filter((p) => {
      const s = this.stats.get(p);
      if (!s) return false;
      if (!s.healthy) return false;
      // 熔断冷却检查
      if (s.lastFailAt && Date.now() - s.lastFailAt < config.cooldownMs && s.failCount >= config.failThreshold) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) return null;

    // 2. 按策略排序
    switch (config.strategy) {
      case 'least_busy':
        // 负载最低优先
        return candidates.sort(
          (a, b) => (this.stats.get(a)?.inflight ?? 0) - (this.stats.get(b)?.inflight ?? 0)
        )[0];

      case 'lowest_latency':
        // 延迟最低优先（无数据时保持优先级）
        return candidates.sort((a, b) => {
          const la = this.stats.get(a)?.lastLatencyMs ?? Infinity;
          const lb = this.stats.get(b)?.lastLatencyMs ?? Infinity;
          if (la === lb) return config.priorityChain.indexOf(a) - config.priorityChain.indexOf(b);
          return la - lb;
        })[0];

      case 'priority':
      case 'fallback_only':
      default:
        // 按配置优先级
        return candidates.sort(
          (a, b) => config.priorityChain.indexOf(a) - config.priorityChain.indexOf(b)
        )[0];
    }
  }

  /**
   * 调用开始：记录 inflight +1
   */
  begin(provider: string): void {
    const s = this.stats.get(provider);
    if (s) s.inflight += 1;
  }

  /**
   * 调用结束：记录延迟 + 成功/失败
   */
  end(provider: string, success: boolean, latencyMs: number): void {
    const s = this.stats.get(provider);
    if (!s) return;
    s.inflight = Math.max(0, s.inflight - 1);
    s.lastLatencyMs = latencyMs;

    if (success) {
      s.successCount += 1;
      s.failCount = 0;          // 成功重置失败计数
      s.healthy = true;
      s.lastFailAt = undefined;
    } else {
      s.failCount += 1;
      s.lastFailAt = Date.now();  // 记录失败时间戳
      // 连续失败达到阈值 → 熔断
      if (s.failCount >= (this.configs.get('__global__')?.failThreshold ?? 3)) {
        s.healthy = false;
      }
    }
  }

  /**
   * 获取所有 provider 统计（可观测性用）
   */
  getStats(): Record<string, ProviderStats> {
    return Object.fromEntries(this.stats);
  }
}

// 全局单例
export const gatewayRouter = new AIGatewayRouter();
