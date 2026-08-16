-- ============================================================
-- 015 · API 配置密文备份表（api_config_secrets）
--
-- 历史：drizzle schema (_tables.ts line 360) 已定义，但全仓库无迁移 SQL，
-- 实时 DB 缺此表。W1 阶段"密钥保险箱"方案要求：
--   主页 api_configs.apiKey 仅存脱敏值（前缀星号 + 后 4 位），
--   真正密文存在本表（AES-256-GCM），解密统一过 secret-vault.ts。
-- 幂等 IF NOT EXISTS。
-- ============================================================
CREATE TABLE IF NOT EXISTS api_config_secrets (
    config_id   varchar(50) PRIMARY KEY
        REFERENCES api_configs(id) ON DELETE CASCADE,
    ciphertext  text NOT NULL,
    iv          varchar(32) NOT NULL,
    auth_tag    varchar(32) NOT NULL,
    updated_at  timestamp NOT NULL DEFAULT now()
);
COMMENT ON TABLE api_config_secrets
    IS 'W1 AES-256-GCM encrypted backup of apiConfigs.apiKey';
