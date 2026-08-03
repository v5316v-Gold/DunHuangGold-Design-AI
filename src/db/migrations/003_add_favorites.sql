-- 创建收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, work_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_work_id ON favorites(work_id);

-- 注释
COMMENT ON TABLE favorites IS '用户收藏表';
COMMENT ON COLUMN favorites.user_id IS '用户ID';
COMMENT ON COLUMN favorites.work_id IS '作品ID';
