# AI 路由代理层方案

## 目标

将 14 个独立的 AI 生成路由，替换为：
- **1 个统一入口** `/api/ai/generate`
- **1 个服务调度层** `ImageGenerationService`
- **向后完全兼容** 旧路由通过 `@deprecated` 标记转发到新路由

---

## 架构设计

```
┌──────────────────────────────────────────────────────────────┐
│                      /api/ai/generate                         │
│                  （统一入口，单一路由）                         │
└───────────────────────────┬──────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  ServiceRouter  │  ← 解析 service 类型
                    └───────┬────────┘
                            │
              ┌─────────────┼──────────────────────┐
              ▼             ▼                      ▼
   ┌──────────────┐  ┌────────────┐  ┌──────────────────┐
   │ Text2Img     │  │ Refine     │  │ ReliefDesign    │
   │ Service      │  │ Service    │  │ Service         │
   └──────┬───────┘  └─────┬──────┘  └────────┬────────┘
           │                │                    │
           └────────────────┼────────────────────┘
                          │
              ┌───────────▼──────────────────┐
              │    GenerationPipeline         │
              │  ┌────────────────────────┐ │
              │  │ 1. Auth & Power Check  │ │
              │  │ 2. Prompt Validation   │ │
              │  │ 3. ComfyUI (Primary)  │ │
              │  │ 4. Cloud API (Fallback)│ │
              │  │ 5. Save & Record      │ │
              │  │ 6. Return Result      │ │
              │  └────────────────────────┘ │
              └──────────────────────────────┘
```

---

## 核心类型定义

```typescript
// src/lib/ai-service/types.ts

export type AIServiceType = 
  | 'text2img'      // 文生图
  | 'refine'        // 产品精修
  | 'relief'        // 浮雕设计
  | 'image3d'       // 图转3D
  | 'stereo'        // 平面转立体
  | 'removebg'      // 移除背景
  | 'upscale'       // 高清放大
  | 'watermark'     // 去除水印
  | 'sketch'        // 线稿写实
  | 'blend'         // 多图融合
  | 'oneclick'      // 一键设计
  | 'multiview'     // 多视图生成
  | 'free'          // 自由创作
  | 'text2video'    // 文生视频
  | 'img2video'     // 图生视频

export interface GenerationRequest {
  service: AIServiceType
  prompt?: string
  image?: string           // 单张输入图
  images?: string[]        // 多张输入图
  negativePrompt?: string
  width?: number
  height?: number
  count?: number           // 生成数量
  resolution?: '1k' | '2k' | '4k'
  strength?: number        // 修改强度
  [key: string]: unknown  // 扩展参数
}

export interface GenerationResult {
  success: boolean
  data?: string | string[]  // 图片URL(s)
  provider: 'comfyui' | 'minimax' | 'meshy' | 'kling'
  workflow?: string
  powerCost?: number
  error?: string
}
```

---

## ServiceRegistry — 服务注册表

```typescript
// src/lib/ai-service/service-registry.ts

import type { AIServiceType, GenerationRequest, GenerationResult } from './types'

interface ServiceConfig {
  /** 服务类型 ID */
  type: AIServiceType
  /** 用户可见名称 */
  label: string
  /** 功能成本 */
  powerCost: number
  /** 是否需要输入图片 */
  requiresImage: boolean
  /** 主要提供者 */
  primaryProvider: 'comfyui' | 'cloud'
  /** ComfyUI 工作流 ID */
  comfyuiWorkflowId?: string
  /** 云端 API 配置 */
  cloudProvider?: 'minimax' | 'meshy' | 'kling'
  cloudEndpoint?: string
  cloudModel?: string
  /** 执行函数 */
  execute: (req: GenerationRequest) => Promise<GenerationResult>
}

class ServiceRegistry {
  private services = new Map<AIServiceType, ServiceConfig>()

  register(config: ServiceConfig) {
    this.services.set(config.type, config)
  }

  get(type: AIServiceType): ServiceConfig | undefined {
    return this.services.get(type)
  }

  list(): ServiceConfig[] {
    return Array.from(this.services.values())
  }

  /** 根据 cloudProvider 查找所有服务 */
  getByProvider(provider: string): ServiceConfig[] {
    return this.list().filter(s => s.primaryProvider === provider)
  }
}

export const registry = new ServiceRegistry()
```

---

## GenerationPipeline — 统一执行管道

```typescript
// src/lib/ai-service/generation-pipeline.ts

import { registry } from './service-registry'
import type { AIServiceType, GenerationRequest, GenerationResult } from './types'
import { getCurrentUser } from '@/lib/auth'
import { getFeatureCost } from '@/lib/feature-costs'
import { saveImagesFromUrls } from './storage-helper'
import { createLogger } from '@/lib/error-handler'

const logger = createLogger('generation-pipeline')

export class GenerationPipeline {
  /**
   * 执行生成（两层兜底：本地 ComfyUI → 云端 API）
   */
  async execute(
    type: AIServiceType,
    req: GenerationRequest,
    userId: string
  ): Promise<GenerationResult> {
    const config = registry.get(type)
    if (!config) {
      return { success: false, error: `未知服务类型: ${type}` }
    }

    // 1. 算力检查
    const cost = getFeatureCost(type)
    const powerOk = await this.checkPower(userId, cost)
    if (!powerOk) {
      return { success: false, error: '算力不足' }
    }

    // 2. 参数校验
    if (config.requiresImage && !req.image && !req.images?.length) {
      return { success: false, error: `${config.label}需要上传图片` }
    }

    // 3. 执行生成
    let result = await config.execute(req)

    // 4. 兜底逻辑
    if (!result.success && config.cloudProvider) {
      logger.info(`[${type}] ComfyUI 失败，切换云端: ${config.cloudProvider}`)
      result = await this.executeCloudFallback(config, req)
    }

    // 5. 保存结果
    if (result.success && result.data) {
      await this.saveAndRecord(type, req, result, userId)
    }

    return result
  }

  private async executeCloudFallback(
    config: ServiceConfig,
    req: GenerationRequest
  ): Promise<GenerationResult> {
    // 云端回退逻辑（参考现有 generate-image 的 Minimax 调用）
    const cloudResults = {
      minimax: async () => { /* 调用 Minimax */ },
      meshy: async () => { /* 调用 Meshy */ },
      kling: async () => { /* 调用 Kling */ },
    }
    const fn = cloudResults[config.cloudProvider as keyof typeof cloudResults]
    return fn ? await fn() : { success: false, error: '云端服务不可用' }
  }

  private async checkPower(userId: string, cost: number): Promise<boolean> {
    // 调用 /api/power 检查算力
    return true // 简化版
  }

  private async saveAndRecord(
    type: AIServiceType,
    req: GenerationRequest,
    result: GenerationResult,
    userId: string
  ): Promise<void> {
    // 保存到本地存储 + 记录 artworks 表
  }
}

export const pipeline = new GenerationPipeline()
```

---

## 统一入口路由

```typescript
// src/app/api/ai/generate/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { rateLimit, getClientIP, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit'
import { pipeline } from '@/lib/ai-service/generation-pipeline'
import type { AIServiceType } from '@/lib/ai-service/types'
import { badRequest, unauthorized, internalError } from '@/lib/api-response'

export async function POST(request: NextRequest) {
  // 1. Auth
  const user = await requireAuth(request)
  if (!user) return unauthorized()

  // 2. Rate Limit
  const ip = getClientIP(request)
  const rl = await rateLimit(ip, WRITE_LIMIT)
  if (!rl.success) return rateLimitResponse(rl)

  // 3. 解析参数
  const body = await request.json()
  const { service, ...params } = body

  if (!service) return badRequest('缺少 service 参数')

  // 4. 执行生成
  const result = await pipeline.execute(
    service as AIServiceType,
    { service, ...params } as any,
    user.userId
  )

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: result.data,
    provider: result.provider,
    powerCost: result.powerCost,
  })
}
```

---

## 各 Service 实现

每个服务独立文件，但注册到统一 Registry：

```typescript
// src/lib/ai-service/services/text2img.ts

import { registry } from '../service-registry'
import { textToImageZTurbo, textToImage } from '@/lib/comfyui-service'
import type { GenerationRequest, GenerationResult } from '../types'

registry.register({
  type: 'text2img',
  label: '文生图',
  powerCost: 10,
  requiresImage: false,
  primaryProvider: 'comfyui',
  comfyuiWorkflowId: 'z-image-turbo',
  
  async execute(req: GenerationRequest): Promise<GenerationResult> {
    try {
      const result = await textToImageZTurbo({
        prompt: req.prompt!,
        width: req.width || 512,
        height: req.height || 512,
        count: req.count || 1,
      })

      if (!result.success) {
        return { success: false, error: result.error || '生成失败' }
      }

      return {
        success: true,
        data: result.images,
        provider: 'comfyui',
        workflow: 'Z-Image-Turbo',
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : '生成失败',
      }
    }
  },
})
```

---

## 旧路由兼容策略

**每个旧路由文件保留，但标记 @deprecated 并转发到新路由：**

```typescript
// src/app/api/generate-image/route.ts ← 标记 @deprecated

/** @deprecated 请使用 POST /api/ai/generate，90 天后删除 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  // 转发到新路由
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const response = await fetch(`${baseUrl}/api/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization') || '',
    },
    body: JSON.stringify({ service: 'text2img', ...body }),
  })
  return response
}
```

**删除旧路由时机：**
1. 前端组件全部切换到新路由（逐步进行）
2. 确认无调用量下降
3. 删除所有 `@deprecated` 标记的路由文件

---

## 新增文件清单

```
新增目录：src/lib/ai-service/
├── types.ts                    ← 核心类型定义
├── service-registry.ts         ← 服务注册中心
├── generation-pipeline.ts        ← 统一执行管道
├── storage-helper.ts            ← 存储辅助（从现有逻辑提取）
└── services/
    ├── text2img.ts             ← 文生图
    ├── refine.ts               ← 产品精修
    ├── relief.ts               ← 浮雕设计
    ├── image3d.ts              ← 图转3D
    ├── stereo.ts               ← 平面转立体
    ├── removebg.ts             ← 移除背景
    ├── upscale.ts              ← 高清放大
    ├── watermark.ts            ← 去水印
    ├── sketch.ts                ← 线稿写实
    ├── blend.ts                 ← 多图融合
    ├── oneclick.ts              ← 一键设计
    ├── multiview.ts             ← 多视图
    ├── free.ts                  ← 自由创作
    └── video.ts                 ← 视频生成

新增路由：
└── src/app/api/ai/
    └── generate/route.ts       ← 统一入口
```

---

## 预估工作量

| 内容 | 预估工时 |
|------|---------|
| types.ts + service-registry.ts | 1 小时 |
| generation-pipeline.ts | 2 小时 |
| 各服务实现（14 个 × ~20 行） | 4 小时 |
| 新路由 `/api/ai/generate` | 1 小时 |
| 旧路由标记 deprecated + 转发 | 2 小时 |
| TypeScript 类型对齐 | 1 小时 |
| 联调测试 | 2 小时 |
| **合计** | **~13 小时** |
