/**
 * Phase 3: Admin 用户/算力路由标记为 @deprecated
 * 合并目标：
 * - /api/admin/users ← users + users/[id] + users/[id]/recharge
 * - /api/admin/power ← power + power/recharge + power/transactions
 */
const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '..', '..', 'src', 'app', 'api', 'admin');

// Phase 3: Admin 用户路由
const phase3Routes = [
  { dir: 'users', file: 'route.ts', note: '合并到 /api/admin/users（同一文件内）' },
  { dir: 'users/[id]', file: 'route.ts', note: '合并到 /api/admin/users（同一文件内）' },
  { dir: 'users/[id]/recharge', file: 'route.ts', note: '合并到 /api/admin/users POST action=recharge' },
  { dir: 'power', file: 'route.ts', note: '合并到 /api/admin/power（同一文件内）' },
  { dir: 'power/recharge', file: 'route.ts', note: '合并到 /api/admin/power POST' },
  { dir: 'power/transactions', file: 'route.ts', note: '合并到 /api/admin/power GET' },
];

// Phase 4: Admin 设置路由
const phase4Routes = [
  { dir: 'api-config', file: 'route.ts', note: '合并到 /api/admin/settings' },
  { dir: 'api-config-db', file: 'route.ts', note: '合并到 /api/admin/settings' },
  { dir: 'ai-assistant-config', file: 'route.ts', note: '合并到 /api/admin/settings' },
  { dir: 'feature-costs', file: 'route.ts', note: '合并到 /api/admin/settings' },
  { dir: 'app-settings', file: 'route.ts', note: '合并到 /api/admin/settings' },
  { dir: 'translate-settings', file: 'route.ts', note: '合并到 /api/admin/settings' },
];

const all = [...phase3Routes, ...phase4Routes];

for (const route of all) {
  const filePath = path.join(adminDir, route.dir, route.file);
  if (!fs.existsSync(filePath)) {
    console.log('[skip]', route.dir, '— not found');
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('@deprecated')) {
    console.log('[skip]', route.dir, '— already deprecated');
    continue;
  }

  const deprecationBlock = `
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * ${route.note}
 */`;

  const firstDocStart = content.indexOf('/**');
  if (firstDocStart === -1) {
    console.log('[skip]', route.dir, '— no JSDoc found');
    continue;
  }

  const afterFirstDoc = content.indexOf('*/', firstDocStart);
  if (afterFirstDoc === -1) {
    console.log('[skip]', route.dir, '— unclosed JSDoc');
    continue;
  }

  content = content.slice(0, afterFirstDoc + 2) + deprecationBlock + content.slice(afterFirstDoc + 2);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[done]', route.dir);
}

console.log('\nDone.');
