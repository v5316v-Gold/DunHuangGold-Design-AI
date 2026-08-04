/**
 * Phase 5.5 · Provider 注册表（Provider Registry）
 *
 * ADR-012（运行时配置在 DB）+ ADR-014（Repository 抽象）
 *
 * providers：可用 AI provider 注册表（minimax/meshy/kling/comfyui/ollama...）
 * provider_credentials：凭据（API Key 加密存储，AES-256-GCM，禁止明文）
 *
 * 敏感字段说明：credentials 列存加密 JSON；解密密钥来自 API_KEY_ENCRYPTION_KEY 环境变量。
 * 禁止日志打印完整 Key（09-Agent-Coding-Standards）。
 */

import { pgTable, varchar, text, jsonb, boolean, timestamp, integer, index, uuid } from 'drizzle-orm/pg-core';

/** Provider 注册表 */
export const providers = pgTable(
  'providers',
  {
    id: varchar('id', { length: 50 }).primaryKey(),
    /** provider 名称（minimax/meshy/kling/comfyui/ollama） */
    name: varchar('name', { length: 100 }).notNull(),
    /** 类型：cloud / local */
    kind: varchar('kind', { length: 20 }).default('cloud').notNull(),
    /** 基础 URL */
    baseUrl: text('base_url'),
    /** 是否启用 */
    enabled: boolean('enabled').default(true).notNull(),
    /** 健康状态（运行时更新） */
    health: varchar('health', { length: 20 }).default('unknown'),
    /** 最近延迟 ms */
    lastLatencyMs: integer('last_latency_ms'),
    /** 备注 */
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_prov_kind').on(table.kind)]
);

/** Provider 凭据（API Key 加密存储） */
export const providerCredentials = pgTable(
  'provider_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: varchar('provider_id', { length: 50 }).notNull().references(() => providers.id, { onDelete: 'cascade' }),
    /** 凭据名（如 primary / backup） */
    name: varchar('name', { length: 50 }).default('primary').notNull(),
    /** 加密后的 Key（AES-256-GCM ciphertext:iv:tag） */
    encryptedKey: text('encrypted_key').notNull(),
    /** Key 的指纹（sha256 前 16 位，用于识别/轮换） */
    keyFingerprint: varchar('key_fingerprint', { length: 32 }),
    /** 加密算法版本（便于轮换） */
    algorithmVersion: varchar('algorithm_version', { length: 20 }).default('aes-256-gcm-v1'),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_pc_provider').on(table.providerId)]
);
