const http = require('http');
const fs = require('fs');
const path = require('path');

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
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function test() {
  // Step 1: Login to get token
  console.log('=== 1. 登录获取 Token ===');
  const loginRes = await httpRequest({
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'admin@dunhuang.com', password: 'admin123' }));

  const loginData = JSON.parse(loginRes.data);
  if (!loginData.success) {
    console.log('❌ 登录失败:', loginData);
    return;
  }
  const token = loginData.data.token;
  console.log('✅ 登录成功! 算力:', loginData.data.user.power);
  console.log('Token:', token.substring(0, 40) + '...\n');

  // Step 2: Check power
  console.log('=== 2. 查询算力 ===');
  const powerRes = await httpRequest({
    hostname: 'localhost', port: 3000, path: '/api/power', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }, null);
  console.log('Power API:', powerRes.status, powerRes.data);

  // Step 3: Generate image
  console.log('\n=== 3. 调用 /api/ai/generate (text2img) ===');
  const genBody = JSON.stringify({
    service: 'text2img',
    prompt: '敦煌风格精美项链，金色，镶嵌宝石，传统纹样',
    resolution: '1k',
    ratio: '1:1',
    count: 1
  });

  const start = Date.now();
  const genRes = await httpRequest({
    hostname: 'localhost', port: 3000, path: '/api/ai/generate', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, genBody);
  const duration = Date.now() - start;

  console.log(`Generate API: ${genRes.status} (${duration}ms)`);
  try {
    const json = JSON.parse(genRes.data);
    if (json.success) {
      console.log('✅ 图片生成成功!');
      console.log('Provider:', json.provider);
      console.log('Workflow:', json.workflow);
      console.log('图片数:', Array.isArray(json.data) ? json.data.length : 1);
      console.log('第一张图片 URL:', json.data?.[0] || json.data);
    } else {
      console.log('❌ 生成失败:', json.error, '| Provider:', json.provider);
    }
  } catch (e) {
    console.log('响应解析失败:', genRes.data.substring(0, 300));
  }
}

test().catch(console.error);
