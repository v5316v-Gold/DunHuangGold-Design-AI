-- ============================================================
-- 006_add_loras.sql
-- W3-B: LoRA 元数据表（管理品牌 LoRA）
-- 文件本身存文件系统，元数据存 DB
-- ============================================================

CREATE TABLE IF NOT EXISTS loras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  trigger_words TEXT[] NOT NULL DEFAULT '{}',
  file_path VARCHAR(500) NOT NULL,
  file_hash VARCHAR(64),
  file_size BIGINT,
  base_model VARCHAR(100),
  scope TEXT[] NOT NULL DEFAULT '{}',
  preview_image VARCHAR(500),
  enabled BOOLEAN DEFAULT true NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 索引：按 enabled + scope 查
CREATE INDEX IF NOT EXISTS idx_loras_enabled
  ON loras(enabled)
  WHERE enabled = true;

-- 索引：scope GIN（数组查询）
CREATE INDEX IF NOT EXISTS idx_loras_scope
  ON loras USING GIN(scope);

COMMENT ON TABLE loras IS 'LoRA 元数据 - 品牌专属模型管理';
COMMENT ON COLUMN loras.trigger_words IS '触发词列表，拼接在用户 prompt 前';
COMMENT ON COLUMN loras.file_path IS 'LoRA 文件路径（指向 ComfyUI models/loras/）';
COMMENT ON COLUMN loras.scope IS '适用 AI 服务范围（text2img/refine/...）';