/**
 * Provider 健康检查 + 熔断器
 *
 * 借鉴 litellm 的 Router health check 设计：
 * - DEFAULT_HEALTH_CHECK_INTERVAL: 定时健康检查
 * - 失败熔断：连续失败后进入熔断期
 * - 冷却后自动恢复（半开状态）
 *
 * 职责：
 * 1. 对每个 provider 提供健康探针
 * 2. 自动熔断/恢复
 * 3. 供 Router.select() 判断可用性
 */

import { gatewayRouter } from './router-strategy';

// 借鉴 litellm constants：DEFAULT_HEALTH_CHECK_INTERVAL
const HEALTH_CHECK_INTERVAL = 30_000;   // 30s 定时检查
const COOLDOWN_MS = 60_000;             // 熔断冷却 60s
const FAIL_THRESHOLD = 3;               // 连续 3 次失败熔断

export interface HealthProbe {
  /** provider 标识 */
  provider: string;
  /** 健康检查函数（真实调用前做 ping） */
  check: () => Promise<boolean>;
}

export interface HealthStatus {
  provider: string;
  healthy: boolean;
  lastCheckAt: number;
  lastLatencyMs: number;
  consecutiveFailures: number;
}

export class ProviderHealthMonitor {
  private probes = new Map<string, HealthProbe>();
  private status = new Map<string, HealthStatus>();
  private timer: NodeJS.Timeout | null = null;

  /**
   * 注册健康探针
   */
  register(probe: HealthProbe): void {
    this.probes.set(probe.provider, probe);
    this.status.set(probe.provider, {
      provider: probe.provider,
      healthy: true,
      lastCheckAt: 0,
      lastLatencyMs: 0,
      consecutiveFailures: 0,
    });
  }

  /**
   * 启动定时健康检查
   */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkAll(), HEALTH_CHECK_INTERVAL);
    // 启动后立即检查一次
    void this.checkAll();
  }

  /**
   * 停止定时检查
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 检查所有 provider 健康状态
   */
  async checkAll(): Promise<void> {
    const entries = [...this.probes.entries()];
    await Promise.all(entries.map(([_, probe]) => this.checkOne(probe)));
  }

  /**
   * 检查单个 provider
   */
  async checkOne(probe: HealthProbe): Promise<HealthStatus> {
    const status = this.status.get(probe.provider)!;
    const start = Date.now();

    try {
      const ok = await probe.check();
      status.lastLatencyMs = Date.now() - start;
      status.lastCheckAt = Date.now();

      if (ok) {
        status.consecutiveFailures = 0;
        status.healthy = true;
      } else {
        status.consecutiveFailures += 1;
        if (status.consecutiveFailures >= FAIL_THRESHOLD) {
          status.healthy = false;  // 熔断
        }
      }
    } catch {
      status.consecutiveFailures += 1;
      status.lastCheckAt = Date.now();
      if (status.consecutiveFailures >= FAIL_THRESHOLD) {
        status.healthy = false;
      }
    }

    return status;
  }

  /**
   * 手动标记一次调用失败（供真实调用失败时同步）
   */
  recordFailure(provider: string): void {
    const status = this.status.get(provider);
    if (!status) return;
    status.consecutiveFailures += 1;
    if (status.consecutiveFailures >= FAIL_THRESHOLD) {
      status.healthy = false;
    }
    // 同步到 router
    gatewayRouter.end(provider, false, 0);
  }

  /**
   * 手动标记一次调用成功
   */
  recordSuccess(provider: string, latencyMs: number): void {
    const status = this.status.get(provider);
    if (!status) return;
    status.consecutiveFailures = 0;
    status.healthy = true;
    status.lastLatencyMs = latencyMs;
    // 同步到 router
    gatewayRouter.end(provider, true, latencyMs);
  }

  /**
   * 获取所有状态
   */
  getAll(): Record<string, HealthStatus> {
    return Object.fromEntries(this.status);
  }

  /**
   * 查询单个 provider 是否健康
   */
  isHealthy(provider: string): boolean {
    return this.status.get(provider)?.healthy ?? false;
  }
}

// 全局单例
export const healthMonitor = new ProviderHealthMonitor();

// 默认注册常用 provider 探针（占位，具体实现由调用方注入）
healthMonitor.register({
  provider: 'comfyui',
  check: async () => {
    try {
      const res = await fetch('http://127.0.0.1:8188/system_stats', {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
});

healthMonitor.register({
  provider: 'minimax',
  check: async () => {
    try {
      const res = await fetch('https://api.minimax.chat/v1/models', {
        headers: { Authorization: `Bearer ${process.env.MINIMAX_API_KEY || ''}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
});
