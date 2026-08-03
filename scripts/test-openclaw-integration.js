/**
 * OpenClaw 九色鹿集成测试脚本
 * 
 * 用于验证九色鹿 AI 是否正确集成到敦煌金平台
 * 
 * 运行方式:
 *   node scripts/test-openclaw-integration.js
 */

const { spawn } = require('child_process');

// 测试配置
const TEST_CONFIG = {
  testCases: [
    {
      name: '简单对话',
      message: '你好，请回复"测试成功"'
    },
    {
      name: '敦煌知识',
      message: '敦煌风格首饰设计有什么特点？'
    },
    {
      name: '设计建议',
      message: '请帮我设计一个敦煌风格的项链'
    }
  ]
};

/**
 * 调用九色鹿 AI
 */
function callJiuSeLu(message) {
  return new Promise((resolve, reject) => {
    const args = [
      'agent',
      '--agent', 'main',
      '--message', message,
      '--json'
    ];

    console.log(`\n📤 发送消息: ${message}`);

    const openclaw = spawn('openclaw', args, {
      shell: true,
      windowsHide: true,
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
          const text = response.result?.payloads?.[0]?.text || '';
          resolve(text);
        } catch (e) {
          reject(new Error(`JSON解析失败: ${e.message}`));
        }
      } else {
        reject(new Error(`OpenClaw CLI失败: ${stderr || '未知错误'}`));
      }
    });

    openclaw.on('error', (err) => {
      reject(new Error(`启动OpenClaw失败: ${err.message}`));
    });

    // 超时处理（60秒）
    setTimeout(() => {
      openclaw.kill();
      reject(new Error('调用超时（60秒）'));
    }, 60000);
  });
}

/**
 * 运行测试
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('  敦煌金AI设计平台 - 九色鹿集成测试');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CONFIG.testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 测试: ${testCase.name}`);
    console.log('='.repeat(60));

    try {
      const startTime = Date.now();
      const result = await callJiuSeLu(testCase.message);
      const duration = Date.now() - startTime;

      console.log(`\n✅ 成功! (${duration}ms)`);
      console.log(`\n🤖 九色鹿回复:\n${result.substring(0, 200)}${result.length > 200 ? '...' : ''}`);
      passed++;
    } catch (err) {
      console.log(`\n❌ 失败: ${err.message}`);
      failed++;
    }

    // 每个测试之间休息一下
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(60));

  // 总结
  console.log('\n📝 总结:');
  if (failed === 0) {
    console.log('  ✅ 九色鹿 AI 集成测试全部通过!');
    console.log('  ✅ OpenClaw 可以正常调用九色鹿 AI');
    console.log('  ✅ 敦煌金平台的集成代码已就绪');
    console.log('\n  平台启动后，AI 对话功能将使用九色鹿 AI 助手。');
  } else {
    console.log('  ⚠️ 部分测试失败，请检查 OpenClaw 配置');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
