# 敦煌金 AI 设计平台 - 部署计划

> **⚠️ 弃用声明（2026-08-15）**：本文档为 coze 时代旧版本残留（架构图含 "Coze API"、依赖 Supabase、`/app/work/logs/bypass` 路径、1Panel 早期部署脚本等），与当前 Docker Compose（postgres 18.4-alpine + redis 7-alpine + Next.js standalone + BullMQ Worker）部署架构不符。
>
> **请改阅单一可信源**：[`docs/PRODUCTION-FIXES-2026-08-15.md`](docs/PRODUCTION-FIXES-2026-08-15.md) 和 [`docker-compose.yml`](docker-compose.yml)。
>
> 实际部署流程：`cp .env.example .env` → 填入密钥 → `docker compose up -d --build`（web/worker 自动构建，entrypoint 自动迁移）。

## 一、部署架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     生产环境架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   用户端     │────▶│  Next.js    │────▶│  PostgreSQL │   │
│  │  (Browser)  │     │  Server     │     │  (Supabase) │   │
│  └─────────────┘     │  Port:5000  │     └─────────────┘   │
│                      └──────┬──────┘                        │
│                             │                               │
│         ┌───────────────────┼───────────────────┐          │
│         ▼                   ▼                   ▼          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Coze API  │     │  对象存储    │     │  本地服务    │   │
│  │  (AI服务)   │     │  (S3/R2)    │     │ (ComfyUI)   │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 二、部署前检查清单

### 2.1 必需的环境变量

| 变量名 | 说明 | 必填 | 示例值 |
|--------|------|------|--------|
| `DATABASE_URL` | PostgreSQL连接串 | ✅ | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT密钥 | ✅ | `your-256-bit-secret` |
| `COZE_API_TOKEN` | Coze AI API Token | ⚠️ | `pat-xxx...` |
| `S3_ACCESS_KEY` | 对象存储访问密钥 | ⚠️ | - |
| `S3_SECRET_KEY` | 对象存储密钥 | ⚠️ | - |
| `S3_BUCKET` | 存储桶名称 | ⚠️ | `dunhuang-design` |
| `S3_ENDPOINT` | S3端点URL | ⚠️ | `https://xxx.r2.cloudflarestorage.com` |

> ⚠️ 表示可选但有推荐配置的功能

### 2.2 数据库准备

**选项A: 使用 Supabase（推荐）**
1. 创建 Supabase 项目
2. 获取数据库连接串（Settings > Database > Connection string）
3. 设置环境变量 `DATABASE_URL` 或 `SUPABASE_DATABASE_URL`

**选项B: 自建 PostgreSQL**
1. 确保 PostgreSQL 12+ 已安装
2. 创建数据库: `CREATE DATABASE dunhuang_design;`
3. 创建用户并授权

### 2.3 迁移执行

```bash
# 生成迁移文件
pnpm db:generate

# 执行迁移（首次部署）
pnpm db:push

# 填充种子数据（可选）
pnpm db:seed
```

## 三、部署步骤

### 3.1 开发环境验证

```bash
# 1. 安装依赖
pnpm install

# 2. 类型检查
npx tsc --noEmit

# 3. 启动开发服务
coze dev
```

### 3.2 生产环境部署

```bash
# 1. 构建生产版本
coze build

# 2. 启动生产服务
coze start
```

### 3.3 部署后验证

1. **健康检查**: `curl http://localhost:5000/api/health`
2. **数据库连接**: 检查日志中的数据库连接状态
3. **API功能测试**: 测试核心API端点

## 四、API 配置系统部署

### 4.1 云算力配置

默认使用 Coze API，需配置 `COZE_API_TOKEN`。

### 4.2 本地算力配置（可选）

如需使用本地算力（ComfyUI/Ollama），在后台管理页面配置：

1. 访问 `/admin` > 系统设置
2. 点击目标API的展开按钮
3. 编辑本地服务地址和端口
4. 测试连接确认可用
5. 切换算力来源为"本地"

### 4.3 支持的本地服务

| 服务类型 | 默认端口 | 用途 |
|----------|----------|------|
| ComfyUI | 8188 | 图片生成工作流 |
| Ollama | 11434 | 本地LLM对话 |
| WebUI | 7860 | Stable Diffusion |
| Custom | - | 自定义服务 |

## 五、数据库表结构

```
┌────────────────┐     ┌────────────────┐
│     users      │     │   sessions     │
├────────────────┤     ├────────────────┤
│ id (PK)        │◀───│ user_id (FK)   │
│ email          │     │ token          │
│ password_hash  │     │ expires_at     │
│ role           │     └────────────────┘
│ power          │
└────────┬───────┘
         │
         │     ┌────────────────┐
         └────▶│   power_logs   │
               ├────────────────┤
               │ user_id (FK)   │
               │ type           │
               │ amount         │
               │ balance        │
               └────────────────┘

┌────────────────┐     ┌────────────────┐
│  api_configs   │     │     works      │
├────────────────┤     ├────────────────┤
│ id (PK)        │     │ user_id (FK)   │
│ name           │     │ type           │
│ url            │     │ prompt         │
│ enabled        │     │ output_url     │
│ source         │     │ power_cost     │
└────────────────┘     └────────────────┘
```

## 六、安全配置

### 6.1 JWT 配置

- 密钥长度: 建议 256 位以上
- 过期时间: 当前设置为 7 天
- 存储方式: Cookie (HttpOnly)

### 6.2 数据库安全

- 使用 SSL 连接
- 限制 IP 访问
- 定期备份

### 6.3 API 安全

- 速率限制（需配置）
- 请求验证
- CORS 配置

## 七、监控与日志

### 7.1 日志位置

```
/app/work/logs/bypass/
├── app.log      # 应用主日志
├── dev.log      # 开发日志
└── console.log  # 控制台日志
```

### 7.2 关键监控指标

- 数据库连接数
- API 响应时间
- 算力消耗统计
- 错误率

## 八、故障排查

### 8.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 数据库连接失败 | 环境变量未配置 | 检查 DATABASE_URL |
| JWT 验证失败 | 密钥不一致 | 确认 JWT_SECRET 配置 |
| 图片生成失败 | API Token 无效 | 检查 COZE_API_TOKEN |
| 本地服务不可用 | 服务未启动 | 启动 ComfyUI/Ollama |

### 8.2 调试命令

```bash
# 检查数据库连接
curl http://localhost:5000/api/admin/api-config

# 查看最新日志
tail -n 50 /app/work/logs/bypass/app.log

# 类型检查
npx tsc --noEmit
```

## 九、回滚计划

如部署出现问题：

1. 停止当前服务
2. 恢复数据库备份（如有迁移）
3. 切换到上一版本代码
4. 重新构建并启动

## 十、后续优化建议

1. **数据库**: 配置连接池、启用查询缓存
2. **缓存**: 添加 Redis 缓存层
3. **CDN**: 静态资源使用 CDN 加速
4. **监控**: 接入 APM 监控服务
5. **备份**: 配置自动数据库备份
