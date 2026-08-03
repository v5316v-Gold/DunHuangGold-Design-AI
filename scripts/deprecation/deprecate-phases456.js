/**
 * Phase 4/5/6: 批量 deprecated 剩余路由
 * 用法: node deprecate-phases456.js
 */
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', '..', 'src', 'app', 'api');

// ============================================================
// 配置：路由 → 新目标路径（或说明）
// ============================================================
const routes = [
  // ---- Phase 4: Admin 设置类 ----
  {
    key: 'admin-api-config',
    route: 'admin/api-config',
    newTarget: '/api/admin/settings',
    note: '合并到 admin/settings',
    isAdmin: true,
  },
  {
    key: 'admin-app-settings',
    route: 'admin/app-settings',
    newTarget: '/api/admin/settings',
    note: '合并到 admin/settings',
    isAdmin: true,
  },
  {
    key: 'admin-rules',
    route: 'admin/rules',
    newTarget: null,
    note: '独立保留（无合并目标）',
    isAdmin: true,
  },

  // ---- Phase 5: Works + Stats ----
  {
    key: 'stats',
    route: 'stats',
    newTarget: '/api/stats (统一用户统计入口)',
    note: '合并到统一 stats 入口（GET by role）',
    isAdmin: false,
  },
  {
    key: 'admin-stats',
    route: 'admin/stats',
    newTarget: '/api/admin/stats (统一管理统计)',
    note: '合并到统一 admin stats 入口',
    isAdmin: true,
  },
  {
    key: 'works',
    route: 'works',
    newTarget: null,
    note: '合并到 /api/works（同一文件内处理）',
    isAdmin: false,
  },
  {
    key: 'works-id',
    route: 'works/[id]',
    newTarget: null,
    note: '合并到 /api/works（同一文件内处理）',
    isAdmin: false,
  },
  {
    key: 'works-id-download',
    route: 'works/[id]/download',
    newTarget: null,
    note: '合并到 /api/works（同一文件内处理）',
    isAdmin: false,
  },
  {
    key: 'works-batch-delete',
    route: 'works/batch-delete',
    newTarget: null,
    note: '合并到 /api/works（同一文件内处理）',
    isAdmin: false,
  },

  // ---- Phase 6: AI 对话类 ----
  {
    key: 'ai-assistant',
    route: 'ai-assistant',
    newTarget: '/api/chat',
    note: '合并到 chat（provider 参数扩展）',
    isAdmin: false,
  },
  {
    key: 'openclaw-chat',
    route: 'openclaw-chat',
    newTarget: '/api/chat',
    note: '合并到 chat（统一对话入口）',
    isAdmin: false,
  },

  // ---- 附加: 废弃调试路由 ----
  {
    key: 'debug-auth',
    route: 'debug-auth',
    newTarget: null,
    note: '调试路由，90天后删除',
    isAdmin: false,
  },
  {
    key: 'test-comfyui',
    route: 'test-comfyui',
    newTarget: null,
    note: '测试路由，90天后删除',
    isAdmin: false,
  },
  {
    key: 'relief-download',
    route: 'relief-download',
    newTarget: null,
    note: '功能已合并到新路由，90天后删除',
    isAdmin: false,
  },
];

function processRoute(route) {
  const filePath = path.join(apiDir, route.route.split('/').join('\\'), 'route.ts');
  // Try different path separators
  let filePathAlt = filePath;
  if (!fs.existsSync(filePath)) {
    filePathAlt = path.join(apiDir, ...route.route.split('/'), 'route.ts');
  }
  const finalPath = fs.existsSync(filePathAlt) ? filePathAlt : filePath;
  const exists = fs.existsSync(finalPath);

  if (!exists) {
    console.log(`[skip] ${route.key} — route.ts not found`);
    return;
  }

  const content = fs.readFileSync(finalPath, 'utf8');
  if (content.includes('@deprecated')) {
    console.log(`[skip] ${route.key} — already deprecated`);
    return;
  }

  // Find first /** */ doc block
  const firstDocStart = content.indexOf('/**');
  if (firstDocStart === -1) {
    console.log(`[skip] ${route.key} — no JSDoc found`);
    return;
  }
  const afterFirstDoc = content.indexOf('*/', firstDocStart);
  if (afterFirstDoc === -1) {
    console.log(`[skip] ${route.key} — unclosed JSDoc`);
    return;
  }

  const newTargetStr = route.newTarget ? `\n * 合并目标: ${route.newTarget}` : '';
  const deprecationBlock = `\n/**\n * @deprecated 此路由已废弃，90 天后将被删除。\n * ${route.note}${newTargetStr}\n */`;

  const insertPos = afterFirstDoc + 2;
  const newContent = content.slice(0, insertPos) + deprecationBlock + content.slice(insertPos);

  fs.writeFileSync(finalPath, newContent, 'utf8');
  console.log(`[done] ${route.key} → ${route.note}`);
}

for (const route of routes) {
  processRoute(route);
}

console.log('\nAll done.');
