/**
 * 验证生成的图片是否可以正常访问
 */
const http = require('http');

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
  // 1. 登录获取 token
  const loginRes = await httpRequest({
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ email: 'admin@dunhuang.com', password: 'admin123' }));

  const token = JSON.parse(loginRes.data).data.token;

  // 2. 生成一张图片
  const genRes = await httpRequest({
    hostname: 'localhost', port: 3000, path: '/api/ai/generate', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, JSON.stringify({
    service: 'text2img',
    prompt: '敦煌风格佛手印戒指，纯金，镶嵌红宝石',
    resolution: '1k', ratio: '1:1', count: 1
  }));

  const genData = JSON.parse(genRes.data);
  if (!genData.success) {
    console.log('❌ 生成失败:', genData.error);
    return;
  }

  const imagePath = Array.isArray(genData.data) ? genData.data[0] : genData.data;
  console.log('✅ 生成成功! 路径:', imagePath);

  // 3. 直接用完整路径访问图片（避免 URL 解析问题）
  // imagePath 格式: /api/comfyui-image?filename=XXX&subfolder=YYY
  const [pathPart, queryPart] = imagePath.substring(1).split('?');
  console.log('Path:', pathPart, '| Query:', queryPart);

  const imgRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: '/' + pathPart + '?' + queryPart,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }, null);

  console.log('HTTP Status:', imgRes.status);
  console.log('Content-Type:', imgRes.headers['content-type']);
  console.log('Content-Length:', imgRes.headers['content-length']);

  if (imgRes.status === 200 && imgRes.data.length > 1000) {
    console.log('\n🎉 图片真实可访问! 大小:', (imgRes.data.length / 1024).toFixed(1) + 'KB');
    // 保存到桌面
    const desktop = 'C:\\Users\\v5316\\Desktop\\test_output.png';
    require('fs').writeFileSync(desktop, imgRes.data);
    console.log('已保存到桌面:', desktop);
  } else if (imgRes.status === 400) {
    const err = JSON.parse(imgRes.data.toString());
    console.log('❌ 400 错误:', err.error);
    // 打印原始 query string 分析
    console.log('\n原始 imagePath:', imagePath);
    console.log('Encoded subfolder:', encodeURIComponent('敦煌金'));
  } else {
    console.log('响应:', imgRes.data.toString('utf8').substring(0, 200));
  }
}

main().catch(console.error);
