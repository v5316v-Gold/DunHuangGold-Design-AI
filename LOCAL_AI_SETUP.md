# 本地 AI 服务配置指南

## 概述

本系统支持两种本地AI服务：
- **ComfyUI** - 用于图片生成（文案生图、浮雕、3D建模等）
- **Ollama** - 用于AI对话（流式输出）

## 一、ComfyUI 配置（图片生成）

### 1.1 安装 ComfyUI

#### 方式A: 直接安装

```bash
# 克隆项目
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 安装 PyTorch (根据你的CUDA版本选择)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

#### 方式B: 使用 ComfyUI-Manager（推荐）

```bash
# 安装 ComfyUI-Manager
cd ComfyUI/custom_nodes
git clone https://github.com/ltdrdata/ComfyUI-Manager.git

# 启动后可通过 Web UI 安装节点和模型
```

### 1.2 下载模型

将模型放到 `ComfyUI/models/checkpoints/` 目录：

```bash
cd ComfyUI/models/checkpoints

# 下载 Stable Diffusion 模型（选择一个）
# SD 1.5
wget https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.ckpt

# SDXL（需要更多显存）
wget https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors

# 或使用国内镜像
# wget https://hf-mirror.com/...
```

### 1.3 启动 ComfyUI

```bash
# 基本启动（默认端口8188）
python main.py

# 允许局域网访问
python main.py --listen 0.0.0.0

# 指定端口
python main.py --port 8188 --listen 0.0.0.0

# 后台运行
nohup python main.py --listen 0.0.0.0 > comfyui.log 2>&1 &
```

### 1.4 配置工作流

ComfyUI 使用 JSON 工作流文件，系统预置了以下工作流：

| 工作流ID | 功能 | 对应API |
|----------|------|---------|
| `text2img` | 文生图 | generate-image |
| `relief` | 浮雕生成 | relief |
| `image2_3d` | 图转3D | image-3d |
| `upscale` | 图片放大 | upscale |
| `remove_bg` | 背景移除 | remove-background |

**添加自定义工作流**：

1. 在 ComfyUI 界面设计工作流
2. 导出为 JSON（Save 按钮）
3. 放到项目 `workflows/` 目录
4. 在 API 配置中指定 `workflowId`

### 1.5 在系统中配置

**方式一：通过后台管理界面**

1. 访问 `http://你的IP:5000/admin`
2. 点击「系统设置」标签
3. 找到目标API（如「图片生成」）
4. 展开详情，编辑本地服务配置：
   - 类型: `comfyui`
   - 地址: `127.0.0.1`（本机）或实际IP
   - 端口: `8188`
5. 点击「测试本地」验证连接
6. 切换算力来源为「本地」

**方式二：通过API**

```bash
# 更新本地服务配置
curl -X POST http://localhost:5000/api/admin/api-config \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update-local-service",
    "id": "generate-image",
    "config": {
      "host": "192.168.1.100",
      "port": 8188
    }
  }'

# 切换到本地算力
curl -X POST http://localhost:5000/api/admin/api-config \
  -H "Content-Type: application/json" \
  -d '{"action": "toggle-source", "id": "generate-image"}'
```

---

## 二、Ollama 配置（AI对话）

### 2.1 安装 Ollama

#### Linux

```bash
# 一键安装
curl -fsSL https://ollama.com/install.sh | sh
```

#### macOS

```bash
# 使用 Homebrew
brew install ollama

# 或下载安装包
# https://ollama.com/download
```

#### Windows

下载安装包：https://ollama.com/download

### 2.2 启动服务

```bash
# 启动 Ollama 服务（默认端口11434）
ollama serve

# 后台运行
nohup ollama serve > ollama.log 2>&1 &
```

### 2.3 下载模型

```bash
# 查看可用模型
ollama list

# 下载模型（选择一个）
ollama pull llama2          # Meta Llama 2 (7B)
ollama pull llama3          # Meta Llama 3 (8B)
ollama pull mistral         # Mistral (7B)
ollama pull qwen2           # 阿里通义千问2 (7B)
ollama pull deepseek-coder  # DeepSeek 编程模型

# 推荐中文用户
ollama pull qwen2:7b        # 中文支持好
ollama pull yi:6b           # 零一万物
```

### 2.4 测试模型

```bash
# 命令行测试
ollama run llama2 "你好，介绍一下敦煌艺术"

# API 测试
curl http://localhost:11434/api/generate -d '{
  "model": "llama2",
  "prompt": "你好"
}'
```

### 2.5 在系统中配置

**方式一：通过后台管理界面**

1. 访问 `http://你的IP:5000/admin`
2. 点击「系统设置」
3. 找到「AI对话」API
4. 展开详情，配置：
   - 类型: `ollama`
   - 地址: `127.0.0.1`
   - 端口: `11434`
5. 测试连接并切换

**方式二：修改配置文件**

编辑 `src/lib/api-config.ts`：

```typescript
'chat': {
  id: 'chat',
  name: 'AI对话',
  // ...
  local: {
    ...createEndpoint('http://127.0.0.1:11434/api/chat', {
      timeout: 120000,
      paramMapping: { messages: 'messages', model: 'model' },
    }),
    service: {
      type: 'ollama',
      host: '127.0.0.1',
      port: 11434,
      ollama: {
        model: 'llama2',  // 指定默认模型
      },
    },
  },
},
```

---

## 三、系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     敦煌金 AI 设计平台                        │
│                     (Next.js Server)                        │
│                       端口: 5000                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│    ComfyUI      │       │     Ollama      │
│   (图片生成)     │       │    (AI对话)     │
│   端口: 8188     │       │   端口: 11434   │
│                 │       │                 │
│  ┌───────────┐  │       │  ┌───────────┐  │
│  │ SD Models │  │       │  │   Models  │  │
│  │ SD 1.5    │  │       │  │  llama2   │  │
│  │ SDXL      │  │       │  │  qwen2    │  │
│  │ ...       │  │       │  │  ...      │  │
│  └───────────┘  │       │  └───────────┘  │
└─────────────────┘       └─────────────────┘
```

---

## 四、API 调用流程

### 4.1 图片生成（ComfyUI）

```typescript
// 1. 系统接收请求
// 2. 检查算力来源（cloud/local）
// 3. 如果是本地，调用 ComfyUI

// POST http://127.0.0.1:8188/prompt
{
  "prompt": {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "seed": 12345,
        "steps": 20,
        "cfg": 7,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      }
    },
    // ... 更多节点
  }
}

// 4. 轮询获取结果
// GET http://127.0.0.1:8188/history/{prompt_id}

// 5. 获取生成的图片
// GET http://127.0.0.1:8188/view?filename=xxx
```

### 4.2 AI对话（Ollama）

```typescript
// 1. 系统接收请求
// 2. 如果是本地，调用 Ollama

// POST http://127.0.0.1:11434/api/chat
{
  "model": "llama2",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "stream": true  // 流式输出
}

// 3. 返回流式数据
// {"model":"llama2","message":{"role":"assistant","content":"你"}}
// {"model":"llama2","message":{"role":"assistant","content":"好"}}
// ...
```

---

## 五、常见问题

### Q1: ComfyUI 连接失败

```bash
# 检查服务状态
curl http://localhost:8188/system_stats

# 检查端口
ss -tlnp | grep 8188

# 查看日志
tail -f comfyui.log
```

### Q2: Ollama 模型下载慢

```bash
# 使用镜像
OLLAMA_MIRROR=https://ollama.ai-yyds.com ollama pull llama2

# 或手动下载模型文件
# 放到 ~/.ollama/models/
```

### Q3: 显存不足

```bash
# ComfyUI 使用低显存模式
python main.py --lowvram

# 或使用 CPU 模式（较慢）
python main.py --cpu

# Ollama 量化模型
ollama pull llama2:7b-q4_0  # 4位量化
```

### Q4: 如何添加新的 ComfyUI 工作流

1. 在 ComfyUI Web 界面设计工作流
2. 点击「Save」导出 JSON
3. 在 `src/lib/api-config.ts` 添加配置：

```typescript
'custom-api': {
  id: 'custom-api',
  name: '自定义功能',
  local: {
    service: {
      type: 'comfyui',
      host: '127.0.0.1',
      port: 8188,
      comfyui: {
        workflowId: 'custom_workflow',
        workflowJson: { ... }, // 粘贴导出的JSON
      },
    },
  },
},
```

---

## 六、性能建议

### 硬件配置

| 用途 | 最低配置 | 推荐配置 |
|------|----------|----------|
| 图片生成 | RTX 3060 12GB | RTX 4070 16GB |
| AI对话 | 16GB 内存 | 32GB 内存 |
| 同时运行 | RTX 4080 16GB | RTX 4090 24GB |

### 模型选择

| 场景 | 推荐模型 | 说明 |
|------|----------|------|
| 中文对话 | qwen2:7b | 阿里通义千问，中文好 |
| 英文对话 | llama3:8b | Meta最新模型 |
| 图片生成 | SDXL | 高质量，需16GB显存 |
| 快速生成 | SD 1.5 | 速度快，需8GB显存 |
