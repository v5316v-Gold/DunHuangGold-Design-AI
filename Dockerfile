# 敦煌金 AI 设计平台 - Dockerfile (Phase 9.12 自装 Node)
# 多阶段构建：deps → builder → runner
# 用 alpine + 自装 Node（避免拉 node:20-alpine 镜像，国内环境 5+ 分钟慢）

# ===== 阶段 1: 依赖 =====
FROM alpine:3.20 AS deps
WORKDIR /app

# 国内镜像源（清华）加速 apk + pnpm
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apk/repositories && \
    apk add --no-cache nodejs npm curl bash && \
    npm install -g pnpm@9 --registry=https://registry.npmmirror.com

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

# ===== 阶段 2: 构建 (standalone) =====
FROM alpine:3.20 AS builder
WORKDIR /app
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apk/repositories && \
    apk add --no-cache nodejs npm bash && \
    npm install -g pnpm@9 --registry=https://registry.npmmirror.com

COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 生产构建要求 JWT_SECRET（next.config.ts 强校验）
ENV JWT_SECRET=build-time-placeholder-jwt-secret-must-be-replaced-at-runtime
# API_KEY_ENCRYPTION_KEY 同理（解密 provider 凭据需要）
ENV API_KEY_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
RUN pnpm build

# ===== 阶段 3: 运行（仅 standalone） =====
FROM alpine:3.20 AS runner
WORKDIR /app
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apk/repositories && \
    apk add --no-cache nodejs npm bash && \
    addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# P0-1: 数据库迁移文件 + entrypoint（启动前自动迁移，幂等）
COPY --from=builder /app/scripts/migrate.js ./scripts/migrate.js
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/src/storage/database/migrations ./src/storage/database/migrations
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x /app/scripts/docker-entrypoint.sh

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 5000

# P0-3: liveness 用 /api/ping（永远 200），readiness 用 /api/health（503 degraded）
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/ping',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" || exit 1

# 启动前自动迁移（ENTRYPOINT_MIGRATE=0 可跳过）
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]