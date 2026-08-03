/**
 * 为所有 deprecated 路由添加 GET 410 响应
 * 用法: node fix-deprecated-routes.js
 */
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'src', 'app', 'api');
const dirs = fs.readdirSync(apiDir).filter(f => {
  const routePath = path.join(apiDir, f, 'route.ts');
  if (!fs.existsSync(routePath)) return false;
  const content = fs.readFileSync(routePath, 'utf8');
  return content.includes('@deprecated') && !content.includes('export async function GET');
});

const getHandler = `

export async function GET() {
  return NextResponse.json(
    { error: '此路由已废弃，请使用 POST /api/ai/generate' },
    { status: 410 }
  );
}`;

for (const dir of dirs) {
  const filePath = path.join(apiDir, dir, 'route.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 添加 NextResponse import
  if (!content.includes('NextResponse')) {
    content = content.replace(
      "import { NextRequest } from 'next/server';",
      "import { NextRequest, NextResponse } from 'next/server';"
    );
  }
  
  // 在 POST 后面追加 GET
  content += getHandler;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[done] ${dir}`);
}

console.log(`\nFixed ${dirs.length} routes.`);
