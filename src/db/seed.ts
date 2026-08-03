/**
 * 数据库种子数据
 * 初始化管理员账户和默认API配置
 */

import 'dotenv/config';
import { hashPassword } from '@/lib/auth';
import { db } from './index';
import { users, apiConfigs } from './schema';
import { coreApiConfigs } from '@/lib/api-config-service';

async function seed() {
  console.log('🌱 开始填充数据库种子数据...');

  if (!db) {
    console.error('❌ 数据库未连接，请检查 DATABASE_URL 环境变量');
    process.exit(1);
  }

  try {
    // 1. 创建管理员账户
    // ⚠️ 生产环境：ADMIN_PASSWORD 必须通过环境变量设置，禁止使用弱密码
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 8) {
      console.error('❌ 请通过环境变量 ADMIN_PASSWORD 设置管理员密码（至少8位）');
      console.error('   示例: ADMIN_PASSWORD=YourSecurePassword123 pnpm db:seed');
      process.exit(1);
    }
    console.log('👤 创建管理员账户...');
    const adminPasswordHash = await hashPassword(adminPassword);

    const [admin] = await db
      .insert(users)
      .values({
        email: 'admin@dunhuang.com',
        passwordHash: adminPasswordHash,
        nickname: '超级管理员',
        role: 'admin',
        status: 'active',
        power: 99999,
      })
      .onConflictDoNothing()
      .returning();

    if (admin) {
      console.log('✅ 管理员账户创建成功');
      console.log('   邮箱: admin@dunhuang.com');
      // 不在日志中打印密码
    } else {
      console.log('ℹ️ 管理员账户已存在');
    }

    // 2. 初始化 API 配置（简化版：4个核心API）
    console.log('🔧 初始化 API 配置...');
    const configsToInsert = Object.values(coreApiConfigs).map((config) => ({
      id: config.id,
      name: config.name,
      apiKey: config.cloud.apiKey || '',
      url: config.cloud.url || null,
      method: 'POST', // 默认方法
      enabled: config.enabled,
      timeout: config.cloud.timeout || 60000,
      headers: {},
      paramMapping: {},
      responseMapping: {},
      fallback: {},
      description: config.description || null,
    }));

    let insertedCount = 0;
    for (const config of configsToInsert) {
      try {
        await db
          .insert(apiConfigs)
          .values(config)
          .onConflictDoUpdate({
            target: apiConfigs.id,
            set: {
              name: config.name,
              apiKey: config.apiKey,
              url: config.url,
              method: config.method,
              timeout: config.timeout,
              fallback: config.fallback,
              description: config.description,
              updatedAt: new Date(),
            },
          });
        insertedCount++;
      } catch (e) {
        // 忽略单个插入错误
      }
    }
    console.log(`✅ API 配置初始化完成 (${insertedCount}/${configsToInsert.length})`);

    // 3. 创建测试用户
    const testPassword = process.env.TEST_USER_PASSWORD || 'test123';
    console.log('👤 创建测试用户...');
    const testPasswordHash = await hashPassword(testPassword);

    const [testUser] = await db
      .insert(users)
      .values({
        email: 'test@dunhuang.com',
        passwordHash: testPasswordHash,
        nickname: '测试用户',
        role: 'user',
        status: 'active',
        power: 1000,
      })
      .onConflictDoNothing()
      .returning();

    if (testUser) {
      console.log('✅ 测试用户创建成功');
      console.log('   邮箱: test@dunhuang.com');
    }

    console.log('\n🎉 种子数据填充完成！');
    console.log('\n📝 账户信息：');
    console.log('   管理员: admin@dunhuang.com');
    console.log('   测试用户: test@dunhuang.com');

  } catch (error) {
    console.error('❌ 种子数据填充失败:', error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
