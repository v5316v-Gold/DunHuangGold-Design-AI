/**
 * Token 管理器 - 敦煌金 AI 设计平台
 * 
 * 基于 Claude Code 的 token 阈值管理理念设计：
 * - 20K buffer: 触发自动压缩
 * - 15K warning: 发出警告
 * - 8K error: 强制中断
 * 
 * 使用 React Context 实现，避免引入额外依赖。
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface TokenThresholds {
  autoCompact: number;
  warning: number;
  error: number;
}

export interface TokenBudget {
  maxContext: number;
  used: number;
  remaining: number;
  usagePercent: number;
  isWarning: boolean;
  isError: boolean;
}

export type TokenLevel = 'normal' | 'warning' | 'critical' | 'error';

// ============================================================================
// Constants - 默认阈值（200K 上下文窗口）
// ============================================================================

export const DEFAULT_TOKEN_THRESHOLDS: TokenThresholds = {
  autoCompact: 180_000,
  warning: 185_000,
  error: 192_000,
};

export const CONTEXT_THRESHOLDS: Record<number, TokenThresholds> = {
  32_000: { autoCompact: 24_000, warning: 27_000, error: 30_000 },
  64_000: { autoCompact: 52_000, warning: 57_000, error: 61_000 },
  128_000: { autoCompact: 108_000, warning: 113_000, error: 122_000 },
  200_000: { autoCompact: 180_000, warning: 185_000, error: 192_000 },
  1_000_000: { autoCompact: 920_000, warning: 950_000, error: 985_000 },
};

// ============================================================================
// Token 计算
// ============================================================================

export function estimateMessagesTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : JSON.stringify(msg.content);
    return total + estimateTextTokens(content);
  }, 0);
}

export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
}

export function calculateTokenLevel(used: number, thresholds: TokenThresholds): TokenLevel {
  if (used >= thresholds.error) return 'error';
  if (used >= thresholds.warning) return 'critical';
  if (used >= thresholds.autoCompact) return 'warning';
  return 'normal';
}

export function getThresholdsForContext(contextLength: number): TokenThresholds {
  const sortedContexts = Object.keys(CONTEXT_THRESHOLDS)
    .map(Number)
    .sort((a, b) => a - b);
  
  for (const ctx of sortedContexts) {
    if (contextLength <= ctx) {
      return CONTEXT_THRESHOLDS[ctx];
    }
  }
  return CONTEXT_THRESHOLDS[200_000] || DEFAULT_TOKEN_THRESHOLDS;
}

export function getLevelDescription(level: TokenLevel): string {
  const map: Record<TokenLevel, string> = {
    normal: '正常',
    warning: '即将压缩',
    critical: '即将耗尽',
    error: '超出限制',
  };
  return map[level] || '未知';
}

export function getLevelColor(level: TokenLevel): string {
  const map: Record<TokenLevel, string> = {
    normal: '#22c55e',
    warning: '#eab308',
    critical: '#f97316',
    error: '#ef4444',
  };
  return map[level] || '#6b7280';
}

// ============================================================================
// State & Reducer
// ============================================================================

interface TokenState {
  maxContext: number;
  thresholds: TokenThresholds;
  currentUsage: TokenUsage | null;
  usageHistory: TokenUsage[];
  used: number;
  remaining: number;
  usagePercent: number;
  level: TokenLevel;
}

type TokenAction =
  | { type: 'SET_MAX_CONTEXT'; payload: number }
  | { type: 'UPDATE_USAGE'; payload: TokenUsage }
  | { type: 'RESET' };

function tokenReducer(state: TokenState, action: TokenAction): TokenState {
  switch (action.type) {
    case 'SET_MAX_CONTEXT': {
      const thresholds = getThresholdsForContext(action.payload);
      return {
        ...state,
        maxContext: action.payload,
        thresholds,
        remaining: action.payload - state.used,
      };
    }
    case 'UPDATE_USAGE': {
      const usage = action.payload;
      const used = usage.totalTokens;
      const remaining = Math.max(0, state.maxContext - used);
      const usagePercent = (used / state.maxContext) * 100;
      const level = calculateTokenLevel(used, state.thresholds);
      return {
        ...state,
        currentUsage: usage,
        used,
        remaining,
        usagePercent,
        level,
        usageHistory: [...state.usageHistory.slice(-19), usage],
      };
    }
    case 'RESET':
      return {
        ...state,
        currentUsage: null,
        used: 0,
        remaining: state.maxContext,
        usagePercent: 0,
        level: 'normal',
      };
    default:
      return state;
  }
}

const initialState: TokenState = {
  maxContext: 200_000,
  thresholds: DEFAULT_TOKEN_THRESHOLDS,
  currentUsage: null,
  usageHistory: [],
  used: 0,
  remaining: 200_000,
  usagePercent: 0,
  level: 'normal',
};

// ============================================================================
// Context
// ============================================================================

interface TokenContextValue {
  state: TokenState;
  setMaxContext: (context: number) => void;
  updateUsage: (usage: TokenUsage) => void;
  reset: () => void;
  getBudget: () => TokenBudget;
}

const TokenContext = createContext<TokenContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tokenReducer, initialState);

  const setMaxContext = useCallback((context: number) => {
    dispatch({ type: 'SET_MAX_CONTEXT', payload: context });
  }, []);

  const updateUsage = useCallback((usage: TokenUsage) => {
    dispatch({ type: 'UPDATE_USAGE', payload: usage });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const getBudget = useCallback((): TokenBudget => {
    const { maxContext, used, remaining, usagePercent, level } = state;
    return {
      maxContext,
      used,
      remaining,
      usagePercent,
      isWarning: level === 'warning' || level === 'critical',
      isError: level === 'error',
    };
  }, [state]);

  const value = useMemo(
    () => ({ state, setMaxContext, updateUsage, reset, getBudget }),
    [state, setMaxContext, updateUsage, reset, getBudget]
  );

  return (
    <TokenContext.Provider value={value}>
      {children}
    </TokenContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useTokenStore(): TokenContextValue {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error('useTokenStore must be used within TokenProvider');
  }
  return context;
}

export function useTokenBudget(): TokenBudget {
  const { getBudget } = useTokenStore();
  return getBudget();
}
