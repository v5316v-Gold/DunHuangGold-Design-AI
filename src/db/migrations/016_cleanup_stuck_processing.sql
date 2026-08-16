-- ============================================================
-- 016 · 清理历史卡在 processing 的旧任务 + 释放孤儿 power_reservations
--
-- 历史：修复前 task-state 写不存在的 updated_at/attempt 列 + 状态机
-- processing→dead_letter 不在白名单，导致早期任务永久卡在 processing。
-- 状态机已修（016 之前的修复），但残留的 3 条旧数据需要一次性数据修复。
--
-- 本迁移用 WHERE 条件幂等：
--   - 已经被推进到 dead_letter/completed/failed/cancelled 的任务不再匹配
--   - 新创建的 processing 任务（< 1 小时）也不匹配
--   - 只会清理历史卡住的 processing 任务
-- 同时释放对应任务的 power_reservations 孤儿预留（避免预留永远不归还）。
-- ============================================================

-- 1. 标记历史卡住的 processing 任务为 dead_letter
UPDATE tasks
SET status = 'dead_letter',
    completed_at = now(),
    error = 'cleaned up: stuck in processing (pre-fix migration 016)',
    updated_at = now()
WHERE status = 'processing'
  AND created_at < now() - interval '1 hour';

-- 2. 释放这些任务的孤儿 power_reservations（如果有）
--    关联条件：power_reservations.task_id 指向已 dead_letter 的任务且 status='reserved'
--    注意 task_id 是 varchar(255)，tasks.id 是 uuid，需要 ::text 转换
UPDATE power_reservations pr
SET status = 'released',
    settled_at = now()
FROM tasks t
WHERE pr.task_id = t.id::text
  AND pr.status = 'reserved'
  AND t.status = 'dead_letter'
  AND t.error LIKE 'cleaned up: stuck in processing%';
