INSERT INTO users (id, email, password_hash, nickname, role, status, power, created_at, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'admin@dunhuang.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5gXyXyQyW5qy',
  'N.N.',
  'admin',
  'active',
  99999,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;