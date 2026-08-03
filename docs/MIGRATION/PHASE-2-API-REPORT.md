# Phase 2 · API 基础迁移指南

**Spec**: docs/03-L2-API.md §6, §7, §8
**Status**: 基础就位 + 15 单测通过（envelope + 7 middleware）
**ADRs applied**: ADR-013 (Thin API Routes)

## 1. 新增文件

| File | Purpose |
|---|---|
| `src/lib/api/envelope.ts` | 16 错误码 + ApiSuccess / ApiFailure + 便捷别名 |
| `src/lib/api/middleware.ts` | 7 middleware（withRequestContext / withAuth / withAdmin / withValidation / withRateLimit / withIdempotency / withAudit） |
| `src/test/api-envelope.test.ts` | 15 单测：error code + HTTP status + idempotency + auth + rate limit |

## 2. API Envelope 设计

### Success

```json
{
  "success": true,
  "data": <T>,
  "requestId": "req_xxx",
  "meta": { ... }            // 可选
}
```

### Failure

```json
{
  "success": false,
  "error": {
    "code": "FEATURE_NOT_FOUND",   // 16 错误码之一
    "message": "no such feature",   // 用户友好
    "details": { ... }              // 可选（zod issues、原始 err）
  },
  "requestId": "req_xxx"
}
```

### 16 错误码 → HTTP 状态

| Error Code | HTTP | 含义 |
|---|---|---|
| `AUTH_REQUIRED` | 401 | 未登录 |
| `INVALID_CREDENTIALS` | 401 | token 无效 |
| `PERMISSION_DENIED` | 403 | 无权限 |
| `INVALID_INPUT` | 400 | 参数错误 |
| `FEATURE_NOT_FOUND` | 404 | 功能不存在 |
| `FEATURE_DISABLED` | 422 | 功能已禁用 |
| `INSUFFICIENT_POWER` | 422 | 算力不足 |
| `DUPLICATE_REQUEST` | 409 | 重复请求 |
| `TASK_NOT_FOUND` | 404 | 任务不存在 |
| `TASK_NOT_CANCELLABLE` | 409 | 任务不可取消 |
| `PROVIDER_UNAVAILABLE` | 503 | AI 服务不可用 |
| `WORKFLOW_NOT_FOUND` | 404 | 工作流不存在 |
| `WORKFLOW_FAILED` | 500 | 工作流执行失败 |
| `STORAGE_FAILED` | 502 | 存储失败 |
| `RATE_LIMITED` | 429 | 限流 |
| `INTERNAL_ERROR` | 500 | 内部错误 |

## 3. Middleware 设计

### 链式调用

```ts
import { withAuth, withAdmin, withValidation, withIdempotency, withRateLimit, withAudit } from '@/lib/api/middleware';
import { z } from 'zod';

const schema = z.object({ prompt: z.string().min(1) });

export const POST = withIdempotency(
  withAuth(
    withValidation(schema)(
      withRateLimit({ max: 20, windowMs: 60_000 })(
        async (ctx, body) => ok({ result: '...', requestId: ctx.requestId }, ctx)
      )
    )
  )
);
```

### 或用 dispatch 助手（更简洁）

```ts
import { dispatch } from '@/lib/api/middleware';

export const POST = async (request: NextRequest) => {
  return dispatch(request, async (ctx, body: z.infer<typeof schema>) => {
    return ok({ taskId: 'xxx' }, ctx);
  }, {
    schema,
    auth: 'user',
  });
};
```

## 4. 旧 envelope 兼容（不立即迁移 92 路由）

`src/lib/api-response.ts`（老）保留：
- `apiSuccess` / `apiError` / `apiSuccessRaw` 仍可用
- 不带 `requestId` 字段（兼容现有 92 路由）

新路由用 `src/lib/api/envelope.ts`：
- `ok(data, ctx)` / `fail(code, message, ctx)` / `ApiErrors.xxx`
- 强制带 `requestId`

**迁移路径（Phase 3 后逐步执行）**：
1. 新写路由直接用新 envelope
2. 老路由改造时按业务域分批替换
3. 全部替换后删除 `src/lib/api-response.ts`

## 5. 幂等防双扣设计（per 03-L2 §10）

```
1. validate idempotency key (header Idempotency-Key 必填)
2. SETNX 抢占 (Redis: NX)
3. 若已存在 → 比对 requestHash
   - 相同 hash → DUPLICATE_REQUEST 409
   - 不同 hash → INVALID_INPUT 400 (key 被占用)
4. 首次请求通过 → handler 执行
```

**关键保证**：
- 同一 key + 同一 body → 永远不双扣
- 同一 key + 不同 body → 拒绝（防 key 复用攻击）
- Redis 失败 → fail-open（不阻塞业务）

## 6. 限流设计（per 03-L2 §6 安全）

```ts
withRateLimit({ windowMs: 60_000, max: 60 })     // IP 维度
withRateLimit({ perPath: true, max: 10 })     // IP + 路径维度
```

- 默认按 IP 限流
- `perPath: true` 时按 `IP:pathname` 限流
- 超限 → RATE_LIMITED 429
- Redis 失败 → fail-open

## 7. 测试覆盖

| Category | 测试数 | 状态 |
|---|---|---|
| 16 错误码完整性 | 1 | ✅ |
| 错误码 → HTTP 状态映射 | 1 | ✅ |
| ok() / fail() envelope | 2 | ✅ |
| 便捷别名 | 1 | ✅ |
| withAuth 三态（无 token / 无效 / 有效）| 3 | ✅ |
| withAdmin 普通用户拒绝 | 1 | ✅ |
| withValidation 合法 + 非法 | 2 | ✅ |
| withIdempotency 三态 | 3 | ✅ |
| withRateLimit 超限 | 1 | ✅ |
| **合计** | **15** | **✅ 全过** |

## 8. Phase 2 Exit Criteria（per 11-Migration §Phase 2）

| Criterion | Status |
|---|---|
| ✅ response envelope 标准化 | ✅ (envelope.ts + 15 单测) |
| ✅ 16 稳定错误码 | ✅ (per 03-L2 §7) |
| ✅ idempotency 防双扣 | ✅ (withIdempotency + 3 单测) |
| ✅ rate limit 按 IP | ✅ (withRateLimit + 1 单测) |
| ✅ validation Zod 集成 | ✅ (withValidation + 2 单测) |
| ⚠️ admin writes 走 audit | ✅ (withAudit 写好, 待 92 路由接入) |
| ⏸️ 92 路由迁移 | 留 Phase 3 (随 GenerationService 一起) |

## 9. 已知遗留（待 Phase 3 解决）

- 92 路由仍用老 `api-response.ts`（不带 requestId）
- 迁移涉及 92 文件全量改动 → 必须随 Phase 3 的 GenerationService 重构一起做
- 届时所有路由统一走 `withXxx(handler)` + `ok/fail`
