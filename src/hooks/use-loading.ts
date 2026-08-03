'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Unified loading state management hook
 * Supports single loading state and multiple named loading states
 */
export function useLoading(initialState = false) {
  const [loading, setLoading] = useState(initialState);

  const startLoading = useCallback(() => setLoading(true), []);
  const stopLoading = useCallback(() => setLoading(false), []);
  const toggleLoading = useCallback(() => setLoading((prev) => !prev), []);

  return {
    loading,
    isLoading: loading,
    setLoading,
    startLoading,
    stopLoading,
    toggleLoading,
  };
}

/**
 * Hook for managing multiple loading states
 * Useful when a component has several async operations
 */
export function useMultiLoading(initialStates?: Record<string, boolean>) {
  const [states, setStates] = useState<Record<string, boolean>>(
    initialStates ?? {}
  );
  const pendingCountRef = useRef(0);

  const setLoadingState = useCallback((key: string, value: boolean) => {
    setStates((prev) => ({ ...prev, [key]: value }));
  }, []);

  const startLoading = useCallback((key: string) => {
    pendingCountRef.current += 1;
    setStates((prev) => ({ ...prev, [key]: true }));
  }, []);

  const stopLoading = useCallback((key: string) => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
    setStates((prev) => ({ ...prev, [key]: false }));
  }, []);

  const withLoading = useCallback(
    async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
      startLoading(key);
      try {
        return await fn();
      } finally {
        stopLoading(key);
      }
    },
    [startLoading, stopLoading]
  );

  const isAnyLoading = Object.values(states).some(Boolean);

  return {
    loadingStates: states,
    setLoadingState,
    startLoading,
    stopLoading,
    withLoading,
    isAnyLoading,
  };
}

/**
 * Hook for tracking async operations with automatic loading state
 * Wraps an async function and manages loading state automatically
 */
export function useAsyncLoading<T extends unknown[], R>(
  asyncFn: (...args: T) => Promise<R>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: T): Promise<R | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await asyncFn(...args);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn]
  );

  return {
    loading,
    isLoading: loading,
    error,
    execute,
  };
}
