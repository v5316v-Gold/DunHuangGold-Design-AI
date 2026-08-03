/**
 * Phase 2 ComfyUI 路由去重：标记 status/progress/execute 相关子路由为 @deprecated
 * 转发到 /api/comfyui（主路由）
 */
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', '..', 'src', 'app', 'api', 'comfyui');

// 需要 deprecated 的路由
const routes = [
  {
    file: 'status/route.ts',
    newService: null, // status 查询通过主路由 GET 兜底
    note: 'GET /api/comfyui'
  },
  {
    file: 'progress/route.ts',
    newService: null, // SSE 流，无法简单转发
    note: 'SSE stream, keep separate'
  },
  {
    file: 'prompt/route.ts',
    newService: null, // POST 通过主路由
    note: 'Use /api/comfyui'
  },
  {
    file: 'execute/route.ts',
    newService: null,
    note: 'Use /api/comfyui'
  },
  {
    file: 'call/route.ts',
    newService: null,
    note: 'Use /api/comfyui'
  },
];

for (const { file, note } of routes) {
  const filePath = path.join(apiDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`[skip] ${file} — not found`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('@deprecated')) {
    console.log(`[skip] ${file} — already deprecated`);
    continue;
  }

  // 读取原文件前几行以获取 runtime/export 指令
  const lines = content.split('\n');
  const header = [];
  const rest = [];
  let pastDoc = false;

  for (const line of lines) {
    if (!pastDoc && (line.startsWith('/**') || line.startsWith(' *') || line.startsWith('*/'))) {
      header.push(line);
      if (line.startsWith('*/')) pastDoc = true;
    } else if (!pastDoc && line.startsWith('import')) {
      header.push(line);
    } else if (!pastDoc && (line.startsWith('export const') || line.startsWith('export async'))) {
      pastDoc = true;
      rest.push(line);
    } else if (pastDoc) {
      rest.push(line);
    } else {
      if (!pastDoc && header.length > 0) {
        pastDoc = true;
      }
      rest.push(line);
    }
  }

  // 找到 POST handler 位置
  const postIdx = rest.findIndex(l => l.includes('export async function POST'));
  const getIdx = rest.findIndex(l => l.includes('export async function GET'));

  let newContent = `/**\n * @deprecated 此路由已废弃，请直接使用 /api/comfyui\n * 90 天后将被删除。\n */\nimport { NextRequest, NextResponse } from 'next/server';\nimport { requireAuth } from '@/lib/auth';\nimport { unauthorized } from '@/lib/api-response';\n\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\n`;

  if (postIdx !== -1) {
    newContent += `\nexport async function POST(request: NextRequest) {\n  const user = await requireAuth(request);\n  if (!user) return unauthorized();\n  return NextResponse.json(\n    { error: '此路由已废弃，请使用 /api/comfyui', deprecated: true },\n    { status: 410 }\n  );\n}\n`;
  }

  if (getIdx !== -1) {
    newContent += `\nexport async function GET() {\n  return NextResponse.json(\n    { error: '此路由已废弃，请使用 /api/comfyui', deprecated: true },\n    { status: 410 }\n  );\n}\n`;
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`[done] ${file}`);
}

console.log('\nComfyUI sub-routes deprecated.');
