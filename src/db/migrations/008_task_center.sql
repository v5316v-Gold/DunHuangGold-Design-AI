-- 任务中心扩展（2026-08-03）
-- tasks 表新增字段：featureCode / executor / retryCount / maxRetries / cancelledAt
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS feature_code varchar(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS executor varchar(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_feature_code ON tasks(feature_code);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
