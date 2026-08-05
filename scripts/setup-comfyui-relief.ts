/**
 * 配置 ComfyUI 连接 + relief（图转浮雕图）工作流
 *
 * 用途：一次性初始化脚本，把 ComfyUI 连接和浮雕工作流写入数据库，
 *       使 callComfyUI('relief') 能真正驱动 ComfyUI 生成浮雕效果。
 *
 * 用法：
 *   npx tsx scripts/setup-comfyui-relief.ts
 *
 * 工作流说明（基于 ComfyUI 内置节点，无需自定义节点）：
 *   LoadImage → MiDaS-DepthMapPreprocessor（深度图） → PreviewImage/SaveImage
 *   深度图 = 浮雕效果的灰阶置换贴图
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://dunhuang1:dunhuang2026@localhost:5432/dunhuang';

// ComfyUI 连接（web 容器内访问宿主机用 host.docker.internal；宿主机直连用 127.0.0.1）
const COMFYUI_HOST = process.env.COMFYUI_CONNECT_HOST || 'host.docker.internal';

// relief 工作流：LoadImage → MiDaS 深度图 → SaveImage
// MiDaS-DepthMapPreprocessor 生成深度图，视觉上即"浮雕/置换"效果
const RELIEF_WORKFLOW = {
  // LoadImage 节点（id: "1"）—— image 参数由 nodeMapping inputImage 注入
  '1': {
    class_type: 'LoadImage',
    inputs: { image: '' },
  },
  // MiDaS 深度图预处理器
  '2': {
    class_type: 'MiDaS-DepthMapPreprocessor',
    inputs: {
      image: ['1', 0],
      // 参数：depth_map 相关配置（a/b 为深度归一化参数）
      a: 6.0,
      b: 0.1,
    },
  },
  // SaveImage 输出
  '3': {
    class_type: 'SaveImage',
    inputs: {
      images: ['2', 0],
      filename_prefix: 'relief_output',
    },
  },
};

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('✅ 已连接数据库');

  // 1. 插入 ComfyUI 连接（幂等）
  await client.query(
    `INSERT INTO comfyui_connections (id, name, host, port, enabled, is_default, priority, timeout)
     VALUES ($1, $2, $3, 8188, true, true, 0, 120000)
     ON CONFLICT (id) DO UPDATE SET
       host = EXCLUDED.host, enabled = true, is_default = true`,
    ['comfyui-local', '本地 ComfyUI', COMFYUI_HOST]
  );
  console.log(`✅ ComfyUI 连接已配置: ${COMFYUI_HOST}:8188`);

  // 2. 插入 relief 工作流配置（幂等）
  const nodeMapping = {
    inputImage: '1', // 上传的图片 → LoadImage 节点 id=1
    modelWeight: '2', // 权重 → MiDaS 节点 a 参数（深度强度）
    depthLevel: '2', // 深浅浮雕 → 也可映射（默认忽略，走权重）
  };
  const defaultParams = { width: 512, height: 512 };
  const fixedParams = {};

  await client.query(
    `INSERT INTO comfyui_configs
       (id, feature_id, workflow_id, workflow_json, node_mapping, default_params, fixed_params, connection_id, enabled, is_default, description)
     VALUES ($1, 'relief', 'relief-midas', $2, $3, $4, $5, 'comfyui-local', true, true, '图转浮雕图 - MiDaS 深度图工作流')
     ON CONFLICT (id) DO UPDATE SET
       workflow_json = EXCLUDED.workflow_json,
       node_mapping = EXCLUDED.node_mapping,
       default_params = EXCLUDED.default_params,
       enabled = true, is_default = true`,
    [
      'relief-midas',
      JSON.stringify(RELIEF_WORKFLOW),
      JSON.stringify(nodeMapping),
      JSON.stringify(defaultParams),
      JSON.stringify(fixedParams),
    ]
  );
  console.log('✅ relief 工作流已配置 (MiDaS 深度图)');

  // 3. 验证
  const conns = await client.query('SELECT id, name, host, port FROM comfyui_connections WHERE enabled = true');
  console.log('\n连接列表:', JSON.stringify(conns.rows));
  const cfgs = await client.query("SELECT feature_id, workflow_id FROM comfyui_configs WHERE enabled = true");
  console.log('工作流配置:', JSON.stringify(cfgs.rows));

  await client.end();
  console.log('\n🎉 配置完成！现在 relief 任务会走 ComfyUI 执行器');
}

main().catch((e) => {
  console.error('❌ 配置失败:', e.message);
  process.exit(1);
});
