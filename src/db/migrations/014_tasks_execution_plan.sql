-- ============================================================
-- 014 · tasks 表加 execution_plan 列（ADR-009 冻结语义 + Phase 9.23 资产快照）
--
-- 历史问题：plan 只在内存构造，Worker 每次重试都重新 decideRouting，
-- 管理员切换 Active Workflow / default_executor 时，已创建的任务会被
-- 新配置穿透（冻结失效）。
-- 修复：把 plan 持久化到 tasks.execution_plan（jsonb），Worker 读它执行，
-- 不再重新路由。幂等 ALTER ... IF NOT EXISTS。
-- ============================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_plan jsonb;
