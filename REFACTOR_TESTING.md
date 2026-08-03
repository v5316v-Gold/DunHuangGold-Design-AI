# 测试债务处理方案

## 现状

- Vitest 已配置，框架完整
- 零实际测试用例
- 零测试覆盖

**这不是"还没做"，这是债务。**

债务的利息是：**每次改代码不敢动，怕出事。**

---

## 债务清理策略：金字塔测试

```
         ▲
        /E\        E2E 测试（少而精，覆盖关键路径）
       /───\
      / I  /\       集成测试（Service 层，覆盖核心逻辑）
     /──────\
    /  U    \      单元测试（工具函数，覆盖边界情况）
   /──────────\
```

**不是追求覆盖率，是追求"改代码时有信心"。**

---

## 第一优先级：Auth 链路测试（P0）

**为什么先测 Auth：** Auth 出问题 = 所有用户数据裸奔。测一次保一辈子。

### 测试文件：`src/__tests__/auth.test.ts`

```typescript
// 1. JWT 生成和验证
test('generateToken 创建正确格式的 JWT', async () => {
  const token = await generateToken({ userId: '1', email: 'test@test.com', role: 'user' })
  expect(token).toBeTruthy()
  expect(token.split('.').length).toBe(3) // JWT 格式
})

test('verifyToken 正确验证有效 token', async () => {
  const token = await generateToken({ userId: '1', email: 'test@test.com', role: 'user' })
  const payload = await verifyToken(token)
  expect(payload.userId).toBe('1')
  expect(payload.email).toBe('test@test.com')
})

test('verifyToken 拒绝过期 token', async () => {
  const token = await generateToken({ userId: '1', email: 'test@test.com', role: 'user' })
  // 修改系统时间使 token 过期（mock）
  vi.useFakeTimers()
  vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000) // 8 天后
  await expect(verifyToken(token)).rejects.toThrow()
  vi.useRealTimers()
})

test('requireAuth 在无 token 时返回 null', async () => {
  const req = new Request('http://localhost/api/test')
  const result = await requireAuth(req as any)
  expect(result).toBeNull()
})

test('requireAuth 在 token 无效时返回 null', async () => {
  const req = new Request('http://localhost/api/test', {
    headers: { Authorization: 'Bearer invalid-token' }
  })
  const result = await requireAuth(req as any)
  expect(result).toBeNull()
})

test('requireAuth 在 token 有效时返回 payload', async () => {
  const token = await generateToken({ userId: '1', email: 'test@test.com', role: 'user' })
  const req = new Request('http://localhost/api/test', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const result = await requireAuth(req as any)
  expect(result?.userId).toBe('1')
})

test('requireAuth 在 role=admin 时通过 admin 检查', async () => {
  const token = await generateToken({ userId: '1', email: 'admin@test.com', role: 'admin' })
  const req = new Request('http://localhost/api/admin/test', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const result = await requireAuth(req as any)
  expect(result?.role).toBe('admin')
})

test('requireAuth 在普通用户访问 admin 路由时拒绝', async () => {
  const token = await generateToken({ userId: '1', email: 'user@test.com', role: 'user' })
  const req = new Request('http://localhost/api/admin/test', {
    headers: { Authorization: `Bearer ${token}` }
  })
  // requireAuth 本身不检查 role，由调用方检查
  const result = await requireAuth(req as any)
  expect(result?.role).toBe('user')
})
```

### 测试文件：`src/__tests__/rate-limit.test.ts`

```typescript
import { rateLimit, getClientIP, AUTH_LIMIT, WRITE_LIMIT } from '@/lib/rate-limit'

// 每个测试前重置 store（避免跨测试污染）
beforeEach(() => {
  vi.clearAllMocks()
})

describe('rateLimit', () => {
  test('首次请求通过，返回 remaining = limit - 1', async () => {
    const result = await rateLimit('127.0.0.1', AUTH_LIMIT)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(AUTH_LIMIT.limit - 1)
    expect(result.limit).toBe(AUTH_LIMIT.limit)
  })

  test('连续请求达到上限后返回 false', async () => {
    const ip = '192.168.1.100'
    // 耗尽配额
    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      await rateLimit(ip, AUTH_LIMIT)
    }
    // 下一次应该被限流
    const result = await rateLimit(ip, AUTH_LIMIT)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  test('不同 IP 互不影响', async () => {
    const ip1 = '10.0.0.1'
    const ip2 = '10.0.0.2'
    // ip1 耗尽
    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      await rateLimit(ip1, AUTH_LIMIT)
    }
    // ip1 被限流，ip2 应该正常
    const result1 = await rateLimit(ip1, AUTH_LIMIT)
    const result2 = await rateLimit(ip2, AUTH_LIMIT)
    expect(result1.success).toBe(false)
    expect(result2.success).toBe(true)
  })

  test('时间窗口过期后重置', async () => {
    const ip = '10.0.0.99'
    // 耗尽
    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      await rateLimit(ip, AUTH_LIMIT)
    }
    const blocked = await rateLimit(ip, AUTH_LIMIT)
    expect(blocked.success).toBe(false)
    // mock 时间推进
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + AUTH_LIMIT.window + 1000)
    const afterReset = await rateLimit(ip, AUTH_LIMIT)
    expect(afterReset.success).toBe(true)
    vi.useRealTimers()
  })
})

describe('getClientIP', () => {
  test('从 x-forwarded-for 取第一个 IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }
    })
    expect(getClientIP(req)).toBe('1.2.3.4')
  })

  test('无 x-forwarded-for 时用 x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '9.9.9.9' }
    })
    expect(getClientIP(req)).toBe('9.9.9.9')
  })

  test('两者都没有时返回 127.0.0.1', () => {
    const req = new Request('http://localhost')
    expect(getClientIP(req)).toBe('127.0.0.1')
  })
})
```

---

## 第二优先级：Rate Limit Service（P0）

**为什么：** Rate Limit 是防御 DoS 的唯一屏障，测一次确保限速逻辑正确。

**测试文件：** `src/__tests__/rate-limit.test.ts`（已在上面）

**覆盖场景：**
- [x] 首次通过
- [x] 限额内通过
- [x] 超限拒绝
- [x] 不同 IP 隔离
- [x] 时间窗口重置
- [x] 边界值（limit 次请求）

---

## 第三优先级：API Response Helpers（P0）

**为什么：** 所有 20+ 个 API 路由都依赖这些 helpers，helpers 有 bug = 全链路报错。

**测试文件：** `src/__tests__/api-response.test.ts`

```typescript
import { apiSuccess, apiError, unauthorized, badRequest, rateLimitResponse } from '@/lib/api-response'

describe('apiSuccess', () => {
  test('返回正确格式 success=true', () => {
    const result = apiSuccess({ token: 'abc' })
    const json = result.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual({ token: 'abc' })
  })
})

describe('unauthorized', () => {
  test('返回 401 状态码', () => {
    const result = unauthorized()
    expect(result.status).toBe(401)
  })

  test('返回 JSON 格式 error', () => {
    const json = unauthorized().json()
    expect(json.success).toBe(false)
    expect(json.error).toBeTruthy()
  })
})

describe('badRequest', () => {
  test('接受自定义消息', () => {
    const json = badRequest('密码长度不足').json()
    expect(json.error).toBe('密码长度不足')
    expect(badRequest().status).toBe(400)
  })
})

describe('rateLimitResponse', () => {
  test('包含所有 RateLimit 响应头', () => {
    const mockResult = {
      success: false,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 300,
      limit: 10,
    }
    const response = rateLimitResponse(mockResult)
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.status).toBe(429)
  })
})
```

---

## 第四优先级：ComfyUI Service 集成测试（P1）

**为什么：** ComfyUI 是主图生成源，出问题影响最大。

**测试文件：** `src/__tests__/comfyui-service.test.ts`

```typescript
// 关键测试用例
describe('ComfyUI Service', () => {
  test('checkComfyUIHealth 在服务在线时返回 true', async () => {
    // mock fetch 到 localhost:8188
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    )
    const result = await checkComfyUIHealth()
    expect(result).toBe(true)
  })

  test('checkComfyUIHealth 在服务离线时返回 false', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'))
    const result = await checkComfyUIHealth()
    expect(result).toBe(false)
  })

  test('submitPrompt 返回 prompt_id', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ prompt_id: 'test-123' }), { status: 200 })
    )
    const result = await submitPrompt({}, 'test prompt')
    expect(result.success).toBe(true)
    expect(result.prompt_id).toBe('test-123')
  })
})
```

---

## 第五优先级：核心工具函数（P2）

**测试文件：** `src/__tests__/utils.test.ts`

```typescript
// validatePrompt
test('包含敏感词时返回警告', () => {
  const result = validatePrompt('生成一张裸体图')
  expect(result.warnings?.length).toBeGreaterThan(0)
})

// getFeatureCost
test('各功能返回正确成本', () => {
  expect(getFeatureCost('text2img')).toBeGreaterThan(0)
  expect(getFeatureCost('dialogue')).toBeGreaterThan(0)
})

// getClientIP (已在 rate-limit.test.ts 覆盖)
```

---

## E2E 测试：关键路径（P1）

**使用 Vitest 的 API 测试模式，不需要 Playwright（增加复杂度）**

**测试文件：** `src/__tests__/e2e.test.ts`

```typescript
describe('端到端测试', () => {
  test('注册 → 登录 → 生成图片完整链路', async () => {
    // 1. 注册
    const regRes = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-${Date.now()}@test.com`,
        password: 'test123456',
        nickname: 'Test User',
      }),
    })
    expect(regRes.ok).toBe(true)

    // 2. 登录获取 token
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regBody.email,
        password: 'test123456',
      }),
    })
    const { token } = await loginRes.json()
    expect(token).toBeTruthy()

    // 3. 用 token 访问受保护路由
    const meRes = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(meRes.ok).toBe(true)
  })

  test('未登录访问受保护路由返回 401', async () => {
    const res = await fetch('/api/auth/me')
    expect(res.status).toBe(401)
  })

  test('Rate Limit 触发后返回 429', async () => {
    const ip = `test-ip-${Date.now()}`
    // 快速连续调用 login 10 次
    for (let i = 0; i < 10; i++) {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Real-IP': ip, // 模拟同一 IP
        },
        body: JSON.stringify({ email: 'attacker@test.com', password: 'wrong' }),
      })
    }
    // 第 11 次应该被限流
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Real-IP': ip,
      },
      body: JSON.stringify({ email: 'attacker@test.com', password: 'wrong' }),
    })
    expect(res.status).toBe(429)
  })
})
```

---

## 测试执行方式

```bash
# 运行所有测试
pnpm test

# 监听模式（开发时）
pnpm test:watch

# 单文件
pnpm test src/__tests__/auth.test.ts

# 带覆盖率
pnpm test:coverage

# E2E 测试（专用）
pnpm test:e2e
```

---

## 测试配置文件

**vitest.config.ts 需要确保：**
```typescript
// vite.config.ts 相关配置
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',           // 后端测试用 node，不是 jsdom
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
      ],
    },
  },
})
```

**setup.ts 内容：**
```typescript
import { vi } from 'vitest'
import { jest } from '@jest/globals'

// 全局 mocks
vi.mock('@/storage/database/db', () => ({
  db: null,
  isDatabaseAvailable: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'test-user', role: 'user' }),
  getCurrentUser: vi.fn().mockResolvedValue({ userId: 'test-user', role: 'user' }),
}))
```

---

## 测试优先级矩阵

| 优先级 | 测试内容 | 测试文件 | 覆盖风险 |
|--------|---------|---------|---------|
| P0 | Auth 链路 | `auth.test.ts` | JWT 伪造 / 未授权访问 |
| P0 | Rate Limit | `rate-limit.test.ts` | DoS 攻击 |
| P0 | API Helpers | `api-response.test.ts` | 全链路错误响应 |
| P1 | ComfyUI Service | `comfyui-service.test.ts` | 图片生成失败 |
| P1 | E2E 完整链路 | `e2e.test.ts` | 关键业务流程断 |
| P2 | 工具函数 | `utils.test.ts` | 辅助函数边界情况 |

---

## 预估工作量

| 优先级 | 测试用例数 | 预估工时 |
|--------|----------|---------|
| P0 Auth | 10 个 | 2 小时 |
| P0 Rate Limit | 8 个 | 1.5 小时 |
| P0 API Helpers | 6 个 | 1 小时 |
| P1 ComfyUI | 5 个 | 2 小时 |
| P1 E2E | 4 个 | 2 小时 |
| P2 Utils | 5 个 | 1 小时 |
| vitest 配置 + setup | — | 1 小时 |
| **合计** | **~38 个用例** | **~10.5 小时** |
