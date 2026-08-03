// 算力管理 Hook
import { useState, useEffect, useCallback } from 'react';
import { getAuthHeader } from '@/hooks/useAuth';
import { useAuth } from '@/hooks/useAuth';

const POWER_KEY = 'dunhuang_power';
const POWER_LOGS_KEY = 'dunhuang_power_logs';

// 管理员默认算力
export const ADMIN_DEFAULT_POWER = 9999;
// 普通用户初始算力
const USER_INITIAL_POWER = 100;

interface PowerLog {
  time: string;
  type: 'add' | 'deduct' | 'set';
  amount: number;
  reason: string;
  balance: number;
}

export function usePower() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [localPower, setLocalPower] = useState(0);
  const [initialized, setInitialized] = useState(false);

  // 获取实际算力值
  const getEffectivePower = useCallback(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        return Math.max(user.power, ADMIN_DEFAULT_POWER);
      }
      return user.power;
    }
    return localPower;
  }, [isAuthenticated, user, localPower]);

  const power = getEffectivePower();

  useEffect(() => {
    if (!isAuthenticated) {
      const saved = localStorage.getItem(POWER_KEY);
      const initialPower = saved ? (parseInt(saved) || 0) : USER_INITIAL_POWER;
      if (!saved) {
        localStorage.setItem(POWER_KEY, String(USER_INITIAL_POWER));
      }
      // 只在值实际变化时才更新
      if (initialPower !== localPower) {
         
        setLocalPower(initialPower);
      }
    }
    // 只在状态确实变化时才更新
    if (initialized !== true) {
       
      setInitialized(true);
    }
  }, [isAuthenticated]);

  const addPower = useCallback(async (amount: number, reason: string = '充值') => {
    if (isAuthenticated) {
      try {
        const res = await fetch('/api/power', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({ action: 'add', amount, reason }),
        });
        const data = await res.json();
        if (data.success) {
          refreshUser?.();
          return data.data.power;
        } else {
          throw new Error(data.error || '充值失败');
        }
      } catch (error) {
        console.error('[power] 充值失败:', error);
        throw error;
      }
    }

    setLocalPower((prev) => {
      const newPower = prev + amount;
      localStorage.setItem(POWER_KEY, String(newPower));
      addLog('add', amount, reason, newPower);
      return newPower;
    });
  }, [isAuthenticated, refreshUser]);

  const deductPower = useCallback(async (amount: number, reason: string = '任务消耗') => {
    const currentPower = getEffectivePower();

    if (currentPower < amount) {
      throw new Error('算力不足');
    }

    if (isAuthenticated) {
      // 乐观扣减：立即更新本地状态
      const newPower = currentPower - amount;
      setLocalPower(newPower);

      try {
        const res = await fetch('/api/power', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({ action: 'deduct', amount, reason }),
        });
        const data = await res.json();
        if (data.success) {
          refreshUser?.();
          console.log(`[power] 扣减成功: -${amount} (${reason})`);
          return data.data.power;
        } else {
          // API 返回错误，刷新同步状态
          console.error('[power] 扣减失败:', data.error);
          refreshUser?.();
          return newPower;
        }
      } catch (error) {
        // API 请求失败，回滚本地状态并刷新
        console.error('[power] 扣减请求失败:', error);
        setLocalPower(currentPower);
        refreshUser?.();
        throw error;
      }
    }

    // 未登录，走本地扣减
    setLocalPower((prev) => {
      const newPower = prev - amount;
      localStorage.setItem(POWER_KEY, String(newPower));
      addLog('deduct', -amount, reason, newPower);
      console.log(`[power] 本地扣减: -${amount} (${reason}), 余额: ${newPower}`);
      return newPower;
    });
  }, [isAuthenticated, getEffectivePower, refreshUser]);

  const setPowerValue = useCallback(async (value: number, reason: string = '管理员设置') => {
    const newPower = Math.max(0, value);

    if (isAuthenticated) {
      try {
        const res = await fetch('/api/power', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({ action: 'set', amount: newPower, reason }),
        });
        const data = await res.json();
        if (data.success) {
          refreshUser?.();
          return data.data.power;
        } else {
          throw new Error(data.error || '设置失败');
        }
      } catch (error) {
        console.error('[power] 设置失败:', error);
        throw error;
      }
    }

    localStorage.setItem(POWER_KEY, String(newPower));
    addLog('set', newPower, reason, newPower);
    setLocalPower(newPower);
  }, [isAuthenticated, refreshUser]);

  const checkPower = useCallback((required: number) => {
    return getEffectivePower() >= required;
  }, [getEffectivePower]);

  return {
    power,
    addPower,
    deductPower,
    setPower: setPowerValue,
    checkPower,
    initialized,
  };
}

function addLog(type: 'add' | 'deduct' | 'set', amount: number, reason: string, balance: number) {
  try {
    const logs: PowerLog[] = JSON.parse(localStorage.getItem(POWER_LOGS_KEY) || '[]');
    logs.unshift({
      time: new Date().toISOString(),
      type,
      amount,
      reason,
      balance,
    });
    // 最多保留500条
    if (logs.length > 500) logs.length = 500;
    localStorage.setItem(POWER_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to add power log:', e);
  }
}

export function getPowerLogs(limit: number = 50): PowerLog[] {
  try {
    const logs: PowerLog[] = JSON.parse(localStorage.getItem(POWER_LOGS_KEY) || '[]');
    return logs.slice(0, limit);
  } catch {
    return [];
  }
}

export function clearPowerLogs() {
  localStorage.removeItem(POWER_LOGS_KEY);
}

// 重新导出 getFeatureCost 以保持向后兼容
export { getFeatureCost as getTaskCost, preloadFeatureCosts, saveFeatureCosts } from './feature-costs';
