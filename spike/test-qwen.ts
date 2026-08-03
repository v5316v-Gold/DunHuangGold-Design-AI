// Qwen API 连通性测试
const QWEN_API_BASE = process.env.QWEN_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const QWEN_API_KEY = process.env.QWEN_API_KEY!;

async function main() {
  const res = await fetch(`${QWEN_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${QWEN_API_KEY}` },
    body: JSON.stringify({
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 50,
    }),
  });

  console.log('状态:', res.status);
  const data = await res.json();
  console.log('响应:', JSON.stringify(data).substring(0, 300));
}

main().catch((err) => { console.error(err); process.exit(1); });