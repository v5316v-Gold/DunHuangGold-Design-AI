/**
 * 测试图片生成类功能的完整流程
 * 登录 → 调用 /api/ai/generate → 验证图片 URL
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// 加载 .env.local
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

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function testFeature(service, prompt, extra = {}) {
  // Step 1: 登录
  const loginRes = await httpRequest({
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'admin@dunhuang.com', password: 'admin123' }));

  const loginData = JSON.parse(loginRes.data);
  if (!loginData.success) {
    console.log(`[${service}] ❌ 登录失败`);
    return;
  }
  const token = loginData.data.token;

  // Step 2: 生成图片
  const body = JSON.stringify({ service, prompt, resolution: '1k', ratio: '1:1', count: 1, ...extra });

  const start = Date.now();
  const genRes = await httpRequest({
    hostname: 'localhost', port: 3000, path: '/api/ai/generate', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  const duration = Date.now() - start;

  const genData = JSON.parse(genRes.data);
  const status = genData.success ? '✅' : '❌';
  console.log(`${status} [${service}] ${genRes.status} (${duration}ms) | ${genData.provider} | ${genData.error || '成功'}`);
  if (genData.success) {
    const url = Array.isArray(genData.data) ? genData.data[0] : genData.data;
    console.log(`   图片URL: ${url}`);
  }

  // 验证图片 URL（带 auth）
  if (genData.success) {
    const url = Array.isArray(genData.data) ? genData.data[0] : genData.data;
    const urlObj = new URL(`http://localhost:3000${url}`);
    const imgRes = await httpRequest({
      hostname: 'localhost', port: 3000, path: urlObj.pathname + '?' + urlObj.search,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, null);
    console.log(`   图片访问: ${imgRes.status} ${imgRes.headers['content-type'] || ''}`);
  }
}

async function main() {
  console.log('=== 图片生成类功能测试 ===\n');

  // text2img
  await testFeature('text2img', '敦煌风格精美项链，金色，镶嵌宝石');

  // refine（需要图片，这里用文字测试）
  await testFeature('refine', '精修一款敦煌风格手镯，高清细节');

  // relief
  await testFeature('relief', '浮雕风格敦煌飞天图案');

  console.log('\n✅ 全部测试完成');
}

main().catch(console.error);
