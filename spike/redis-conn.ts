import IORedis from 'ioredis';

async function main() {
  const redis = new IORedis('redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  
  try {
    await redis.connect();
    const pong = await redis.ping();
    console.log('✅ Redis 连接成功:', pong);
    
    await redis.set('spike:test', 'hello');
    const value = await redis.get('spike:test');
    console.log('✅ Redis 读写成功:', value);
    
    await redis.del('spike:test');
    await redis.quit();
  } catch (err) {
    console.error('❌ Redis 错误:', err);
    process.exit(1);
  }
}

main();