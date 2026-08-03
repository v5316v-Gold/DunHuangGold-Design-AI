/**
 * 测试图片生成完整流程
 * 模拟 POST /api/ai/generate 的 pipeline.execute('text2img', ...)
 */
import 'dotenv/config';

// 确保服务注册到 registry
import '@/lib/ai-service/services/text2img';
import '@/lib/ai-service/services/refine';
import '@/lib/ai-service/services/relief';

import { pipeline } from './src/lib/ai-service/generation-pipeline';
import * as fs from 'fs';
import * as path from 'path';

// 手动加载 .env.local（确保 API key 可用）
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

async function main() {
  console.log('=== 测试 text2img 完整流程 ===\n');

  const req = {
    service: 'text2img',
    prompt: '敦煌风格的精美项链，金色，镶嵌宝石，传统纹样',
    resolution: '1k',
    ratio: '1:1',
    count: 1,
  };

  const userId = 'cf08328b-4c45-4b36-a4a8-19fd6779b890';

  console.log('请求参数:', JSON.stringify(req, null, 2));
  console.log('userId:', userId);
  console.log('MINIMAX_API_KEY:', process.env.MINIMAX_API_KEY?.substring(0, 8) + '...');
  console.log('');

  const result = await pipeline.execute('text2img', req, userId);

  console.log('\n=== 执行结果 ===');
  console.log('success:', result.success);
  console.log('provider:', result.provider);
  console.log('error:', result.error);
  console.log('workflow:', result.workflow);
  console.log('powerCost:', result.powerCost);

  if (result.data && Array.isArray(result.data) && result.data.length > 0) {
    console.log('\n✅ 图片生成成功！');
    console.log('图片数:', result.data.length);
    console.log('第一张图片 URL:', result.data[0]);
  } else {
    console.log('\n❌ 图片生成失败:', result.error);
  }

  process.exit(0);
}

main().catch(e => {
  console.error('测试脚本异常:', e);
  process.exit(1);
});
