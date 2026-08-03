/**
 * 模拟用户数据（开发模式使用）
 * 用于在没有数据库连接时提供测试数据
 */

// 管理员默认算力
export const ADMIN_DEFAULT_POWER = 9999;

// 模拟用户余额存储
const mockUserBalances: Record<string, number> = {
  // 管理员账号
  'dev-admin-id': ADMIN_DEFAULT_POWER,
  // 测试用户
  'test-user-001': 100,
  '1': 500,
  '2': 1200,
  '3': 80,
  '4': 2000,
  '5': 350,
};

/**
 * 获取用户余额
 */
export function getMockUserBalance(userId: string): number {
  return mockUserBalances[userId] ?? 0;
}

/**
 * 更新用户余额
 */
export function updateMockUserBalance(userId: string, newBalance: number): void {
  mockUserBalances[userId] = newBalance;
}

/**
 * 充值用户余额
 * @returns 充值前的余额
 */
export function rechargeMockUserBalance(userId: string, amount: number): { previousBalance: number; newBalance: number } {
  const previousBalance = mockUserBalances[userId] ?? 0;
  const newBalance = previousBalance + amount;
  mockUserBalances[userId] = newBalance;
  return { previousBalance, newBalance };
}
