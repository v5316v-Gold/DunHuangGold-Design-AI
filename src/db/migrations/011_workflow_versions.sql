-- 011_workflow_versions.sql
-- Phase 9.23 · Workflow Asset Closure：版本化 + 发布门禁 + 反向引用
-- 设计：
--   comfyui_configs（已有）= workflow 逻辑身份（featureId 绑定、Active Version）
--   workflow_versions（新建）= immutable 版本（ADR-009 一旦发布不可变）
--   workflow_dependencies（新建）= Dependency Analyzer 快照（resolved/missing/version_mismatch/unknown）
--   workflow_node_checks（新建）= Custom Node 健康检查结果
--
-- 关系：
--   comfyui_configs.feature_id ↔ features.id（一对一）
--   comfyui_configs.active_version_id → workflow_versions.id（nullable，未 Active 时为空）
--   workflow_versions.workflow_id → comfyui_configs.id
--   workflow_dependencies.workflow_version_id → workflow_versions.id
--   workflow_node_checks.workflow_version_id → workflow_versions.id

-- ==================== workflow_versions（不可变）====================
CREATE TABLE IF NOT EXISTS workflow_versions (
  id                       VARCHAR(80) PRIMARY KEY,
  workflow_id              VARCHAR(50) NOT NULL REFERENCES comfyui_configs(id) ON DELETE CASCADE,
  version                  INTEGER NOT NULL,
  workflow_json            JSONB NOT NULL,
  input_mapping            JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_mapping           JSONB NOT NULL DEFAULT '{}'::jsonb,
  dependency_snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
  node_mapping             JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_params           JSONB NOT NULL DEFAULT '{}'::jsonb,
  fixed_params             JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum                 VARCHAR(64) NOT NULL,
  validation_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  dry_run_status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  validation_errors        JSONB NOT NULL DEFAULT '[]'::jsonb,
  dry_run_error            TEXT,
  changelog                TEXT,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by               VARCHAR(100),
  CONSTRAINT workflow_versions_unique UNIQUE (workflow_id, version)
);

CREATE INDEX IF NOT EXISTS workflow_versions_workflow_idx ON workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS workflow_versions_checksum_idx ON workflow_versions(checksum);
CREATE INDEX IF NOT EXISTS workflow_versions_validation_idx ON workflow_versions(validation_status);

-- ==================== workflow_dependencies（依赖解析快照）====================
-- Phase 9.23 §5：每个依赖标准状态
CREATE TABLE IF NOT EXISTS workflow_dependencies (
  id                  VARCHAR(80) PRIMARY KEY,
  workflow_version_id VARCHAR(80) NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  dep_type            VARCHAR(20) NOT NULL,  -- checkpoint/lora/controlnet/custom_node
  dep_name            VARCHAR(200) NOT NULL,
  expected_hash       VARCHAR(64),
  actual_hash         VARCHAR(64),
  status              VARCHAR(20) NOT NULL DEFAULT 'unknown',  -- resolved/missing/version_mismatch/unknown
  details             JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_deps_version_idx ON workflow_dependencies(workflow_version_id);
CREATE INDEX IF NOT EXISTS workflow_deps_status_idx ON workflow_dependencies(status);
CREATE INDEX IF NOT EXISTS workflow_deps_name_idx ON workflow_dependencies(dep_name);

-- ==================== workflow_node_checks（Custom Node 检查）====================
CREATE TABLE IF NOT EXISTS workflow_node_checks (
  id                  VARCHAR(80) PRIMARY KEY,
  workflow_version_id VARCHAR(80) NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  class_type          VARCHAR(200) NOT NULL,
  available           BOOLEAN NOT NULL DEFAULT false,
  source              VARCHAR(50),  -- object_info / static / unknown
  details             JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_node_checks_version_idx ON workflow_node_checks(workflow_version_id);
CREATE INDEX IF NOT EXISTS workflow_node_checks_available_idx ON workflow_node_checks(available);

-- ==================== comfyui_configs 扩展字段 ====================
-- 兼容性加列（IF NOT EXISTS 允许在已有表上重复执行）
ALTER TABLE comfyui_configs
  ADD COLUMN IF NOT EXISTS active_version_id VARCHAR(80) REFERENCES workflow_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lifecycle VARCHAR(20) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS dependency_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_validation_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_dry_run_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS comfyui_configs_active_version_idx ON comfyui_configs(active_version_id);
CREATE INDEX IF NOT EXISTS comfyui_configs_lifecycle_idx ON comfyui_configs(lifecycle);

-- ==================== 注册资产类（Phase 9.23 §3.1 模型中心）====================
-- 为兼容既有 storage/database/shared/schema，重新命名为 model_registry（避免冲突）
-- 这里只建表，不建控制器；C 阶段补全路由
CREATE TABLE IF NOT EXISTS model_registry (
  id                  VARCHAR(80) PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  type                VARCHAR(20) NOT NULL DEFAULT 'base',  -- base/lora/controlnet
  version             VARCHAR(50),
  base_model          VARCHAR(200),  -- LoRA/ControlNet 的 base 模型
  filename            VARCHAR(500),
  relative_path       VARCHAR(500),
  file_size           BIGINT,
  sha256              VARCHAR(64),
  status              VARCHAR(20) NOT NULL DEFAULT 'available',
  -- available/missing/disabled/incompatible
  comfyui_category    VARCHAR(100),  -- checkpoints/loras/controlnet/vae ...
  referenced_by       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- 反向引用 [{workflowId, versionId, required}]
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  disabled_at         TIMESTAMP,
  disabled_by         VARCHAR(100),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS model_registry_type_idx ON model_registry(type);
CREATE INDEX IF NOT EXISTS model_registry_status_idx ON model_registry(status);
CREATE INDEX IF NOT EXISTS model_registry_sha256_idx ON model_registry(sha256);

-- ==================== 注释 ====================
COMMENT ON TABLE workflow_versions IS 'Phase 9.23 · ADR-009 不可变版本（修改 = 新建版本）';
COMMENT ON TABLE workflow_dependencies IS 'Phase 9.23 §5 · Dependency Analyzer 快照（resolved/missing/version_mismatch/unknown）';
COMMENT ON TABLE workflow_node_checks IS 'Phase 9.23 §6 · Custom Node 健康检查（仅展示，不自动安装）';
COMMENT ON COLUMN model_registry.sha256 IS 'Phase 9.23 §3.1 · SHA256 哈希校验';
COMMENT ON COLUMN model_registry.referenced_by IS 'Phase 9.23 §10 · 反向引用，被 Active Workflow 引用的禁止物理删除';