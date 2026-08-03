/**
 * 登录获取 token
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './src/storage/database/db';
import { users } from './src/storage/database/shared/schema';
import { generateToken } from './src/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

(async () => {
  const email = 'admin@dunhuang.com';
  const password = 'admin123';

  console.log('=== 管理员登录测试 ===\n');

  // 用 bcrypt 验证密码
  const bcrypt = await import('bcryptjs');
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) { console.log('用户不存在'); process.exit(1); }

  const valid = bcrypt.compareSync(password, user.password_hash);
  console.log('密码验证:', valid ? '✅' : '❌');
  if (!valid) { console.log('密码错误'); process.exit(1); }

  // 生成 JWT
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  console.log('\nJWT Token:', token.substring(0, 50) + '...');
  console.log('User ID:', user.id);
  console.log('Power:', user.power);

  // 保存 token 供后续测试用
  console.log('\n✅ 登录成功！');
  process.exit(0);
})();
