# 敦煌金 AI 设计平台

> **⚠️ 弃用声明（2026-08-15）**：本文档为 coze 时代旧版本残留（描述的是 12→5 核心 API 的早期简化版架构、`/workspace/projects` 旧目录、`coze dev/build` 命令等），与当前 Next.js 15 + Docker + ComfyUI/MiniMax 架构不符。
>
> **请改阅单一可信源**：[`docs/PRODUCTION-FIXES-2026-08-15.md`](docs/PRODUCTION-FIXES-2026-08-15.md) 和 [`README.md`](README.md)。
>
> 完整修复记录与新架构说明以那两份文档为准。

## 项目概览
敦煌金 AI 设计平台是一个集成多种 AI 设计工具的在线工作台，包含文案生图、3D 建模、浮雕设计、视频生成等功能。采用敦煌金色主题（#C8A45C），深色背景系统，响应式布局。

## 技术栈
- **框架**: Next.js 15.1.0 (App Router) + React 19
- **语言**: TypeScript 5
- **样式**: Tailwind CSS 4 + CSS 变量
- **UI组件**: shadcn/ui (基于 Radix UI)
- **AI 能力**: ComfyUI（本地）· MiniMax / Qwen / Zhipu / Meshy（云端）
- **代码规范**: ESLint 9 (flat config) + Prettier

## 目录结构
```

## API 配置系统（简化版）

### 核心文件
- `src/lib/api-config.ts` - API配置数据结构和默认配置（5个核心API）
- `src/lib/api-service.ts` - 统一API调用服务（基于功能ID调用）
- `src/app/api/admin/api-config/route.ts` - API配置管理接口

### 核心设计理念
将原有的12个API配置简化为5个核心API类别，17个功能模块通过映射使用对应的API：
- **LLM对话** (llm-chat) - 推理类
- **图片生成** (image-generate) - 文生图/图生图
- **图片编辑** (image-edit) - 图像处理
- **3D建模** (3d-modeling) - 浮雕/立体转换
- **视频生成** (video-generate) - 视频创作

### 数据结构
```typescript
// 算力来源类型
type PowerSource = 'cloud' | 'local';

// API 类别
type ApiCategory = 'llm' | 'image-generate' | 'image-edit' | '3d-modeling' | 'video-generate';

// API 配置
interface ApiConfig {
  id: string;
  name: string;
  category: ApiCategory;
  description: string;
  enabled: boolean;
  source: PowerSource;
  cloud: EndpointConfig;    // 云端配置
  local: EndpointConfig & { // 本地配置
    service?: LocalServiceConfig;
  };
}

// 功能配置
interface FeatureConfig {
  id: string;           // 功能ID（如 'text2img', 'dialogue'）
  name: string;         // 功能名称
  group: string;        // 所属分组
  apiId: string;        // 对应的API ID
  cost: number;         // 算力消耗
  description: string;
  supportsAIAssistant?: boolean;
}

// 本地服务配置
interface LocalServiceConfig {
  type: 'comfyui' | 'ollama' | 'webui' | 'custom';
  host: string;
  port: number;
  workflowId?: string;
}
```

### 功能与API映射
| 功能ID | 功能名称 | API类别 | 算力消耗 |
|--------|----------|---------|----------|
| dialogue | AI对话 | llm-chat | 2 |
| text2img | 文案生图 | image-generate | 15 |
| refine | 产品精修 | image-generate | 20 |
| blend | 多图融合 | image-generate | 15 |
| oneclick | 一键设计 | image-generate | 15 |
| multiview | 生成多视图 | image-generate | 20 |
| sketch | 线稿/写实 | image-generate | 15 |
| free | 自由创作区 | image-generate | 15 |
| relief | 图转浮雕图 | 3d-modeling | 20 |
| image3d | 图转3D模型 | 3d-modeling | 30 |
| 2dto3d | 平面转立体 | 3d-modeling | 25 |
| removebg | 移除背景 | image-edit | 5 |
| upscale | 高清放大 | image-edit | 5 |
| watermark | 去除水印 | image-edit | 5 |
| text2video | 文生视频 | video-generate | 50 |
| img2video | 图生视频 | video-generate | 40 |

### 管理接口
- `GET /api/admin/api-config` - 获取所有API配置
- `POST /api/admin/api-config` - 操作API配置
  - `action: 'toggle-global-source'` - 切换全局算力来源
  - `action: 'toggle-source'` - 切换单个API算力来源
  - `action: 'test'` - 测试API连通性
  - `action: 'update-cloud-service'` - 更新云端服务配置
  - `action: 'update-local-service'` - 更新本地服务配置
  - `action: 'toggle'` - 启用/禁用API

### 使用示例
```typescript
import { callApi, streamApi } from '@/lib/api-service';

// 图片生成（使用功能ID调用）
const result = await callApi('text2img', {
  params: { prompt: '敦煌壁画', width: 1024, height: 1024 },
  forceSource: 'local',  // 强制使用本地算力（可选）
});

// AI对话（流式输出）
for await (const chunk of streamApi('dialogue', {
  params: { messages: [{ role: 'user', content: '你好' }] },
})) {
  console.log(chunk);
}

// 获取功能算力消耗
import { getFeatureCost } from '@/lib/api-config';
const cost = getFeatureCost('text2img'); // 15
```

### 支持的云端提供商

#### LLM对话
| 提供商 | 标识 | 默认模型 |
|--------|------|---------|
| 智谱AI | zhipu | glm-4 |
| 豆包 | doubao | doubao-pro |
| OpenAI | openai | gpt-4 |
| 通义千问 | qwen | qwen-max |
| Kimi | kimi | moonshot-v1 |
| MiniMax | minimax | abab6.5 |
| Ollama | ollama | llama2 |
| 自定义 | custom | - |

#### 图片生成
| 提供商 | 标识 | 默认模型 |
|--------|------|---------|
| 智谱AI | zhipu | cogview-3 |
| OpenAI | openai | dall-e-3 |
| Stability AI | stability | stable-diffusion-xl |
| 豆包 | doubao | doubao-image |
| 通义千问 | qwen | wanx-v1 |
| Kimi | kimi | - |
| MiniMax | minimax | - |
| 自定义 | custom | - |

#### 视频生成
| 提供商 | 标识 | 默认模型 |
|--------|------|---------|
| 智谱AI | zhipu | cogvideox |
| Runway | runway | gen-2 |
| Pika | pika | pika-v1 |
| Sora | sora | sora-v1 |
| 通义千问 | qwen | - |
| Kimi | kimi | - |
| MiniMax | minimax | video-01 |
| 自定义 | custom | - |

#### 3D建模
| 提供商 | 标识 | 默认模型 |
|--------|------|---------|
| Tripo | tripo | tripo-3d |
| Meshy | meshy | meshy-v1 |
| Kaedim | kaedim | - |
| 自定义 | custom | - |

### 支持的本地服务
1. **ComfyUI** - 图片生成工作流（端口8188）
2. **Ollama** - 本地LLM对话（端口11434）
3. **WebUI** - Stable Diffusion WebUI（端口7860）
4. **Custom** - 自定义服务

/workspace/projects/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API 路由
│   │   │   ├── chat/           # AI 对话 API
│   │   │   └── generate-image/ # 图片生成 API
│   │   ├── gallery/            # 作品展示页面
│   │   ├── profile/            # 个人中心页面
│   │   ├── admin/              # 后台管理页面
│   │   ├── globals.css         # 全局样式
│   │   ├── layout.tsx          # 根布局
│   │   └── page.tsx            # 首页（工作台）
│   ├── components/
│   │   ├── ui/                  # UI组件库
│   │   │   ├── loading.tsx      # 加载动画组件
│   │   │   └── toast.tsx        # Toast提示组件
│   │   ├── layout/             # 布局组件
│   │   │   ├── Header.tsx      # 顶部导航
│   │   │   ├── Sidebar.tsx     # 侧边栏
│   │   │   └── HistoryPanel.tsx # 历史记录面板
│   │   └── workspace/          # 功能模块组件
│   │       ├── WorkspacePanel.tsx
│   │       ├── Text2Image.tsx  # 文案生图
│   │       ├── AIDialog.tsx    # AI 对话
│   │       ├── ReliefDesign.tsx # 浮雕设计
│   │       ├── Image3D.tsx     # 图转 3D
│   │       ├── Dialog2D3D.tsx  # 2D 转 3D
│   │       ├── ProductRefine.tsx # 产品精修
│   │       ├── MultiImage.tsx  # 多图融合
│   │       ├── OneClickDesign.tsx # 一键设计
│   │       ├── MultiView.tsx   # 多视图生成
│   │       ├── SketchRealistic.tsx # 线稿/写实
│   │       ├── FreeCreation.tsx # 自由创作
│   │       ├── Text2Video.tsx  # 文生视频
│   │       ├── Image2Video.tsx # 图生视频
│   │       ├── RemoveBackground.tsx # 移除背景
│   │       ├── Upscale.tsx     # 高清化
│   │       └── RemoveWatermark.tsx # 去水印
│   └── lib/
│       └── power.ts            # 算力管理 Hook
├── public/                     # 静态资源
├── .coze                       # Coze 配置文件
└── package.json
```

## 功能模块（17个）
### 浮雕圆雕
1. **图片转浮雕图** - 将图片转换为浮雕风格
2. **图转3D模型** - 图片转3D模型预览
3. **平面转立体** - 2D平面图像转立体效果

### 灵感与创作
4. **AI对话** - 流式AI对话功能
5. **文案生图** - 文字描述生成图片
6. **产品精修** - 产品图片优化
7. **多图融合** - 多张图片融合
8. **一键设计** - 快速生成设计
9. **生成多视图** - 生成多角度视图
10. **线稿/写实** - 风格转换
11. **自由创作区** - 自由创作

### 生成视频
12. **文生视频** - 文字生成视频
13. **图生视频** - 图片生成视频

### 实用工具
14. **移除背景** - 一键抠图
15. **高清化** - 图片放大增强
16. **一键去水印** - 智能去水印

## 配色方案
敦煌金色主题：
- **主金色**: #C8A45C
- **金色悬停**: #D4B06A
- **背景主色**: #0F1114
- **背景次色**: #16181C
- **边框色**: #2A2D32

## 开发命令
```bash
# 安装依赖
pnpm install

# 开发模式
coze dev

# 构建生产版本
coze build

# 启动生产环境
coze start

# 类型检查
npx tsc --noEmit
```

## 算力系统
每个功能消耗不同算力：
- 文案生图: 15
- AI对话: 2
- 浮雕设计: 20
- 3D建模: 30
- 视频生成: 40-50
- 实用工具: 5
- 产品精修: 20
- 多图融合: 15
- 一键设计: 15
- 生成多视图: 20
- 线稿/写实: 15
- 自由创作: 15
- 平面转立体: 25

### 算力扣减流程
1. 用户执行操作（如生成图片）
2. 前端检查算力是否足够
3. 操作成功后调用 `onDeductPower(cost, reason)`
4. 已登录用户：调用后端 API `/api/power` 扣减
5. 未登录用户：本地 localStorage 扣减
6. 扣减后刷新用户信息

## API 接口
- `POST /api/generate-image` - 图片生成
- `POST /api/chat` - AI 对话（流式输出）
- `POST /api/ai-assistant` - AI写作助手（流式输出）

## AI写作助手

### 功能说明
全局AI写作助手插件，自动监听所有文本输入框，用户聚焦时在右下角显示AI助手图标，鼠标悬停显示润色和翻译两个快捷操作。

### 核心组件
- `src/components/ui/AIAssistantManager.tsx` - 全局管理器，hover显示快捷菜单
- `src/app/api/ai-assistant/route.ts` - 后端API（流式输出）
- `src/app/api/admin/ai-assistant-config/route.ts` - 后台配置API

### 功能特性
1. **自动检测**: 监听所有`<textarea>`和`<input type="text">`元素
2. **快捷操作**: 鼠标悬停显示润色、翻译两个快捷按钮
3. **一键处理**: 点击后直接调用AI处理并替换输入框内容
4. **流式输出**: 后端采用流式响应，体验流畅
5. **排除控制**: 添加`data-no-ai-assistant`属性可禁用特定输入框

### 后台配置
在后台管理页面 → 系统设置 → API配置管理 中可配置：
- 服务商：智谱AI / 豆包 / OpenAI / 自定义
- 模型名称
- API Key

### 使用方式
```tsx
// 正常文本输入框会自动启用AI助手
<textarea placeholder="输入内容..." />

// 添加排除属性禁用AI助手
<textarea data-no-ai-assistant placeholder="不启用AI助手..." />
```

### API调用
```typescript
// 流式调用
const response = await fetch('/api/ai-assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '请润色以下内容',
    context: '原文内容...',
  }),
});
```

## 注意事项
1. 所有页面使用 CSS 变量管理配色，确保全局一致性
2. 功能组件使用懒加载优化性能
3. API 调用使用动态导入避免 SSR 问题
4. 算力管理使用 React Hook (usePower)

## UI 组件库

### 加载动画组件 (loading.tsx)
```tsx
import { LoadingSpinner, LoadingDots, LoadingProgressBar, Skeleton } from '@/components/ui/loading';

// 旋转加载
<LoadingSpinner size="sm" | "md" | "lg" />

// 点状加载
<LoadingDots />

// 进度条
<LoadingProgressBar progress={50} />

// 骨架屏
<Skeleton className="h-40 w-full" />
<SkeletonCard />
<SkeletonList count={3} />
```

### Toast 提示组件 (toast.tsx)
```tsx
import { useToast } from '@/components/ui/toast';

function MyComponent() {
  const { success, error, info, warning } = useToast();
  
  const handleSubmit = () => {
    success('操作成功', '数据已保存');
    // 或
    error('操作失败', '请重试');
  };
}
```

### CSS 动画类
```html
<!-- 淡入 -->
<div className="animate-fade-in">内容</div>

<!-- 滑入 -->
<div className="animate-slide-up">内容</div>
<div className="animate-slide-in-right">内容</div>

<!-- 缩放 -->
<div className="animate-scale-in">内容</div>

<!-- 脉冲发光 -->
<div className="animate-pulse-glow">内容</div>

<!-- 延迟动画 -->
<div className="animate-fade-in delay-100">内容</div>
```

### 响应式工具类
```html
<!-- 在移动端隐藏 -->
<div className="hide-mobile">桌面端显示</div>

<!-- 在平板端隐藏 -->
<div className="hide-tablet">移动端和桌面端显示</div>

<!-- 在桌面端隐藏 -->
<div className="hide-desktop">移动端和平板端显示</div>
```

### 按钮样式
```html
<!-- 金色主按钮 -->
<button className="btn-gold">生成</button>

<!-- 次要按钮 -->
<button className="btn-secondary">取消</button>

<!-- 幽灵按钮 -->
<button className="btn-ghost">更多</button>
```

### 卡片样式
```html
<!-- 金色边框卡片 -->
<div className="card-gold-border">内容</div>

<!-- 悬浮卡片 -->
<div className="card-elevated">内容</div>

<!-- 毛玻璃卡片 -->
<div className="card-glass">内容</div>
```

### AI写作助手组件
```tsx
// 自动启用：仅在以下功能模块的文本输入框中显示AI助手
// - 文案生图、AI对话、图转3D模型、产品精修、多图融合
// - 一键设计、生成多视图、线稿/写实、自由创作区、文生视频、图生视频

// 排除特定输入框（在允许的模块内）
<textarea data-no-ai-assistant />

// 后台配置路径
// 后台管理 → 系统设置 → API配置管理 → AI写作助手配置
```
