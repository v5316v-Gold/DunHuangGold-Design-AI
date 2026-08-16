-- ============================================================
-- 013_worker_nodes_and_change_password.sql
-- W1 stage: 4 new tables
--   1) worker_nodes - reliable heartbeat (replaces meta probe)
--   2) api_config_secrets - AES-256-GCM encrypted secrets
--   3) ai_assistant_config - AI writing assistant config (single row)
--   4) admin_password_history - admin mandatory password change
-- ============================================================

-- worker_nodes
CREATE TABLE IF NOT EXISTS worker_nodes (
  id              VARCHAR(80) PRIMARY KEY,
  hostname        VARCHAR(120) NOT NULL,
  pid             INTEGER NOT NULL,
  queue           VARCHAR(50) NOT NULL DEFAULT 'ai-tasks',
  pid_started_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  last_heartbeat  TIMESTAMP NOT NULL DEFAULT NOW(),
  role            VARCHAR(20) NOT NULL DEFAULT 'worker',
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS worker_nodes_heartbeat_idx ON worker_nodes(last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS worker_nodes_queue_idx ON worker_nodes(queue);
COMMENT ON TABLE worker_nodes IS 'W1 worker heartbeat, replaces unreliable meta probe';

-- api_config_secrets
CREATE TABLE IF NOT EXISTS api_config_secrets (
  config_id   VARCHAR(50) PRIMARY KEY REFERENCES api_configs(id) ON DELETE CASCADE,
  ciphertext  TEXT NOT NULL,
  iv          VARCHAR(32) NOT NULL,
  auth_tag    VARCHAR(32) NOT NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE api_config_secrets IS 'W1 AES-256-GCM encrypted backup of apiConfigs.apiKey';

-- ai_assistant_config
CREATE TABLE IF NOT EXISTS ai_assistant_config (
  id              SMALLINT PRIMARY KEY DEFAULT 1,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  provider        VARCHAR(30) NOT NULL DEFAULT 'zhipu',
  model           VARCHAR(100) NOT NULL DEFAULT 'glm-4',
  api_key         TEXT,
  prompts         JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope           JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT only_one_row CHECK (id = 1)
);
COMMENT ON TABLE ai_assistant_config IS 'W1 AI writing assistant config (polish / translate), single row table';

-- admin_password_history
CREATE TABLE IF NOT EXISTS admin_password_history (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_change  TIMESTAMP NOT NULL DEFAULT NOW(),
  must_change  BOOLEAN NOT NULL DEFAULT true,
  hint         VARCHAR(100),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE admin_password_history IS 'W1 admin default account must change password on first login';

-- Force schema migration journal to record 013
INSERT INTO admin_password_history (user_id, last_change, must_change)
SELECT id, NOW(), true FROM users WHERE email='admin@dunhuang.com'
ON CONFLICT (user_id) DO NOTHING;
