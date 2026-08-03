/**
 * Spike 4 续: 用 Redis SETNX 实现幂等（业务层控制）
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis('redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

/**
 * 幂等检查：key 不存在才返回 true（已设置表示重复）
 */
async function checkIdempotency(redis: IORedis, key: string, ttlSec = 3600): Promise<boolean> {
  const result = await redis.set(`idem:${key}`, '1', 'EX', ttlSec, 'NX');
  return result === 'OK';
}

const queue = new Queue('spike-idem-test', { connection });

async function main() {
  const idemKey = `idem-${Date.now()}`;
  
  console.log(`🔑 第 1 次检查幂等 (key=${idemKey})...`);
  const ok1 = await checkIdempotency(connection, idemKey);
  console.log(ok1 ? '✅ 通过' : '❌ 重复');
  if (ok1) {
    await queue.add('task', { data: 'first' });
    console.log('  → 任务已入队');
  }

  console.log(`🔑 第 2 次检查幂等（同 key）...`);
  const ok2 = await checkIdempotency(connection, idemKey);
  console.log(ok2 ? '⚠️ 通过（不应该）' : '✅ 重复拒绝');

  console.log('🧹 清理...');
  await connection.del(`idem:${idemKey}`);
  await queue.drain(true);
  await queue.close();
  await connection.quit();
  console.log('✅ Spike 4 续 完成');
}

main().catch((err) => {
  console.error('❌ 失败:', err);
  process.exit(1);
});