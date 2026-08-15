-- ============================================================
-- 012 · 补齐缺失的表与列（算力预留 + Provider 凭据 + 任务状态列）
--
-- 历史问题：power_reservations / providers / provider_credentials
-- 有 drizzle schema 定义但全仓库无迁移 SQL 创建，导致：
--   - powerLedger.reserve() 首访即 42P01（被 catch 后静默降级内存）
--   - provider-repository 的 AES-256-GCM 加密无从落库
-- 同时 tasks 表缺 updated_at / attempt 两列，而 task-state.ts 一直在写。
--
-- 全部幂等（IF NOT EXISTS），可重复执行。
-- ============================================================

-- ============ 1. 算力预留表（Power Reservations，ADR-008） ============
CREATE TABLE IF NOT EXISTS power_reservations (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL,
    task_id          varchar(255),
    feature_id       varchar(50) NOT NULL,
    amount           integer NOT NULL,
    status           varchar(20) NOT NULL DEFAULT 'reserved',
    idempotency_key  varchar(255),
    reason           text,
    created_at       timestamp NOT NULL DEFAULT now(),
    settled_at       timestamp
);
CREATE INDEX IF NOT EXISTS idx_pr_user_id ON power_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_pr_task_id ON power_reservations(task_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON power_reservations(status);

-- ============ 2. Provider 注册表 + 凭据（AES-256-GCM 加密存储） ============
CREATE TABLE IF NOT EXISTS providers (
    id              varchar(50) PRIMARY KEY,
    name            varchar(100) NOT NULL,
    kind            varchar(20) NOT NULL DEFAULT 'cloud',
    base_url        text,
    enabled         boolean NOT NULL DEFAULT true,
    health          varchar(20) DEFAULT 'unknown',
    last_latency_ms integer,
    description     text,
    created_at      timestamp NOT NULL DEFAULT now(),
    updated_at      timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prov_kind ON providers(kind);

CREATE TABLE IF NOT EXISTS provider_credentials (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id       varchar(50) NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    name              varchar(50) NOT NULL DEFAULT 'primary',
    encrypted_key     text NOT NULL,
    key_fingerprint   varchar(32),
    algorithm_version varchar(20) DEFAULT 'aes-256-gcm-v1',
    enabled           boolean NOT NULL DEFAULT true,
    created_at        timestamp NOT NULL DEFAULT now(),
    updated_at        timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pc_provider ON provider_credentials(provider_id);

-- ============ 3. tasks 表补列（task-state.ts 一直在写这两列） ============
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 0;
