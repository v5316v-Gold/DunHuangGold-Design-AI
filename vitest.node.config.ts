// 临时 vitest 配置：node 环境 + 无 setup，用于测试 ai-services
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // setupFiles 在 worker 启动后、test file 模块加载前执行，
    // 保证 auth.ts 等模块顶层 const 读取 process.env 时 JWT_SECRET 已就绪
    setupFiles: ['./src/test/env-setup.ts'],
    globals: true,
    // 排除需要 jsdom / 真实 API / 运行中 server 的用例，使 node 套件（CI）可稳定通过
    // 注意：显式 exclude 会覆盖 Vitest 默认排除项，必须重新包含 node_modules/dist
    exclude: [
      '**/node_modules/**',   // 第三方库自带测试（默认排除项，需显式恢复）
      '**/dist/**',           // 构建产物（默认排除项，需显式恢复）
      'e2e/**',               // Playwright 浏览器测试（独立 runner，语法不兼容 vitest）
      // 以下测试需要 jsdom 环境（renderHook / React 组件 / document 对象），
      // 由默认 vitest.config.ts（environment: 'jsdom'）覆盖
      'src/test/use-task-polling.test.ts',
      'src/test/workspace-panels.test.tsx', // Phase 9.26 17 个 workspace 组件单测
      'src/test/vitest-smoke.test.ts',      // Stage 0 基础设施 smoke（jsdom + RTL）
      // 以下测试需要真实 DB（CI 跑，本地无 DB 时跳过）
      'src/test/minimax.test.ts',           // 打真实付费 MiniMax API
      'src/test/e2e.test.ts',               // 需要 dev server
      'src/test/generation-service.test.ts', // 依赖 jsdom env（policy-orchestrator import 链需要 window），归 vitest.config.ts（jsdom + setup）跑
      'src/test/token-version.test.ts',     // 依赖真实 DB（users 表 + token_version 字段）；CI postgres 跑
    ],
    // P1 · 覆盖率门禁范围：核心 AI 编排/账本/门禁/队列层
    // 排除纯接口/类型文件（ports）与 UI/路由层（app/api、components），
    // 使覆盖率统计聚焦于有业务逻辑的可测单元
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/ai/**',
        'src/lib/comfyui/**',
        'src/lib/queue/**',
        'src/lib/orchestrator/executors/**',
      ],
      exclude: [
        'src/lib/ai/ports/**', // 纯类型/接口定义，无可测逻辑
      ],
      thresholds: {
        // sync 后基线：核心 AI 编排/账本/门禁/队列层约 50%（新进 Chat/Hermes 等代码未测试覆盖）
        // 后续给新增代码补测试后再调高阈值
        statements: 50,
        branches: 65,
        functions: 55,
        lines: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});