-- ============================================================
-- 018 · 清理历史对账 adjust 行
--
-- 历史：reconcile-power --apply 会在 power_transactions 写 type='adjust' 行
-- 修复 power 余额偏差。虽然 --apply 是幂等的（同源 adjust 存在则跳过），
-- 但旧 adjust 行不会自动清理，长期运行会无限增长。
--
-- 本迁移在部署时自动清理 30 天前的 adjust 行（保留最近 30 天对账痕迹
-- 供审计 + 排查需要）。幂等（IF NOT EXISTS-style 行为自然）。
-- ============================================================
DELETE FROM power_transactions
WHERE type = 'adjust'
  AND created_at < now() - interval '30 days';
