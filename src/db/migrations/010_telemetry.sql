-- Phase 9.22 · telemetry 表（任务级追踪 18 字段落库）
-- 用途：request → task → provider → failure 全链路可追踪（G1 缺口补齐）
CREATE TABLE IF NOT EXISTS telemetry (
  id bigserial PRIMARY KEY,
  request_id varchar(100),
  trace_id varchar(100),
  task_id varchar(100),
  generation_id varchar(100),
  user_id uuid,
  feature_id varchar(50),
  executor_id varchar(50),
  provider_id varchar(50),
  workflow_version integer,
  model_versions jsonb DEFAULT '[]'::jsonb,
  queue_wait_ms integer,
  execution_ms integer,
  post_process_ms integer,
  total_ms integer,
  attempt integer DEFAULT 1,
  estimated_cost numeric(10, 2),
  actual_cost numeric(10, 2),
  failure_code varchar(100),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_request_id ON telemetry(request_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_trace_id ON telemetry(trace_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_task_id ON telemetry(task_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id ON telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry(created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_failure_code ON telemetry(failure_code);
