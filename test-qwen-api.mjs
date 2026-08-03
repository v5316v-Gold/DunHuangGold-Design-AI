// 测试通义千问API
import https from 'https';

const API_KEY = 'sk-891e983efeaa4a20930694393389f662';
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const options = {
  hostname: 'dashscope.aliyuncs.com',
  port: 443,
  path: '/compatible-mode/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

const body = JSON.stringify({
  model: 'qwen-turbo',
  messages: [
    {
      role: 'user',
      content: '你好，请简单自我介绍一下',
    },
  ],
});

req.write(body);
req.end();
