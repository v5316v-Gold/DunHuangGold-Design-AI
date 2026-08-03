/**
 * 直接测试 Minimax image_generation API
 */
import * as fs from 'fs';
import * as path from 'path';

// 手动加载 .env.local
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
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('MINIMAX_API_KEY not found');
    process.exit(1);
  }

  console.log('=== 直接测试 Minimax API ===\n');
  console.log('Key:', apiKey.substring(0, 8) + '...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.minimax.chat/v1/image_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'image-01',
        prompt: '敦煌风格精美项链，金色，镶嵌宝石',
        num_images: 1,
        size: '512x512',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    console.log('HTTP Status:', response.status);

    const text = await response.text();
    console.log('Response:', text.substring(0, 600));

    try {
      const json = JSON.parse(text);
      if (json.data?.image_urls?.length > 0) {
        console.log('\n✅ Minimax API 正常！');
        console.log('图片 URL:', json.data.image_urls[0]);
      } else if (json.base_resp?.error_message) {
        console.log('\n❌ Minimax API 错误:', json.base_resp.error_message);
      } else {
        console.log('\n❓ 响应格式异常');
      }
    } catch {
      console.log('非 JSON 响应');
    }
  } catch (e: any) {
    clearTimeout(timeout);
    console.error('请求失败:', e.message);
  }
}

main();
