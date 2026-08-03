/**
 * 将指定用户提升为管理员
 */

import 'dotenv/config';
import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';

const TARGET_EMAIL = 'admin@dunhuang.com';

async function promoteToAdmin() {
  console.log('🔧 提升用户为管理员...');

  if (!db) {
    console.error('❌ 数据库未连接');
    process.exit(1);
  }

  try {
    // 查询用户
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, TARGET_EMAIL))
      .limit(1);

    if (userList.length === 0) {
      console.error(`❌ 用户 ${TARGET_EMAIL} 不存在`);
      process.exit(1);
    }

    const user = userList[0];

    if (user.role === 'admin') {
      console.log(`ℹ️ 用户 ${TARGET_EMAIL} 已经是管理员`);
      process.exit(0);
    }

    // 更新角色
    const [updated] = await db
      .update(users)
      .set({
        role: 'admin',
        power: 99999,
      })
      .where(eq(users.email, TARGET_EMAIL))
      .returning();

    console.log('✅ 用户提升成功');
    console.log(`   邮箱: ${updated.email}`);
    console.log(`   昵称: ${updated.nickname}`);
    console.log(`   角色: ${updated.role}`);
    console.log(`   算力: ${updated.power}`);

  } catch (error) {
    console.error('❌ 操作失败:', error);
    process.exit(1);
  }

  process.exit(0);
}

promoteToAdmin();
