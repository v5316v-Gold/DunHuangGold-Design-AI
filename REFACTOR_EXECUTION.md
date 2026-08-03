# 三项重构建议 — 执行总计划

## 执行顺序

```
Week 1        Week 2        Week 3        Week 4
─────────────────────────────────────────────────
测试债务      AI 代理层      路由合并      收尾
P0 → P1      新路由         逐步合并      旧路由删除
             服务实现        旧路由标记    文档更新
             deprecated
```

---

## Week 1：测试债务 ✅

**完成状态：** 126 个测试用例（超出目标 38 个）

**产出文件：**
```
src/test/
├── setup.ts              ← 全局 mocks + JWT_SECRET 配置
├── auth.test.ts          ← 17 个用例（JWT生成/验证/过期/requireAuth）
├── rate-limit.test.ts     ← 16 个用例（配额/IP隔离/窗口重置/getClientIP）
├── api-response.test.ts   ← 27 个用例（apiSuccess/apiError/unauthorized等）
├── comfyui-service.test.ts← 11 个用例（健康检查/prompt提交/错误处理）
├── e2e.test.ts           ← 12 个用例（skip：需真实服务器）
├── features-config.test.ts ← 13 个用例
├── validators.test.ts    ← 22 个用例
└── error-handler.test.ts  ← 13 个用例
```

**验收标准：** ✅ 已达成
```bash
pnpm vitest run
# 126 passed | 12 skipped (E2E)
```

---

## Week 2-3：AI 代理层 ✅

**完成状态：** 完整架构已上线，`/api/ai/generate` 统一入口可用

**产出文件：**
```
src/lib/ai-service/
├── types.ts                  ← AIServiceType/GenerationRequest/Result
├── service-registry.ts       ← ServiceRegistry + parseImageSize helpers
├── generation-pipeline.ts   ← Auth → CheckPower → Execute → CloudFallback → Save → Deduct
├── storage-helper.ts        ← saveImageFromUrl/saveImagesFromUrls
└── services/
    ├── index.ts             ← 自动注册所有服务
    ├── text2img.ts          ← ComfyUI Z-Turbo → SD1.5 → Minimax
    ├── refine.ts             ← ComfyUI refineImage → Minimax img2img
    └── relief.ts            ← ComfyUI reliefEffect → Meshy → Minimax

src/app/api/ai/generate/route.ts ← 统一入口（POST + GET list）
```

**验收标准：** ✅ Build 成功，126 测试通过

---

## Week 3-4：路由合并（渐进式）✅ 已完成

**执行策略：不破坏现有功能，逐批处理**

### ✅ Phase 1：AI 生成类（14 路由 deprecated）
- 14 个旧路由标记 `@deprecated` + 转发到 `/api/ai/generate`
- `src/lib/deprecated-route.ts` — 统一转发工具
- 路由：generate-image, product-refine, multi-image, one-click-design,
  multi-view, sketch-realistic, free-creation, relief, image-3d,
  stereo, remove-background, upscale, remove-watermark, video

### 🟡 Phase 2：ComfyUI 路由（标记 deprecated，未破坏实现）
- ComfyUI 子路由 status/progress/prompt/execute/call 已标记 `@deprecated`
- 保留原有实现以保证向后兼容
- 主路由 `/api/comfyui` 已具备完整 action handler

### ✅ Phase 3：Admin 用户/算力路由（标记 deprecated）
- `admin/users/route.ts` + `users/[id]/recharge/route.ts` → deprecated
- `admin/power/route.ts` + `power/recharge/route.ts` + `power/transactions/route.ts` → deprecated
- `admin/api-config-db/route.ts` + `ai-assistant-config` + `feature-costs` + `translate-settings` → deprecated

### ✅ Phase 4：Admin 设置类（已完成）
- `admin/api-config/route.ts` → `@deprecated` + `X-Deprecated-Source` 响应头
- `admin/app-settings/route.ts` → `@deprecated` + `X-Deprecated-Source` 响应头
- ComfyUI admin: connections/[id] + workflows/[id] → 已存在于新架构，无需合并

### ✅ Phase 5：系统类 + Works（已完成）
- `stats/route.ts` → `@deprecated` + `X-Deprecated-Source: stats`
- `admin/stats/route.ts` → `@deprecated` + `X-Deprecated-Source: admin/stats`
- `works/[id]/route.ts` → `@deprecated` + `X-Deprecated-Source: works/[id]`
- `works/[id]/download/route.ts` → `@deprecated` + `X-Deprecated-Source`
- `works/batch-delete/route.ts` → `@deprecated` + GET 410 响应

### ✅ Phase 6：AI 对话类（已完成）
- `ai-assistant/route.ts` → `@deprecated` + POST 转发 `/api/chat` + GET 410
- `openclaw-chat/route.ts` → `@deprecated` + POST 转发 `/api/chat` + GET 410
- `chat/route.ts` → 保留（合并目标）

**90 天删除倒计时（2026-08-17）已启动**

**验收标准：** ✅ TypeScript 0 errors，126 测试通过

### Week 4 收尾任务
- ⏳ 删除所有 `@deprecated` 旧路由（**2026-08-17** 后执行）
- ✅ 90 天 window 已设置（从 2026-05-17 标记日起）
- ✅ 更新 `REFACTOR_ROUTE_ANALYSIS.md` 标记完成状态
- ⏳ 生产环境 `ALLOWED_ORIGIN` 改为实际域名
- ⏳ Redis 速率限制器（内存→Redis 升级）

---

## 质量保障

### 每个阶段结束时必须通过

```bash
# 1. TypeScript 编译
npx tsc --noEmit

# 2. ESLint 检查
npx eslint src --quiet

# 3. 测试（如果写了测试）
pnpm test

# 4. Build
npx next build

# 5. PM2 重启验证
pm2 restart dunhuang-app
pm2 logs dunhuang-app --lines 20
```

### 回退策略

如果某阶段出问题：
1. `git checkout` 回退到上一个 commit
2. 找到问题，修复后重新执行
3. **不跳过任何验收步骤**

---

## 人员安排

**如果是一个人做：**

```
周一：测试 P0（auth + rate-limit）
周二：测试 P1（comfyui + e2e）
周三：AI 代理层框架 + text2img 服务
周四：refine + relief 服务 + 新路由
周五：路由合并第一批（admin stats）
```

**如果是两个人：**

```
A：测试债务 + AI 代理层
B：路由合并（同步进行）
```

---

## 最终交付物

| 文件 | 说明 |
|------|------|
| `REFACTOR_ROUTE_ANALYSIS.md` | 77→33 路由合并方案 |
| `REFACTOR_AI_LAYER.md` | AI 代理层架构设计 |
| `REFACTOR_TESTING.md` | 测试债务处理方案 |
| `REFACTOR_EXECUTION.md` | 执行总计划 |
| `src/lib/ai-service/` | AI 代理层代码 |
| `src/app/api/ai/generate/route.ts` | 统一生成入口 |
| `src/__tests__/*.test.ts` | ~38 个测试用例 |
| `src/__tests__/setup.ts` | 测试全局配置 |
