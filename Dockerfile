# 敦煌金 AI 设计平台 - Dockerfile (Phase 9.17 node:20-alpine 基础)
# 多阶段构建：deps → builder → runner
# 用官方 node:20-alpine（已下载）作为基础镜像

# ===== 阶段 1: 依赖 =====
FROM node:20-alpine AS deps
WORKDIR /app

# pnpm 加速（npmmirror 国内镜像）
RUN npm install -g pnpm@9 --registry=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

# ===== 阶段 2: 构建 (standalone) =====
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache bash && \
    npm install -g pnpm@9 --registry=https://registry.npmmirror.com

COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# ⚠️ 构建期 JWT_SECRET 仅用于通过 next.config 校验，绝不能是真实密钥。
# 运行时由 docker-compose 注入真实 JWT_SECRET（生产 fail-closed）。
ARG BUILD_JWT_SECRET=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE
ENV JWT_SECRET=${BUILD_JWT_SECRET}
# API_KEY_ENCRYPTION_KEY 同理（64 位 hex 字符串）
ARG BUILD_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
ENV API_KEY_ENCRYPTION_KEY=${BUILD_ENCRYPTION_KEY}
ENV NEXT_OUTPUT=standalone
RUN pnpm build

# ===== 阶段 3: 运行（仅 standalone） =====
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache bash && \
    addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000

COPY --from=builder /app/.next/standalone ./
# standalone 模式下静态资源在 .next/standalone/.next/static，自动包含
COPY --from=builder /app/public ./public

# P0-1: 数据库迁移文件 + entrypoint（启动前自动迁移，幂等）
COPY --from=builder /app/scripts/migrate.js ./scripts/migrate.js
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/src/storage/database/migrations ./src/storage/database/migrations
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x /app/scripts/docker-entrypoint.sh

# Hermes 本地 CLI mock（scripts/hermes-mock.js → /usr/local/bin/hermes）
# 让路由的 Hermes 路径真正可用（spawn 'hermes' 成功），AIDialog 走本地分支
COPY --from=builder /app/scripts/hermes-mock.js /usr/local/bin/hermes
RUN chmod +x /usr/local/bin/hermes && \
    ln -sf /usr/local/bin/hermes /usr/bin/hermes

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 5000

# P0-3: liveness 用 /api/ping（永远 200），readiness 用 /api/health（503 degraded）
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/ping',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" || exit 1

# 启动前自动迁移（ENTRYPOINT_MIGRATE=0 可跳过）
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]