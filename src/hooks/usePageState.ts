/**
 * 页面状态持久化 Hook（SSR-safe）
 * 使用 useSyncExternalStore 确保服务端和客户端使用相同的初始值
 */

import { useState, useEffect, useSyncExternalStore } from 'react';

const STORAGE_PREFIX = 'page-state-';

// 客户端 localStorage 订阅
const subscribers = new Set<() => void>();
function notifySubscribers() { subscribers.forEach(fn => fn()); }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', notifySubscribers);
  window.addEventListener('page-state-change', notifySubscribers);
}

function getStoredValue(key: string, defaultValue: string): string {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + key);
    if (saved && saved !== 'undefined' && saved !== '') return saved;
  } catch (_) {}
  return defaultValue;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function getSnapshot(key: string, defaultValue: string): string {
  return getStoredValue(key, defaultValue);
}

// 服务端 snapshot（SSR 时使用默认值，保证一致性）
function getServerSnapshot(key: string, defaultValue: string): string {
  return defaultValue;
}

export function usePageState(
  key: string,
  defaultValue: string
): [string, (value: string) => void] {
  const storeKey = STORAGE_PREFIX + key;

  // useSyncExternalStore 保证 SSR 和 CSR 初始值一致
  const value = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key, defaultValue),
    () => getServerSnapshot(key, defaultValue)
  );

  const setValue = (newValue: string) => {
    try {
      localStorage.setItem(storeKey, newValue);
      // 触发自定义事件通知所有使用同一个 key 的组件
      window.dispatchEvent(new CustomEvent('page-state-change', { detail: { key, value: newValue } }));
      notifySubscribers();
    } catch (_) {}
  };

  return [value, setValue];
}

/**
 * 清除指定页面的状态
 */
export function clearPageState(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_PREFIX + key);
}
