/**
 * 所有数据表定义（供 schema/index.ts 聚合使用）
 * 不要在此文件定义 relations，避免循环依赖
 */
import { pgTable, text, integer, timestamp, boolean, jsonb, uuid, varchar, serial, bigint, numeric, index } from 'drizzle-orm/pg-core';

// ==================== 用户表 ====================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  avatar: text('avatar'),
  role: varchar('role', { length: 20 }).default('user').notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  power: integer('power').default(100).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
});

// ==================== 算力日志表 ====================
export const powerLogs = pgTable('power_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  amount: integer('amount').notNull(),
  balance: integer('balance').notNull(),
  reason: varchar('reason', { length: 255 }),
  relatedId: varchar('related_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== API配置表 ====================
export const apiConfigs = pgTable('api_configs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  apiKey: text('api_key'),
  provider: varchar('provider', { length: 50 }),
  model: varchar('model', { length: 100 }),
  url: text('url'),
  method: varchar('method', { length: 10 }).default('POST').notNull(),
  enabled: boolean('enabled').default(false).notNull(),
  timeout: integer('timeout').default(30000).notNull(),
  headers: jsonb('headers').default({}),
  paramMapping: jsonb('param_mapping').default({}),
  responseMapping: jsonb('response_mapping').default({}),
  fallback: jsonb('fallback').default({}),
  description: text('description'),
  lastTested: timestamp('last_tested'),
  testResult: varchar('test_result', { length: 20 }),
  appId: text('app_id'),
  disableThoughtChain: boolean('disable_thought_chain').default(false),
  enableAdvancedParams: boolean('enable_advanced_params').default(false),
  filterThoughtOutput: boolean('filter_thought_output').default(false),
  translateModel: varchar('translate_model', { length: 100 }),
  optimizeModel: varchar('optimize_model', { length: 100 }),
  vlmModel: varchar('vlm_model', { length: 100 }),
  showOnAssistant: boolean('show_on_assistant').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== 作品表 ====================
export const works = pgTable('works', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  type: varchar('type', { length: 50 }).notNull(),
  featureCode: varchar('feature_code', { length: 50 }),
  prompt: text('prompt'),
  inputImageUrl: text('input_image_url'),
  outputImageUrl: text('output_image_url'),
  outputVideoUrl: text('output_video_url'),
  outputModelUrl: text('output_model_url'),
  params: jsonb('params').default({}),
  powerCost: integer('power_cost').default(0),
  status: varchar('status', { length: 20 }).default('completed').notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== 任务队列表 ====================
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  error: text('error'),
  progress: integer('progress').default(0),
  powerCost: integer('power_cost').default(0),
  // 任务中心扩展字段（2026-08-03）
  featureCode: varchar('feature_code', { length: 50 }),      // 功能 ID（text2img 等）
  executor: varchar('executor', { length: 50 }),             // 执行器：mock/comfyui/third-party
  retryCount: integer('retry_count').default(0).notNull(),   // 重试次数
  maxRetries: integer('max_retries').default(3).notNull(),   // 最大重试
  attempt: integer('attempt').default(0).notNull(),          // 当前尝试次数（task-state 写入）
  /** ADR-009 冻结执行计划（创建时 snapshot，运行中不变，Worker 读取执行） */
  executionPlan: jsonb('execution_plan'),
  cancelledAt: timestamp('cancelled_at'),                    // 取消时间
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // 状态更新时间
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

// ==================== 工作流表 ====================
export const workflows = pgTable('workflows', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  workflowJson: jsonb('workflow_json').notNull(),
  comfyuiHost: varchar('comfyui_host', { length: 255 }),
  enabled: boolean('enabled').default(true).notNull(),
  lastExecuted: timestamp('last_executed'),
  executionCount: integer('execution_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== 系统设置表 ====================
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== 会话表 ====================
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== 收藏表 ====================
export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workId: uuid('work_id').notNull().references(() => works.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== 提示词规则表 ====================
export const promptRules = pgTable('prompt_rules', {
  id: varchar('id', { length: 50 }).primaryKey(),
  category: varchar('category', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  systemPrompt: text('system_prompt').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== 翻译设置表 ====================
export const translateSettings = pgTable('translate_settings', {
  id: varchar('id', { length: 50 }).primaryKey(),
  preserveNewline: boolean('preserve_newline').default(true),
  removeRedundantDots: boolean('remove_redundant_dots').default(false),
  removeExtraSpaces: boolean('remove_extra_spaces').default(false),
  halfwidthPunctuation: boolean('halfwidth_punctuation').default(false),
  mixedLangRule: varchar('mixed_lang_rule', { length: 20 }).default('to_en'),
  cacheMixedLang: boolean('cache_mixed_lang').default(false),
  useCache: boolean('use_cache').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==================== 应用设置表 ====================
export const appSettings = pgTable('app_settings', {
  id: varchar('id', { length: 50 }).primaryKey(),
  translateSettings: jsonb('translate_settings').default({}),
  interfaceSettings: jsonb('interface_settings').default({}),
  systemSettings: jsonb('system_settings').default({}),
  featureSwitches: jsonb('feature_switches').default({}),
  selectedServices: jsonb('selected_services').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==================== ComfyUI 连接配置表 ====================
export const comfyuiConnections = pgTable('comfyui_connections', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').default(8188),
  authToken: text('auth_token'),
  enabled: boolean('enabled').default(true),
  isDefault: boolean('is_default').default(false),
  priority: integer('priority').default(0),
  timeout: integer('timeout').default(120000),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==================== ComfyUI 工作流配置表 ====================
export const comfyuiConfigs = pgTable('comfyui_configs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  featureId: varchar('feature_id', { length: 50 }).notNull(),
  workflowId: varchar('workflow_id', { length: 100 }),
  workflowJson: jsonb('workflow_json'),
  nodeMapping: jsonb('node_mapping').$type<Record<string, unknown>>(),
  defaultParams: jsonb('default_params').$type<Record<string, unknown>>(),
  fixedParams: jsonb('fixed_params').$type<Record<string, unknown>>(),
  connectionId: varchar('connection_id', { length: 50 }),
  enabled: boolean('enabled').default(true).notNull(),
  isDefault: boolean('is_default').default(false),
  description: text('description'),
  executionCount: integer('execution_count').default(0),
  lastExecutedAt: timestamp('last_executed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==================== ComfyUI 执行日志表 ====================
export const comfyuiExecutionLogs = pgTable('comfyui_execution_logs', {
  id: serial('id').primaryKey(),
  workflowId: varchar('workflow_id', { length: 50 }).notNull(),
  featureId: varchar('feature_id', { length: 50 }).notNull(),
  promptId: varchar('prompt_id', { length: 100 }),
  params: jsonb('params').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  executionTimeMs: integer('execution_time_ms'),
  errorMessage: text('error_message'),
  result: jsonb('result'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ==================== 健康检查表 ====================
export const healthCheck = pgTable('health_check', {
  id: serial('id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ==================== 算力流水表（修复 P0-1）====================
/**
 * 算力流水表 - 记录所有算力变动：充值、消耗、扣除、退款、奖励
 * 历史问题：表定义在 src/db/schema/power-transactions.ts 但未纳入 _tables.ts
 *            导致 drizzle 不识别，迁移不生成 → 线上 42P01 错误
 * 修复：将定义合并到 _tables.ts 单一真源
 */
export const powerTransactions = pgTable('power_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 用户信息（冗余存储以提升查询性能）
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userEmail: varchar('user_email', { length: 255 }),
  userNickname: varchar('user_nickname', { length: 100 }),

  // 交易信息
  type: varchar('type', { length: 20 }).notNull(), // recharge | consume | deduct | refund | bonus
  amount: integer('amount').notNull(), // 正数=增加，负数=减少

  // 余额信息（冗余存储，记录变动前后余额）
  balanceBefore: integer('balance_before').notNull(),
  balanceAfter: integer('balance_after').notNull(),

  // 附加信息
  reason: text('reason'), // 原因/备注
  operatorId: uuid('operator_id'), // 操作人ID（管理员操作时记录）
  operatorEmail: varchar('operator_email', { length: 255 }), // 操作人邮箱

  // 关联业务记录（用于追踪具体业务）
  relatedId: varchar('related_id', { length: 255 }),

  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // 索引：按用户查、按类型查、按时间倒序
  index('idx_pt_user_id').on(table.userId),
  index('idx_pt_type').on(table.type),
  index('idx_pt_created_at').on(table.createdAt),
  index('idx_pt_operator_id').on(table.operatorId),
]);

// ==================== 审计日志表 ====================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorEmail: varchar('actor_email', { length: 255 }),
  actorRole: varchar('actor_role', { length: 20 }),
  action: varchar('action', { length: 50 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: varchar('resource_id', { length: 100 }),
  details: jsonb('details').default({}),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('audit_actor_idx').on(table.actorId, table.createdAt),
  index('audit_resource_idx').on(table.resourceType, table.resourceId),
  index('audit_action_idx').on(table.action),
]);

// ==================== 模型中心表 ====================
export const models = pgTable('models', {
  id: uuid('id').primaryKey().defaultRandom(),
  // 模型类型：lora / base-model / controlnet
  modelType: varchar('model_type', { length: 30 }).notNull(),
  // 模型名称（如 "sd15-lora-gold-foil"）
  name: varchar('name', { length: 100 }).notNull(),
  // 文件路径（执行机上的落盘路径）
  filePath: text('file_path'),
  // 原始文件名
  originalFilename: varchar('original_filename', { length: 255 }),
  // 版本
  version: varchar('version', { length: 30 }).default('1.0.0'),
  // 文件大小（字节）
  fileSize: bigint('file_size', { mode: 'number' }).default(0),
  // SHA256 校验值
  sha256: varchar('sha256', { length: 64 }),
  // 绑定功能（featureCode，多个）
  boundFeatures: jsonb('bound_features').default([]).$type<string[]>(),
  // 启用/禁用
  enabled: boolean('enabled').default(true).notNull(),
  // 触发词（LoRA 用）
  triggerWords: jsonb('trigger_words').default([]).$type<string[]>(),
  // 基础模型（LoRA 依赖的 base model）
  baseModel: varchar('base_model', { length: 100 }),
  // 权重（LoRA 默认权重 0-1）
  weight: numeric('weight', { precision: 3, scale: 2 }).default('0.8'),
  // 描述
  description: text('description'),
  // 上传者
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('models_type_idx').on(t.modelType),
  index('models_enabled_idx').on(t.enabled),
  index('models_sha_idx').on(t.sha256),
]);

// ==================== W1: Worker 节点心跳 ====================
export const workerNodes = pgTable('worker_nodes', {
  id: varchar('id', { length: 80 }).primaryKey(),
  hostname: varchar('hostname', { length: 120 }).notNull(),
  pid: integer('pid').notNull(),
  queue: varchar('queue', { length: 50 }).notNull().default('ai-tasks'),
  pidStartedAt: timestamp('pid_started_at').notNull().defaultNow(),
  lastHeartbeat: timestamp('last_heartbeat').notNull().defaultNow(),
  role: varchar('role', { length: 20 }).notNull().default('worker'),
  meta: jsonb('meta').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('worker_nodes_heartbeat_idx').on(t.lastHeartbeat),
  index('worker_nodes_queue_idx').on(t.queue),
]);

// ==================== W1: API 配置密文备份位 ====================
export const apiConfigSecrets = pgTable('api_config_secrets', {
  configId: varchar('config_id', { length: 50 }).primaryKey().references(() => apiConfigs.id, { onDelete: 'cascade' }),
  ciphertext: text('ciphertext').notNull(),
  iv: varchar('iv', { length: 32 }).notNull(),
  authTag: varchar('auth_tag', { length: 32 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== W1: AI 写作助手配置 ====================
export const aiAssistantConfig = pgTable('ai_assistant_config', {
  id: integer('id').primaryKey().default(1),
  enabled: boolean('enabled').default(true).notNull(),
  provider: varchar('provider', { length: 30 }).default('zhipu').notNull(),
  model: varchar('model', { length: 100 }).default('glm-4').notNull(),
  apiKey: text('api_key'),
  prompts: jsonb('prompts').default({}).notNull(),
  scope: jsonb('scope').default([]).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== W1: admin 密码历史 ====================
export const adminPasswordHistory = pgTable('admin_password_history', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  lastChange: timestamp('last_change').defaultNow().notNull(),
  mustChange: boolean('must_change').default(true).notNull(),
  hint: varchar('hint', { length: 100 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
