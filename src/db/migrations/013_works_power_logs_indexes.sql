-- ============================================================
-- 013 · 补齐高频查询索引
--
-- 历史：works / power_logs 之前完全无索引，作品列表/算力日志随数据量
-- 增长会全表扫描，P99 严重劣化。
-- 此迁移用 IF NOT EXISTS 幂等补齐两张表的核心复合索引。
-- ============================================================

-- works：按用户 + 时间倒序的列表（个人作品页/管理后台作品审核）
CREATE INDEX IF NOT EXISTS idx_works_user_created
    ON works (user_id, created_at DESC);

-- works：管理后台按状态筛选（待审核 is_public 等）
CREATE INDEX IF NOT EXISTS idx_works_status_created
    ON works (status, created_at DESC);

-- power_logs：按用户 + 时间倒序的算力流水（个人中心/管理后台流水）
CREATE INDEX IF NOT EXISTS idx_power_logs_user_created
    ON power_logs (user_id, created_at DESC);
