/**
 * 查询所有用户
 */

import 'dotenv/config';
import { db } from './index';
import { users } from './schema';

async function listUsers() {
  console.log('👥 查询所有用户...');

  if (!db) {
    console.error('❌ 数据库未连接');
    process.exit(1);
  }

  try {
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        role: users.role,
        power: users.power,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    console.log(`\n共找到 ${userList.length} 个用户：\n`);
    userList.forEach((user, i) => {
      console.log(`${i + 1}. ${user.email}`);
      console.log(`   昵称: ${user.nickname}`);
      console.log(`   角色: ${user.role}`);
      console.log(`   算力: ${user.power}`);
      console.log(`   ID: ${user.id}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  }

  process.exit(0);
}

listUsers();
