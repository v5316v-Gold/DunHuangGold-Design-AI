import { useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { getAuthHeader } from '@/lib/auth-client';

export function usePromptOptimize(getPrompt: () => string, setPrompt: (v: string) => void) {
  const setPromptRef = useRef(setPrompt);
  useEffect(() => { setPromptRef.current = setPrompt; }, [setPrompt]);

  const handleOptimizePrompt = useCallback(async (ruleId = 'expand-general') => {
    const currentPrompt = getPrompt();
    if (!currentPrompt.trim()) return;
    try {
      const res = await fetch('/api/prompt-optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        credentials: 'include',
        body: JSON.stringify({ prompt: currentPrompt.trim(), ruleId }),
      });
      const data = await res.json();
      if (data.success && data.data?.optimized) {
        setPromptRef.current(data.data.optimized);
      } else {
        toast.error(data.error || '优化失败');
      }
    } catch (error) {
      console.error('优化失败:', error);
      toast.error('优化失败，请重试');
    }
  }, [getPrompt]);

  return { handleOptimizePrompt };
}
