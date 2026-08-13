/**
 * Redis 客户端单例
 *
 * 用途：异步任务队列 (BullMQ) + 幂等检查 + 限流
 *
 * 为什么单例：避免每个模块重复创建连接，耗资源
 * 为什么 lazy：服务端启动时不需要立即连接，按需初始化
 */

import IORedis, { type Redis } from 'ioredis';

let _client: Redis | null = null;
let _bullConnection: Redis | null = null;

/**
 * 获取通用 Redis 客户端（用于幂等、限流、缓存等）
 */
export function getRedis(): Redis {
  if (!_client) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    _client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      // Phase 9.16 修复: lazyConnect 避免启动时阻塞进程
      lazyConnect: true,
      enableReadyCheck: true,
      reconnectOnError: (err) => {
        // READONLY 错误时重连（failover 场景）
        return err.message.includes('READONLY');
      },
      // 重连策略: 指数退避，最大 5 秒
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 5000);
        console.log(`[redis] 重连第 ${times} 次，${delay}ms 后重试`);
        return delay;
      },
    });

    _client.on('error', (err) => {
      // Phase 9.16: code + message 都打（之前 message 为空无法排查）
      console.error('[redis] 连接错误:', err.code || 'NO_CODE', err.message || '(empty message)');
    });
    _client.on('connect', () => {
      console.log('[redis] 已连接:', url);
    });
    _client.on('ready', () => {
      console.log('[redis] ready 状态');
    });
    _client.on('close', () => {
      console.warn('[redis] 连接关闭');
    });
    _client.on('reconnecting', (delay) => {
      console.log(`[redis] 重连中 (${delay}ms 后)`);
    });
    _client.on('end', () => {
      console.warn('[redis] 连接结束');
    });

    // Phase 9.16 修复: 异步触发连接，不阻塞进程
    _client.connect().catch((err) => {
      console.warn('[redis] 初始连接失败（将在后台重试）:', err.code || 'NO_CODE', err.message);
    });
  }
  return _client;
}

/**
 * 获取 BullMQ 专用连接（maxRetriesPerRequest 必须为 null）
 *
 * BullMQ 要求连接配置：maxRetriesPerRequest: null
 * 否则 worker 会持续报错
 */
export function getBullConnection(): Redis {
  if (!_bullConnection) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    _bullConnection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      // Phase 9.16 修复: lazyConnect
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 50, 5000),
    });
  }
  return _bullConnection;
}

/**
 * 健康检查
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * 关闭所有连接（用于 graceful shutdown）
 */
export async function closeRedis(): Promise<void> {
  await Promise.all([
    _client?.quit().catch(() => {}),
    _bullConnection?.quit().catch(() => {}),
  ]);
  _client = null;
  _bullConnection = null;
}