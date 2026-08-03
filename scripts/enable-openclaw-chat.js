/**
 * 启用九色鹿 AI 对话
 * 运行: node scripts/enable-openclaw-chat.js
 */

const { db } = require('../src/db/db');

async function updateConfig() {
  try {
    // 检查连接
    await db.execute({ sql: 'SELECT 1' });
    console.log('✓ 数据库连接正常');

    const configValue = JSON.stringify({
      apiKey: '',
      provider: 'openclaw',
      model: 'MiniMax-M2.7-highspeed'
    });

    // 更新 systemSettings 表
    await db.execute({
      sql: `INSERT INTO system_settings (key, value, description) 
            VALUES ('ai-assistant-config', $1, '提示词小助手配置') 
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      params: [configValue]
    });
    console.log('✓ systemSettings 更新成功');

    // 更新 api_configs 表
    await db.execute({
      sql: `INSERT INTO api_configs (id, name, api_key, provider, model, enabled) 
            VALUES ('llm-chat', 'LLM Chat', '', 'openclaw', 'MiniMax-M2.7-highspeed', true) 
            ON CONFLICT (id) DO UPDATE SET provider = EXCLUDED.provider, model = EXCLUDED.model, enabled = EXCLUDED.enabled`
    });
    console.log('✓ apiConfigs 更新成功');

    console.log('\n✅ 已将 AI 对话切换为 OpenClaw 九色鹿模式');
    console.log('\n📝 下次访问 AI 对话时，将自动使用九色鹿 AI 助手');
  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    process.exit(0);
  }
}

updateConfig();
