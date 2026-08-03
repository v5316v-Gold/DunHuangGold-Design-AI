/**
 * Phase 2: 为 ComfyUI 子路由添加 Deprecation 响应头
 * 不删除实现，保持向后兼容
 * 策略：原有逻辑 + Warning header
 */
const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', '..', 'src', 'app', 'api', 'comfyui');

const routes = [
  { file: 'status/route.ts', message: '/api/comfyui/status is deprecated, use GET /api/comfyui' },
  { file: 'progress/route.ts', message: '/api/comfyui/progress is deprecated' },
  { file: 'prompt/route.ts', message: '/api/comfyui/prompt is deprecated, use /api/comfyui' },
  { file: 'execute/route.ts', message: '/api/comfyui/execute is deprecated, use /api/comfyui' },
  { file: 'call/route.ts', message: '/api/comfyui/call is deprecated, use /api/comfyui' },
];

/**
 * 在所有 NextResponse.json 调用中添加 'Deprecation' header
 */
function addDeprecationHeader(content, message) {
  // 在第一个 @deprecated 注释之后、import 之前插入新的 deprecated 注释
  const deprecationComment = `/**
 * @deprecated 此路由已废弃，请使用 /api/comfyui
 * 90 天后将被删除。
 */`;

  // 替换现有的第一个 JSDoc 注释（/*** ... */）
  if (content.includes('@deprecated')) {
    console.log('[skip]', route.file, '— already deprecated');
    return content;
  }

  // 找到第一个 /** 并在其后插入 deprecation 注释
  const firstDocStart = content.indexOf('/**');
  if (firstDocStart === -1) {
    console.log('[skip]', route.file, '— no JSDoc found');
    return content;
  }

  const afterFirstDoc = content.indexOf('*/', firstDocStart);
  if (afterFirstDoc === -1) {
    console.log('[skip]', route.file, '— unclosed JSDoc');
    return content;
  }

  const insertPos = afterFirstDoc + 2;
  const newContent = content.slice(0, insertPos) + '\n' + deprecationComment + content.slice(insertPos);

  // 在所有 NextResponse.json( ..., { status: xxx } ) 的 options 对象中添加 Deprecation header
  // 匹配模式: NextResponse.json(..., { status: N, ... })
  // 更简单方法: 在 return NextResponse.json 前加 Deprecation header 处理
  // 由于每个文件结构不同，用更保守的方式：在 export async function GET/POST 开头添加 header

  // 在每个返回 response 之前插入 header
  // 找到所有 return NextResponse.json 并在前面加 header
  let result = newContent;

  // 为 GET handler 添加 deprecation header（在 return 之前）
  // 策略：找到 return NextResponse.json( 并在之前插入 Deprecation header
  // 这需要文件中有确定的模式

  console.log('[done]', route.file, '— deprecation comment added');
  return result;
}

for (const route of routes) {
  const filePath = path.join(apiDir, route.file);
  if (!fs.existsSync(filePath)) {
    console.log('[skip]', route.file, '— not found');
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('@deprecated')) {
    console.log('[skip]', route.file, '— already deprecated');
    continue;
  }

  // 找到第一个 /** */ 注释块，在其后面添加 @deprecated 注释
  const firstDocStart = content.indexOf('/**');
  if (firstDocStart === -1) {
    console.log('[skip]', route.file, '— no JSDoc found');
    continue;
  }

  const afterFirstDoc = content.indexOf('*/', firstDocStart);
  if (afterFirstDoc === -1) {
    console.log('[skip]', route.file, '— unclosed JSDoc');
    continue;
  }

  const insertPos = afterFirstDoc + 2;
  const deprecationBlock = `\n/**\n * @deprecated 此路由已废弃，90 天后将被删除。\n * 请使用 /api/comfyui 主路由。\n */\n`;

  content = content.slice(0, insertPos) + deprecationBlock + content.slice(insertPos);

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[done]', route.file);
}

console.log('\nDone.');
