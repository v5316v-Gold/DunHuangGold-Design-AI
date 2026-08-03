/**
 * 敦煌金AI设计平台 - OpenClaw 九色鹿集成
 * 
 * 使用方法:
 *   node openclaw-integration.js "你的问题"
 * 
 * API调用示例:
 *   const result = await callJiuSeLu("帮我设计一个敦煌风格项链");
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * 调用九色鹿AI助手
 * @param {string} message - 用户消息
 * @param {object} options - 配置选项
 * @returns {Promise<object>} - AI响应结果
 */
async function callJiuSeLu(message, options = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      'agent',
      '--agent', 'main',
      '--message', message,
      '--json'
    ];

    const openclaw = spawn('openclaw', args, {
      cwd: process.cwd(),
      env: { ...process.env },
      shell: true
    });

    let stdout = '';
    let stderr = '';

    openclaw.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    openclaw.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    openclaw.on('close', (code) => {
      if (code === 0) {
        try {
          const response = JSON.parse(stdout);
          resolve({
            success: true,
            text: response.result?.payloads?.[0]?.text || '',
            full: response
          });
        } catch (e) {
          reject(new Error(`JSON解析失败: ${e.message}\n输出: ${stdout}`));
        }
      } else {
        reject(new Error(`OpenClaw CLI失败: ${stderr || stdout}`));
      }
    });

    openclaw.on('error', (err) => {
      reject(new Error(`启动OpenClaw失败: ${err.message}`));
    });
  });
}

/**
 * 简单的REST API包装器 (用于Express/Koa等框架)
 */
function createOpenClawRouter(router) {
  /**
   * POST /api/ai/chat
   * Body: { "message": "问题内容" }
   */
  router.post('/api/ai/chat', async (ctx) => {
    try {
      const { message } = ctx.request.body;
      if (!message) {
        ctx.status = 400;
        ctx.body = { error: 'message is required' };
        return;
      }

      const result = await callJiuSeLu(message);
      ctx.body = result;
    } catch (err) {
      ctx.status = 500;
      ctx.body = { error: err.message };
    }
  });

  /**
   * GET /api/ai/health
   * 健康检查
   */
  router.get('/api/ai/health', (ctx) => {
    ctx.body = { status: 'ok', service: '九色鹿AI助手' };
  });
}

// 测试命令行调用
if (require.main === module) {
  const message = process.argv[2] || '你好，九色鹿！请简单介绍一下自己。';
  
  console.log('🔮 调用九色鹿AI助手...');
  console.log(`📝 问题: ${message}\n`);
  
  callJiuSeLu(message)
    .then(result => {
      console.log('✅ 成功!');
      console.log(`\n🤖 九色鹿回复:\n${result.text}`);
    })
    .catch(err => {
      console.error('❌ 失败:', err.message);
      process.exit(1);
    });
}

module.exports = { callJiuSeLu, createOpenClawRouter };
