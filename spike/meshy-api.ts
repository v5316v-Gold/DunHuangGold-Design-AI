/**
 * Spike: Meshy API 可用性测试（项目已有 key）
 * 测试目标：image-to-3d API 是否能调通
 *
 * 假设：Meshy API 在 60s 内能返回 task_id
 // Meshy API 可用性测试
 async function spikeMeshy() {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    console.error('❌ MESHY_API_KEY 未配置');
    process.exit(1);
  }
  console.log('🔑 API Key 已找到（前 10 位）:', apiKey.substring(0, 10) + '...');

  try {
    // 测试 1：列出可用模型（简单 GET）
    console.log('\n📋 测试 1: GET /openapi/v2/models');
    const modelsRes = await fetch('https://api.meshy.ai/openapi/v2/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    console.log('   状态:', modelsRes.status);
    if (modelsRes.ok) {
      const models = await modelsRes.json();
      console.log('   返回数量:', Array.isArray(models) ? models.length : 'N/A');
    } else {
      console.log('   错误:', await modelsRes.text().catch(() => 'N/A'));
    }

    // 测试 2：列账户信息
    console.log('\n📋 测试 2: GET /openapi/v2/balance');
    const balanceRes = await fetch('https://api.meshy.ai/openapi/v2/balance', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    console.log('   状态:', balanceRes.status);
    if (balanceRes.ok) {
      const balance = await balanceRes.json();
      console.log('   余额:', JSON.stringify(balance));
    }
  } catch (err) {
    console.error('❌ 网络错误:', err);
    process.exit(1);
  }
}

main();