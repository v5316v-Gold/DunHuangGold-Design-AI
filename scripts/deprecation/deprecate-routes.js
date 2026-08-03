/**
 * 批量将旧路由标记为 @deprecated + 转发到 /api/ai/generate
 * 用法: node deprecate-routes.js
 */

const fs = require('fs');
const path = require('path');

const routes = [
  { dir: 'product-refine',    service: 'refine',    label: 'POST /api/ai/generate (service: "refine")' },
  { dir: 'multi-image',       service: 'blend',      label: 'POST /api/ai/generate (service: "blend")' },
  { dir: 'one-click-design', service: 'oneclick',   label: 'POST /api/ai/generate (service: "oneclick")' },
  { dir: 'multi-view',        service: 'multiview',  label: 'POST /api/ai/generate (service: "multiview")' },
  { dir: 'sketch-realistic',  service: 'sketch',    label: 'POST /api/ai/generate (service: "sketch")' },
  { dir: 'free-creation',     service: 'free',      label: 'POST /api/ai/generate (service: "free")' },
  { dir: 'relief',            service: 'relief',    label: 'POST /api/ai/generate (service: "relief")' },
  { dir: 'image-3d',         service: 'image3d',    label: 'POST /api/ai/generate (service: "image3d")' },
  { dir: 'stereo',           service: 'stereo',     label: 'POST /api/ai/generate (service: "stereo")' },
  { dir: 'remove-background', service: 'removebg',  label: 'POST /api/ai/generate (service: "removebg")' },
  { dir: 'upscale',           service: 'upscale',    label: 'POST /api/ai/generate (service: "upscale")' },
  { dir: 'remove-watermark', service: 'watermark',  label: 'POST /api/ai/generate (service: "watermark")' },
  { dir: 'video',             service: 'text2video',label: 'POST /api/ai/generate (service: "text2video")' },
];

const apiDir = path.join(__dirname, 'src', 'app', 'api');

function deprecationTemplate(service, routePath, label) {
  return `/**
 * @deprecated 此路由已废弃，请使用 ${label}
 * 90 天后将被删除。
 */
import { NextRequest } from 'next/server';
import { forwardToNewRoute } from '@/lib/deprecated-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return forwardToNewRoute(request, '${service}', '/api/${routePath}');
}
`;
}

for (const { dir, service, label } of routes) {
  const filePath = path.join(apiDir, dir, 'route.ts');
  const content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('@deprecated')) {
    console.log(`[skip] ${dir} — already deprecated`);
    continue;
  }

  const newContent = deprecationTemplate(service, dir, label);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`[done] ${dir} → service: "${service}"`);
}

console.log('\nAll routes deprecated.');
