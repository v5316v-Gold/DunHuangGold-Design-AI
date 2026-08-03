# 代码重构指南

本文档说明如何使用新的统一 Hook 和 API 处理器来简化代码。

## 目录

1. [useAiGeneration Hook](#useaigeneration-hook)
2. [handleApi 处理器](#handleapi-处理器)
3. [迁移示例](#迁移示例)

---

## useAiGeneration Hook

### 用途

统一处理所有 AI 生成任务的公共逻辑：
- ✅ 算力检查
- ✅ 进度管理
- ✅ 错误处理
- ✅ 请求取消
- ✅ 自动算力扣除

### 基本用法

```typescript
import { useAiGeneration } from '@/hooks/useAiGeneration';

function Text2Image({ power, onDeductPower }: Text2ImageProps) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  
  const { isGenerating, progress, error, generate } = useAiGeneration({
    featureId: 'text2img',
    cost: 15,
    power,
    onDeductPower,
    onSuccess: (data) => {
      setResult(data.imageUrl);
    },
  });

  const handleGenerate = async () => {
    await generate(
      { prompt, resolution: '2k', ratio: '1:1' },
      '文案生图'
    );
  };

  return (
    <div>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? `生成中 ${progress}%` : '开始生成'}
      </button>
      {error && <div className="error">{error}</div>}
      {result && <img src={result} alt="生成结果" />}
    </div>
  );
}
```

### API

```typescript
interface UseAiGenerationOptions {
  featureId: string;          // 功能 ID（如 'text2img', 'image-3d'）
  cost: number;               // 算力消耗
  power: number;              // 当前算力
  onDeductPower: (amount: number, reason: string) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface UseAiGenerationReturn {
  isGenerating: boolean;      // 是否正在生成
  progress: number;           // 进度 0-100
  error: string | null;       // 错误信息
  generate: (params: Record<string, any>, deductReason: string) => Promise<any>;
  reset: () => void;          // 重置状态
  setError: (error: string | null) => void;
  setProgress: (progress: number) => void;
}
```

---

## handleApi 处理器

### 用途

统一处理所有 API 路由的错误处理和日志记录：
- ✅ 统一错误格式
- ✅ 自动日志记录
- ✅ 统一响应格式
- ✅ 类型安全

### 基本用法

```typescript
import { NextRequest } from 'next/server';
import { handleApi, errors } from '@/lib/api-handler';

export const POST = handleApi(async (request: NextRequest) => {
  const body = await request.json();
  const { prompt, resolution = '2k' } = body;

  // 参数验证（自动抛出 400 错误）
  if (!prompt) {
    throw errors.badRequest('prompt 是必填参数');
  }

  // 业务逻辑
  const config = await getApiConfig('image-generate');
  if (!config?.apiKey) {
    throw errors.apiError('未配置 API');
  }

  const imageUrl = await callMinimax(prompt, resolution);

  // 返回结果（自动包装为 JSON 响应）
  return {
    success: true,
    data: { imageUrl },
    provider: 'minimax',
  };
});
```

### 错误处理

```typescript
import { handleApi, errors } from '@/lib/api-handler';

export const POST = handleApi(async (request: NextRequest) => {
  const body = await request.json();
  
  // 1. 参数验证错误（400）
  if (!body.email) {
    throw errors.badRequest('邮箱是必填项');
  }
  
  // 2. 未授权（401）
  const user = await getCurrentUser(request);
  if (!user) {
    throw errors.unauthorized();
  }
  
  // 3. 禁止访问（403）
  if (user.role !== 'admin') {
    throw errors.forbidden('只有管理员可以操作');
  }
  
  // 4. 资源不存在（404）
  const item = await findItem(body.id);
  if (!item) {
    throw errors.notFound('项目');
  }
  
  // 5. 资源冲突（409）
  const exists = await checkExists(body.email);
  if (exists) {
    throw errors.conflict('该邮箱已被注册');
  }
  
  // 6. 请求过于频繁（429）
  const rateLimit = await checkRateLimit(user.id);
  if (!rateLimit) {
    throw errors.tooManyRequests();
  }

  return { success: true };
});
```

### 自定义日志配置

```typescript
export const GET = handleApi(
  async (request: NextRequest) => {
    return { data: '健康检查通过' };
  },
  {
    loggerName: 'health',
    skipLogPaths: ['/api/health'], // 跳过健康检查的日志
  }
);
```

---

## 迁移示例

### 迁移前（旧代码）

```typescript
// components/workspace/Text2Image.tsx
export default function Text2Image({ power, onDeductPower }: Text2ImageProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const cost = getTaskCost('text2img');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }
    if (power < cost) {
      setError(`算力不足！当前：${power}，需要：${cost}`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 300);

    try {
      const response = await callApi<string[]>('generate-image', {
        params: { prompt: prompt.trim(), count: 1, resolution: '2k', ratio: '1:1' },
        onProgress: (p) => setProgress(p),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.success && response.data) {
        const images = Array.isArray(response.data) ? response.data : [response.data];
        if (images.length > 0 && images[0]) {
          setResult(images[0]);
          onDeductPower(cost, '文案生图');
        } else {
          throw new Error('生成失败，请重试');
        }
      } else {
        throw new Error(response.error || '生成失败');
      }
    } catch (err: any) {
      setError(err.message || '生成失败');
      setProgress(0);
    } finally {
      setIsGenerating(false);
      clearInterval(progressInterval);
    }
  };

  return (/* JSX */);
}
```

### 迁移后（新代码）

```typescript
// components/workspace/Text2Image.tsx
import { useAiGeneration } from '@/hooks/useAiGeneration';

export default function Text2Image({ power, onDeductPower }: Text2ImageProps) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const cost = getTaskCost('text2img');

  const { isGenerating, progress, error, generate } = useAiGeneration({
    featureId: 'text2img',
    cost,
    power,
    onDeductPower,
    onSuccess: (data) => {
      setResult(data.imageUrl);
    },
  });

  const handleGenerate = async () => {
    await generate(
      { prompt: prompt.trim(), count: 1, resolution: '2k', ratio: '1:1' },
      '文案生图'
    );
  };

  return (/* JSX */);
}
```

**代码减少：** ~40 行 → ~15 行（减少 62%）

---

### API 路由迁移示例

#### 迁移前

```typescript
// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage, createLogger } from '@/lib/error-handler';

const logger = createLogger('generate-image');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt 是必填参数' },
        { status: 400 }
      );
    }

    const config = await getApiConfig('image-generate');
    if (!config?.apiKey) {
      return NextResponse.json(
        { error: '未配置 API' },
        { status: 400 }
      );
    }

    const imageUrl = await callMinimax(prompt);

    logger.info('生成成功');
    return NextResponse.json({ success: true, data: { imageUrl } });
  } catch (error) {
    logger.error('生成失败', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
```

#### 迁移后

```typescript
// app/api/generate-image/route.ts
import { NextRequest } from 'next/server';
import { handleApi, errors } from '@/lib/api-handler';

export const POST = handleApi(async (request: NextRequest) => {
  const body = await request.json();
  const { prompt } = body;

  if (!prompt) {
    throw errors.badRequest('prompt 是必填参数');
  }

  const config = await getApiConfig('image-generate');
  if (!config?.apiKey) {
    throw errors.apiError('未配置 API');
  }

  const imageUrl = await callMinimax(prompt);

  return {
    success: true,
    data: { imageUrl },
    provider: 'minimax',
  };
});
```

**代码减少：** ~35 行 → ~18 行（减少 49%）

---

## 迁移清单

### 前端组件（17 个）

- [ ] Text2Image.tsx
- [ ] ProductRefine.tsx
- [ ] MultiImage.tsx
- [ ] OneClickDesign.tsx
- [ ] MultiView.tsx
- [ ] SketchRealistic.tsx
- [ ] FreeCreation.tsx
- [ ] Image3D.tsx
- [ ] ReliefDesign.tsx
- [ ] Dialog2D3D.tsx
- [ ] RemoveBackground.tsx
- [ ] Upscale.tsx
- [ ] RemoveWatermark.tsx
- [ ] Text2Video.tsx
- [ ] Image2Video.tsx
- [ ] AIDialog.tsx（使用 streamApi，不适用）
- [ ] WorkspacePanel.tsx（面板容器，不适用）

### 后端 API（30+ 个）

- [ ] /api/generate-image
- [ ] /api/product-refine
- [ ] /api/multi-image
- [ ] /api/one-click-design
- [ ] /api/multi-view
- [ ] /api/sketch-realistic
- [ ] /api/free-creation
- [ ] /api/image-3d
- [ ] /api/relief
- [ ] /api/stereo
- [ ] /api/remove-background
- [ ] /api/upscale
- [ ] /api/remove-watermark
- [ ] /api/video
- [ ] /api/chat
- [ ] 其他...

---

## 注意事项

1. **渐进式迁移** — 不要一次性迁移所有文件，逐个测试
2. **保持向后兼容** — 旧代码在新 Hook 测试通过后再删除
3. **更新测试** — 确保单元测试覆盖新 Hook
4. **文档同步** — 更新组件文档和使用示例
