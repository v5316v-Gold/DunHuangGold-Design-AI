# 敦煌金 AI 设计平台 - Dockerfile
# 多阶段构建，优化镜像大小

# 阶段1: 依赖安装
FROM node:20-alpine AS deps
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 阶段2: 构建
FROM node:20-alpine AS builder
WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV COZE_PROJECT_ENV=PROD

# 编译自定义服务器（ts -> js 输出到 dist/server.js）
RUN pnpm exec tsc src/server.ts --outDir dist --esModuleInterop --target ES2020 --module commonjs --moduleResolution node --skipLibCheck

# 构建 Next.js 应用
RUN pnpm build

# 阶段3: 运行
FROM node:20-alpine AS runner
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV COZE_PROJECT_ENV=PROD
ENV PORT=5000

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制 Next.js 构建产物
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# 复制已编译的自定义服务器
COPY --from=builder /app/dist ./dist

# 复制依赖和 package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 复制必要文件
COPY --from=builder /app/.env.local ./.env.local

# 设置权限
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/ || exit 1

# 启动命令
CMD ["node", "dist/server.js"]
