# Meshy API 集成解决方案

## 概述

本文档说明如何使用Meshy API实现以下三个功能：

1. **图转浮雕图** (IMAGE TO RELIEF) - `/api/relief`
2. **图转3D模型** (IMAGE TO 3D) - `/api/image-3d`
3. **平面转雕塑** (2D TO 3D) - `/api/stereo`

## 技术架构

### API层次结构

```
前端组件
    ↓
API路由 (route.ts)
    ↓
Meshy API服务 (meshy-api.ts)
    ↓
Meshy API (外部服务)
```

### 核心文件

1. **Meshy API服务** - `src/lib/meshy-api.ts`
   - 统一的Meshy API调用接口
   - 支持任务创建、状态查询、轮询机制
   - 提供三种模式：image-to-3d, relief, depth

2. **API路由**
   - `src/app/api/relief/route.ts` - 图转浮雕图
   - `src/app/api/image-3d/route.ts` - 图转3D模型
   - `src/app/api/stereo/route.ts` - 平面转雕塑

3. **配置管理**
   - 使用数据库配置表 `api_configs`
   - 配置ID: `image-3d`
   - 提供商: `meshy`
   - 模型: `meshy-v3`

## Meshy API 端点

根据Meshy API文档，主要使用以下端点：

### 1. 创建图片转3D任务
```
POST https://api.meshy.ai/v2/image-to-3d
```

### 2. 查询任务状态
```
GET https://api.meshy.ai/v2/image-to-3d/{task_id}
```

## 三种功能的实现方式

### 1. 图转浮雕图 (IMAGE TO RELIEF)

**API端点**: `POST /api/relief`

**实现方式**:
```typescript
// 使用Meshy的image-to-3d API
// style设置为'sculpture'实现浮雕效果
const result = await meshyImageToRelief(image, {
  apiKey: config.apiKey,
  mode: 'image-to-3d',
  style: 'sculpture', // 浮雕风格
});
```

**请求参数**:
```json
{
  "image": "图片URL",
  "reliefType": "classical | modern | buddhist | decorative",
  "useMock": false
}
```

**响应格式**:
```json
{
  "success": true,
  "data": "浮雕预览图URL",
  "modelUrl": "3D模型URL (.glb)",
  "previewImage": "预览图URL",
  "provider": "meshy",
  "taskId": "任务ID",
  "reliefType": "浮雕类型"
}
```

**实现细节**:
- 使用Meshy的`image-to-3d`端点
- `style`设置为`sculpture`实现浮雕效果
- `surface_mode`设置为`sharp`增强浮雕的锐利度
- `texture_resolution`设置为`high`提高纹理质量

### 2. 图转3D模型 (IMAGE TO 3D)

**API端点**: `POST /api/image-3d`

**实现方式**:
```typescript
// 使用Meshy的image-to-3d API
const result = await meshyImageTo3D(image, {
  apiKey: config.apiKey,
  mode: 'image-to-3d',
  style: 'realistic', // 真实风格
});
```

**请求参数**:
```json
{
  "image": "图片URL",
  "prompt": "文字提示（可选）",
  "mode": "image3d",
  "useMock": false
}
```

**响应格式**:
```json
{
  "success": true,
  "modelUrl": "3D模型URL (.glb)",
  "previewImage": "预览图URL",
  "provider": "meshy",
  "taskId": "任务ID",
  "mode": "image3d"
}
```

**实现细节**:
- 标准的图片转3D流程
- `style`默认为`realistic`（真实风格）
- 支持自定义风格（anime, sculpture, low-poly）
- 返回GLB格式的3D模型

### 3. 平面转雕塑 (2D TO 3D)

**API端点**: `POST /api/stereo`

**实现方式**:
```typescript
// 使用Meshy的image-to-3d API生成深度图
const result = await meshyGenerateDepthMap(image, {
  apiKey: config.apiKey,
  mode: 'image-to-3d',
  style: 'realistic',
});
```

**请求参数**:
```json
{
  "image": "图片URL",
  "depth": "light | medium | strong",
  "useMock": false
}
```

**响应格式**:
```json
{
  "success": true,
  "data": "立体预览图URL",
  "depthMap": "深度图URL",
  "modelUrl": "3D模型URL",
  "previewImage": "预览图URL",
  "provider": "meshy",
  "taskId": "任务ID",
  "depth": "深度级别"
}
```

**实现细节**:
- `should_remesh`设置为`false`保留原始结构
- `generate_depth_map`设置为`true`生成深度图
- 深度图可用于立体渲染和3D重建

## 任务处理流程

### 1. 创建任务
```typescript
async function createTask(image, style) {
  const response = await fetch('https://api.meshy.ai/v2/image-to-3d', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: image,
      mode: 'preview',
      style: style,
      should_remesh: true,
      enable_pbr: true,
    }),
  });
  return response.json(); // 返回taskId
}
```

### 2. 轮询任务状态
```typescript
async function pollTask(taskId, apiKey) {
  const maxAttempts = 60; // 最多60次
  const delay = 2000; // 每2秒轮询一次

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.meshy.ai/v2/image-to-3d/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const result = await response.json();
    const status = result.status;

    if (status === 'succeeded') {
      return {
        modelUrl: result.model_url,
        previewImage: result.thumbnail_url,
      };
    }

    if (status === 'failed') {
      throw new Error(result.error || '任务失败');
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error('任务超时');
}
```

## 配置说明

### 数据库配置

在 `api_configs` 表中配置Meshy API：

```sql
INSERT INTO api_configs (
  id,
  name,
  api_key,
  provider,
  model,
  enabled,
  timeout,
  description
) VALUES (
  'image-3d',
  '3D建模',
  'msy_jYGu0K7pGfAPZjYChRSAW9gCpyJgqERpe4gs',
  'meshy',
  'meshy-v3',
  true,
  120000,
  '用于图转3D模型、图转浮雕图、平面转雕塑等3D功能'
);
```

### 配置优先级

系统按照以下优先级查找配置：
1. **数据库配置**（最高优先级）
2. 内存配置
3. 环境变量（fallback）

### 环境变量（可选）

如果不想使用数据库配置，可以设置环境变量：

```bash
MESHY_API_KEY=msy_jYGu0K7pGfAPZjYChRSAW9gCpyJgqERpe4gs
```

## API Key 获取

1. 访问 [Meshy AI](https://www.meshy.ai/)
2. 注册账号并登录
3. 进入API Keys页面
4. 创建新的API Key
5. 复制API Key到配置中

**当前使用的API Key**: `msy_jYGu0K7pGfAPZjYChRSAW9gCpyJgqERpe4gs`

## 使用示例

### 1. 图转浮雕图

```bash
curl -X POST http://localhost:5000/api/relief \
  -H 'Content-Type: application/json' \
  -d '{
    "image": "https://example.com/image.jpg",
    "reliefType": "classical",
    "useMock": false
  }'
```

### 2. 图转3D模型

```bash
curl -X POST http://localhost:5000/api/image-3d \
  -H 'Content-Type: application/json' \
  -d '{
    "image": "https://example.com/image.jpg",
    "mode": "image3d",
    "useMock": false
  }'
```

### 3. 平面转雕塑

```bash
curl -X POST http://localhost:5000/api/stereo \
  -H 'Content-Type: application/json' \
  -d '{
    "image": "https://example.com/image.jpg",
    "depth": "medium",
    "useMock": false
  }'
```

## 错误处理

### 常见错误及解决方案

1. **未配置API Key**
```json
{
  "success": false,
  "error": "未配置Meshy API",
  "message": "请在后台管理中配置3D建模API（Meshy）",
  "suggestion": "访问后台管理 → 系统设置 → API配置，配置 image-3d"
}
```
**解决方案**: 在后台管理中配置image-3d的API Key

2. **任务超时**
```json
{
  "success": false,
  "error": "任务轮询超时 (120秒)"
}
```
**解决方案**: 检查Meshy服务状态，或使用较小的图片

3. **任务失败**
```json
{
  "success": false,
  "error": "Meshy 任务失败: Invalid image URL"
}
```
**解决方案**: 检查图片URL是否有效，确保图片可访问

## 模拟模式

所有三个API都支持模拟模式（`useMock: true`），用于测试和演示：

```json
{
  "success": true,
  "modelUrl": "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
  "previewImage": "https://picsum.photos/512/512",
  "provider": "meshy-demo",
  "message": "演示模式：设置 useMock=false 可调用真实 Meshy API"
}
```

## 性能优化

### 1. 缓存机制
- 配置缓存：60秒TTL
- 任务结果缓存：可在后续版本中实现

### 2. 超时控制
- 默认超时：120秒
- 可根据需要调整

### 3. 并发控制
- 建议限制同时处理的任务数量
- 可使用任务队列实现

## 后续优化

1. **任务队列**: 实现异步任务处理，支持长时间运行的任务
2. **进度通知**: 使用WebSocket推送任务进度
3. **结果存储**: 将生成的3D模型存储到对象存储
4. **风格扩展**: 支持更多自定义风格
5. **批量处理**: 支持批量图片处理

## 相关文档

- [Meshy API 官方文档](https://docs.meshy.ai/)
- [GLB格式规范](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Model Viewer](https://modelviewer.dev/) - 3D模型查看器

## 技术支持

如遇到问题，请检查：
1. Meshy API Key是否正确配置
2. 图片URL是否有效可访问
3. 网络连接是否正常
4. 服务日志是否有错误信息

日志位置: `/app/work/logs/bypass/app.log`
