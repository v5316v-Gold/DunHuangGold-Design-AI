-- ============================================================
-- 修复 P0-1: 创建算力流水表 power_transactions
-- 历史问题: 表定义在 src/db/schema/power-transactions.ts
--            但未纳入 _tables.ts，drizzle 迁移不生成 → 线上 42P01 错误
-- 修复方案: 幂等创建表 + 索引
-- ============================================================

CREATE TABLE IF NOT EXISTS power_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email VARCHAR(255),
  user_nickname VARCHAR(100),
  type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  operator_id UUID,
  operator_email VARCHAR(255),
  related_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pt_user_id ON power_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_type ON power_transactions(type);
CREATE INDEX IF NOT EXISTS idx_pt_created_at ON power_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pt_operator_id ON power_transactions(operator_id);

-- 注释
COMMENT ON TABLE power_transactions IS '算力流水表 - 充值/消耗/扣除/退款/奖励';
COMMENT ON COLUMN power_transactions.type IS '交易类型: recharge|consume|deduct|refund|bonus';
COMMENT ON COLUMN power_transactions.amount IS '变动金额，正数=增加，负数=减少';
COMMENT ON COLUMN power_transactions.balance_before IS '变动前余额';
COMMENT ON COLUMN power_transactions.balance_after IS '变动后余额';
COMMENT ON COLUMN power_transactions.operator_id IS '管理员操作时记录操作人ID';