-- ============================================================
-- 005_add_workflow_templates.sql
-- W2 Step 4: 工作流模板表（serviceType 维度 + 版本管理）
-- 与原 workflows 表并存（不破坏），新表是规范化版
-- ============================================================

CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  service_type VARCHAR(30) NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  workflow_json JSONB NOT NULL,
  input_schema JSONB,
  comfyui_version VARCHAR(20),
  required_custom_nodes TEXT[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT true NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 索引：按 service_type + enabled 查
CREATE INDEX IF NOT EXISTS idx_workflow_templates_service
  ON workflow_templates(service_type, enabled)
  WHERE enabled = true;

COMMENT ON TABLE workflow_templates IS '工作流模板 - 标准化的工作流 JSON（含 LoRA 节点）';
COMMENT ON COLUMN workflow_templates.service_type IS '适用 AI 服务（text2img/refine/...）';
COMMENT ON COLUMN workflow_templates.version IS '版本号，每次更新递增';