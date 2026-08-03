# 前端功能与后端API对应清单

## 浮雕圆雕（3个功能）

| 前端ID | 前端名称 | 后端API路由 | 功能组件 | 状态 |
|--------|---------|------------|---------|------|
| relief | 图转浮雕图 | `/api/relief` | ReliefDesign.tsx | ✅ 已实现 |
| image3d | 图转3D模型 | `/api/image-3d` | Image3D.tsx | ✅ 已实现 |
| 2dto3d | 平面转立体 | `/api/stereo` | Dialog2D3D.tsx | ✅ 已实现 |

## 灵感与创作（8个功能）

| 前端ID | 前端名称 | 后端API路由 | 功能组件 | 状态 |
|--------|---------|------------|---------|------|
| dialogue | AI对话 | `/api/chat` | AIDialog.tsx | ✅ 已实现 |
| text2img | 文案生图 | `/api/generate-image` | Text2Image.tsx | ✅ 已实现 |
| refine | 产品精修 | `/api/product-refine` | ProductRefine.tsx | ✅ 已实现 |
| blend | 多图融合 | `/api/multi-image` | MultiImage.tsx | ✅ 已实现 |
| oneclick | 一键设计 | `/api/one-click-design` | OneClickDesign.tsx | ✅ 已实现 |
| multiview | 生成多视图 | `/api/multi-view` | MultiView.tsx | ✅ 已实现 |
| sketch | 线稿/写实 | `/api/sketch-realistic` | SketchRealistic.tsx | ✅ 已实现 |
| free | 自由创作区 | `/api/free-creation` | FreeCreation.tsx | ✅ 已实现 |

## 生成视频（2个功能）

| 前端ID | 前端名称 | 后端API路由 | 功能组件 | 状态 |
|--------|---------|------------|---------|------|
| text2video | 文生视频 | `/api/video` | Text2Video.tsx | ✅ 已实现 |
| img2video | 图生视频 | `/api/video` | Image2Video.tsx | ✅ 已实现 |

## 实用工具（4个功能）

| 前端ID | 前端名称 | 后端API路由 | 功能组件 | 状态 |
|--------|---------|------------|---------|------|
| removebg | 移除背景 | `/api/remove-background` | RemoveBackground.tsx | ✅ 已实现 |
| upscale | 高清放大 | `/api/upscale` | Upscale.tsx | ✅ 已实现 |
| watermark | 去除水印 | `/api/remove-watermark` | RemoveWatermark.tsx | ✅ 已实现 |

## 总结

- **总功能数**: 17个
- **已实现**: 17个
- **未实现**: 0个
- **完成率**: 100%

## API配置映射

所有功能均使用统一的API配置系统，支持：
- 环境变量配置
- 数据库配置
- 多提供商切换（智谱AI、通义千问、OpenAI、豆包等）

### 功能与API类别映射

| 功能ID | API类别 | 算力消耗 |
|--------|---------|----------|
| dialogue | LLM对话 | 2 |
| text2img, refine, blend, oneclick, multiview, sketch, free | 图片生成 | 15-20 |
| relief, image3d, 2dto3d | 3D建模 | 20-30 |
| text2video, img2video | 视频生成 | 40-50 |
| removebg, upscale, watermark | 图片编辑 | 5 |

## 使用示例

### 前端调用示例
```typescript
import { callApi } from '@/lib/api-service';

// 文案生图
const result = await callApi('text2img', {
  params: { prompt: '敦煌飞天', count: 1 }
});

// AI对话（流式）
for await (const chunk of streamApi('dialogue', {
  params: { messages: [{ role: 'user', content: '你好' }] }
})) {
  console.log(chunk);
}
```

### 后端API测试示例
```bash
# 文案生图
curl -X POST http://localhost:5000/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"敦煌飞天","count":1}'

# AI对话
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'
```
