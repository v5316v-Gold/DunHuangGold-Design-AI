// Minimax API 连通性测试
const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY!;

async function main() {
  // 试 list models
  console.log('=== 试 list models ===');
  const modelsRes = await fetch(`${MINIMAX_API_BASE}/models`, {
    headers: { Authorization: `Bearer ${MINIMAX_API_KEY}` },
  });
  console.log('状态:', modelsRes.status);
  if (modelsRes.ok) {
    const data = await modelsRes.json();
    console.log('模型数:', data.data?.length || 0);
  } else {
    console.log('错误:', (await modelsRes.text()).substring(0, 200));
  }

  // 试 chat completion（图片生成模型）
  console.log('\n=== 试 image_generation ===');
  const imgRes = await fetch(`${MINIMAX_API_BASE}/image_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt: 'a gold ring',
      aspect_ratio: '1:1',
      num_images: 1,
    }),
  });
  console.log('状态:', imgRes.status);
  const data = await imgRes.json();
  console.log('响应:', JSON.stringify(data).substring(0, 300));
}

main().catch((err) => { console.error(err); process.exit(1); });