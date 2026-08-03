/**
 * 创建测试管理员账号
 */

import 'dotenv/config';
import { hashPassword } from '@/lib/auth';
import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';

async function createAdmin() {
  console.log('👤 创建测试管理员账户...');

  if (!db) {
    console.error('❌ 数据库未连接');
    process.exit(1);
  }

  try {
    const email = 'admin@dunhuang.com';
    const password = 'admin123';
    const nickname = '超级管理员';

    // 检查是否已存在
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      console.log('ℹ️ 管理员账户已存在');
      console.log(`   邮箱: ${email}`);
      console.log(`   密码: ${password}`);
      process.exit(0);
    }

    // 创建新管理员
    const passwordHash = await hashPassword(password);

    const [admin] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        nickname,
        role: 'admin',
        status: 'active',
        power: 99999,
      })
      .returning();

    if (admin) {
      console.log('✅ 管理员账户创建成功');
      console.log(`   邮箱: ${email}`);
      console.log(`   密码: ${password}`);
      console.log(`   算力: 99999`);
    }

    console.log('\n🎉 创建完成！');

  } catch (error) {
    console.error('❌ 创建失败:', error);
    process.exit(1);
  }

  process.exit(0);
}

createAdmin();
