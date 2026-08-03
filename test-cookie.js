/**
 * 测试 Cookie 认证：登录设 Cookie → 用 Cookie 访问图片
 */
const http = require('http');

function httpRequest(options, postData, extraCookies) {
  return new Promise((resolve, reject) => {
    const headers = { ...options.headers };
    if (extraCookies) {
      headers['Cookie'] = extraCookies;
    }
    const req = http.request({ ...options, headers }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        data: Buffer.concat(data)
      }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== Cookie 认证测试 ===\n');

  let cookieJar = '';

  // Step 1: 登录 → 获取 Cookie
  console.log('1️⃣ 登录 (设置 Cookie)...');
  const loginRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'admin@dunhuang.com', password: 'admin123' }));

  const setCookie = loginRes.headers['set-cookie'];
  console.log('   状态:', loginRes.status);
  console.log('   Set-Cookie:', setCookie?.[0]?.substring(0, 80));
  const loginData = JSON.parse(loginRes.data.toString());
  if (!loginData.success) { console.log('   ❌ 登录失败'); return; }
  console.log('   ✅ 登录成功!');

  // 提取 cookie 字符串
  cookieJar = setCookie?.[0]?.split(';')[0] || '';
  console.log('   Cookie:', cookieJar.substring(0, 60));

  // Step 2: 生成图片（用 Authorization Bearer）
  console.log('\n2️⃣ 生成图片 (Bearer token)...');
  const token = loginData.data.token;
  const genRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/ai/generate', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, JSON.stringify({ service: 'text2img', prompt: '敦煌风格精美戒指，金色', resolution: '1k', ratio: '1:1', count: 1 }));

  const genData = JSON.parse(genRes.data.toString());
  if (!genData.success) { console.log('   ❌ 生成失败:', genData.error); return; }

  const imagePath = Array.isArray(genData.data) ? genData.data[0] : genData.data;
  console.log('   ✅ 图片生成成功! 路径:', imagePath);
  console.log('   Provider:', genData.provider, '| Workflow:', genData.workflow);

  // 解析图片路径
  const imagePathStr = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
  const[qPart1, qPart2] = imagePathStr.split('?');
  const imgPath = '/' + qPart1;
  const imgQuery = qPart2;

  // Step 3: 用 Authorization Bearer 访问图片（验证可行）
  console.log('\n3️⃣ Bearer token 访问图片...');
  const imgRes1 = await httpRequest({
    hostname: 'localhost', port: 3000, path: imgPath + '?' + imgQuery, method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }, null, null);
  console.log('   Bearer:', imgRes1.status, imgRes1.headers['content-type']);

  // Step 4: 用 Cookie 访问图片（核心测试）
  console.log('\n4️⃣ Cookie 访问图片（无需 Bearer）...');
  const imgRes2 = await httpRequest({
    hostname: 'localhost', port: 3000, path: imgPath + '?' + imgQuery, method: 'GET',
    headers: {}
  }, null, cookieJar);
  console.log('   Cookie:', imgRes2.status, imgRes2.headers['content-type']);

  if (imgRes2.status === 200 && imgRes2.data.length > 1000) {
    console.log('\n🎉 Cookie 认证成功！图片大小:', (imgRes2.data.length / 1024).toFixed(1) + 'KB');
    const desktop = 'C:\\Users\\v5316\\Desktop\\cookie_test.png';
    require('fs').writeFileSync(desktop, imgRes2.data);
    console.log('已保存到桌面:', desktop);
  } else {
    console.log('❌ Cookie 访问失败, 内容:', imgRes2.data.toString().substring(0, 200));
  }

  // Step 5: 无任何认证 → 应该 401
  console.log('\n5️⃣ 无认证访问图片（应 401）...');
  const imgRes3 = await httpRequest({
    hostname: 'localhost', port: 3000, path: imgPath + '?' + imgQuery, method: 'GET',
    headers: {}
  }, null, '');
  console.log('   无认证:', imgRes3.status);
}

main().catch(console.error);
