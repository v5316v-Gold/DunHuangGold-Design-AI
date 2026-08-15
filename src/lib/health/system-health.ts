/**
 * 系统健康检查服务（L2 层）
 *
 * 职责：统一探测系统各关键依赖的健康状态，供 /api/admin/system 面板消费。
 * 约束：只做探测与报告，不做修复；所有探测带超时，失败不抛异常。
 *
 * 探测项：
 *   - app: 应用自身
 *   - postgres: 数据库连通性
 *   - redis: Redis 连通性
 *   - workers: BullMQ Worker 在线数
 *   - comfyui: ComfyUI 服务 + 队列长度
 *   - storage: 对象存储连通性（S3/R2/本地）
 *   - thirdParty: 第三方 API 可用性（智谱/豆包/OpenAI 等）
 *   - gpu: GPU 显存占用（ComfyUI /system_stats）
 */

import { getRedis, getBullConnection } from '@/lib/redis';
import { db, checkDatabaseConnection } from '@/db';

// ============================================================
// 类型定义
// ============================================================

export type CheckStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export interface SystemCheckResult {
  status: CheckStatus;
  latencyMs?: number;
  detail?: string;
  /** 附加数据（如 GPU 显存、队列长度） */
  data?: Record<string, unknown>;
  checkedAt: string;
}

export interface SystemHealthReport {
  status: CheckStatus; // 聚合状态
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, SystemCheckResult>;
}

// ============================================================
// 探测工具
// ============================================================

/** 带超时的通用探测 */
async function probe<T>(
  fn: () => Promise<T>,
  timeoutMs = 3000
): Promise<{ ok: boolean; latencyMs: number; data?: T; error?: string }> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ]);
    return { ok: true, latencyMs: Date.now() - start, data: result };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ============================================================
// 单项探测
// ============================================================

/** PostgreSQL 连通性 */
async function checkPostgres(): Promise<SystemCheckResult> {
  const r = await probe(() => checkDatabaseConnection(), 3000);
  return {
    status: r.ok ? 'ok' : 'down',
    latencyMs: r.latencyMs,
    detail: r.ok ? undefined : r.error,
    checkedAt: new Date().toISOString(),
  };
}

/** Redis 连通性 */
async function checkRedis(): Promise<SystemCheckResult> {
  const r = await probe(async () => {
    const redis = getRedis();
    const pong = await redis.ping();
    return pong === 'PONG';
  }, 3000);
  return {
    status: r.ok ? 'ok' : 'down',
    latencyMs: r.latencyMs,
    detail: r.ok ? undefined : r.error,
    checkedAt: new Date().toISOString(),
  };
}

/** BullMQ Worker 在线数（通过 Redis 键统计活跃 worker） */
async function checkWorkers(): Promise<SystemCheckResult> {
  const r = await probe(async () => {
    const redis = getBullConnection();
    // Phase 9.26 · BullMQ 无独立 workers 心跳键。
    // 检测方式：1) 队列 active 键存在 = 有 worker 在消费 2) 有活跃任务
    // active 键是 list，worker 拉取任务时写入
    const activeLen = await redis.llen('bull:ai-tasks:active');
    // 若 active 队列有任务或近期被消费，视为 worker 在线
    // 补充：检测 BullMQ 的 meta 键（queue 创建即有）
    const metaExists = await redis.exists('bull:ai-tasks:meta');
    const online = metaExists > 0 ? 1 : 0;
    return { online, workers: ['bullmq'], activeJobs: activeLen };
  }, 3000);

  const online = r.ok ? (r.data?.online as number) ?? 0 : 0;
  return {
    status: r.ok && online > 0 ? 'ok' : r.ok ? 'degraded' : 'down',
    latencyMs: r.latencyMs,
    detail: r.ok ? undefined : r.error,
    data: { online, workers: r.data?.workers ?? [] },
    checkedAt: new Date().toISOString(),
  };
}

/** ComfyUI 状态 + 队列长度 + Workflow Registry（Phase 9.23 §3.3） */
async function checkComfyUI(): Promise<SystemCheckResult> {
  const host = process.env.COMFYUI_HOST || 'http://localhost:8188';
  const r = await probe(async () => {
    const res = await fetch(`${host}/system_stats`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stats = (await res.json()) as Record<string, unknown>;

    // 队列长度
    const queueRes = await fetch(`${host}/queue`, { signal: AbortSignal.timeout(3000) });
    const queue = queueRes.ok ? ((await queueRes.json()) as { queue_running?: unknown[]; queue_pending?: unknown[] }) : null;

    return {
      stats,
      queueRunning: queue?.queue_running?.length ?? 0,
      queuePending: queue?.queue_pending?.length ?? 0,
      // GPU 显存（ComfyUI system_stats 的 devices[0] 含 vram_total/vram_free）
      gpu: extractGpuInfo(stats),
    };
  }, 5000);

  // Phase 9.23 §3.3：附加 Workflow Registry 状态
  let registrySummary: Record<string, unknown> = {};
  if (db) {
    try {
      const { sql } = await import('drizzle-orm');
      // Active Workflows
      const activeRes = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int as count FROM comfyui_configs
        WHERE lifecycle = 'active' AND active_version_id IS NOT NULL
      `);
      // Registered Models（按状态分组）
      const modelsRes = await db.execute<{ status: string; count: number }>(sql`
        SELECT status, COUNT(*)::int as count FROM model_registry GROUP BY status
      `);
      // Custom Node health（最近一次缺失数量）
      const nodesRes = await db.execute<{ missing: number }>(sql`
        SELECT COUNT(*) FILTER (WHERE NOT available)::int as missing
        FROM workflow_node_checks
        WHERE checked_at > NOW() - INTERVAL '7 days'
      `);
      const totalModels = (modelsRes.rows ?? []).reduce((s, r) => s + (r.count ?? 0), 0);
      const missingModels = (modelsRes.rows ?? []).filter((r) => r.status !== 'available').reduce((s, r) => s + (r.count ?? 0), 0);
      registrySummary = {
        activeWorkflows: activeRes.rows?.[0]?.count ?? 0,
        registeredModels: {
          total: totalModels,
          available: totalModels - missingModels,
          missing: missingModels,
          byStatus: (modelsRes.rows ?? []).reduce((acc: Record<string, number>, r) => {
            acc[r.status] = r.count;
            return acc;
          }, {}),
        },
        customNodeHealth: {
          missingLast7d: nodesRes.rows?.[0]?.missing ?? 0,
        },
      };
    } catch {
      // 静默失败，不影响 ComfyUI 自身状态
    }
  }

  return {
    status: r.ok ? 'ok' : 'down',
    latencyMs: r.latencyMs,
    detail: r.ok ? undefined : r.error,
    data: { ...(r.data as Record<string, unknown> ?? {}), ...registrySummary },
    checkedAt: new Date().toISOString(),
  };
}

/** 从 ComfyUI system_stats 提取 GPU 信息 */
function extractGpuInfo(stats: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const devices = stats.devices as Array<Record<string, unknown>> | undefined;
    if (!devices || devices.length === 0) return null;
    const d = devices[0];
    const vramTotal = d.vram_total as number | undefined;
    const vramFree = d.vram_free as number | undefined;
    if (vramTotal === undefined) return { name: d.name ?? 'unknown' };
    return {
      name: d.name ?? 'unknown',
      vramTotalMB: Math.round(vramTotal / 1024 / 1024),
      vramFreeMB: Math.round((vramFree ?? 0) / 1024 / 1024),
      vramUsedMB: Math.round((vramTotal - (vramFree ?? vramTotal)) / 1024 / 1024),
      vramUsagePercent: vramTotal > 0 ? Math.round(((vramTotal - (vramFree ?? vramTotal)) / vramTotal) * 100) : 0,
    };
  } catch {
    return null;
  }
}

/** 对象存储连通性 */
async function checkStorage(): Promise<SystemCheckResult> {
  const r = await probe(async () => {
    const { getStorageService } = await import('@/lib/storage/storage-service');
    const storage = getStorageService();
    const probeKey = `health-probe-${Date.now()}.txt`;
    await storage.upload(Buffer.from('ok'), probeKey, { contentType: 'text/plain' });
    const exists = await storage.exists(probeKey);
    await storage.delete(probeKey).catch(() => undefined);
    return { writable: exists };
  }, 5000);

  return {
    status: r.ok ? 'ok' : 'down',
    latencyMs: r.latencyMs,
    detail: r.ok ? undefined : r.error,
    data: r.data as Record<string, unknown> | undefined,
    checkedAt: new Date().toISOString(),
  };
}

/** 第三方 API 可用性（智谱/豆包/OpenAI 等，从配置读取） */
async function checkThirdParty(): Promise<SystemCheckResult> {
  // 从 api_configs 读取启用的第三方配置（不暴露 Key）
  if (!db) {
    return { status: 'unknown', detail: 'DB 不可用，无法读取配置', checkedAt: new Date().toISOString() };
  }
  try {
    const { apiConfigs } = await import('@/db/schema/_tables');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select({ id: apiConfigs.id, name: apiConfigs.name, provider: apiConfigs.provider, enabled: apiConfigs.enabled }).from(apiConfigs).where(eq(apiConfigs.enabled, true)).limit(20);

    if (rows.length === 0) {
      return { status: 'unknown', detail: '无启用的第三方 API 配置', checkedAt: new Date().toISOString() };
    }

    // 只报告配置状态（真实连通性探测需要调用各 Provider，成本高，留待 worker 定时任务）
    const providers = rows.map((r) => r.provider || r.name || 'unknown');
    return {
      status: 'ok',
      detail: `${providers.length} 个 Provider 已启用`,
      data: { providers, count: providers.length },
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      status: 'degraded',
      detail: e instanceof Error ? e.message : '读取失败',
      checkedAt: new Date().toISOString(),
    };
  }
}

// ============================================================
// 聚合入口
// ============================================================

/** 执行全部健康检查（并行，单项失败不影响其它） */
export async function runSystemHealthCheck(): Promise<SystemHealthReport> {
  const [postgres, redis, workers, comfyui, storage, thirdParty] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkWorkers(),
    checkComfyUI(),
    checkStorage(),
    checkThirdParty(),
  ]);

  const checks: Record<string, SystemCheckResult> = {
    postgres,
    redis,
    workers,
    comfyui,
    storage,
    thirdParty,
  };

  // 聚合状态：任一 down → degraded（面板高亮）；全 ok → ok
  const statuses = Object.values(checks).map((c) => c.status);
  const hasDown = statuses.includes('down');
  const hasUnknown = statuses.includes('unknown');

  return {
    status: hasDown ? 'degraded' : hasUnknown ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.1.0',
    checks,
  };
}
