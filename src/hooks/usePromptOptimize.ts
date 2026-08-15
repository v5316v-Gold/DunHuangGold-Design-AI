import { useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { getAuthHeader } from '@/lib/auth-client';
import { apiClient, API_ROUTES } from '@/lib/api-client';

export function usePromptOptimize(getPrompt: () => string, setPrompt: (v: string) => void) {
  const setPromptRef = useRef(setPrompt);
  useEffect(() => { setPromptRef.current = setPrompt; }, [setPrompt]);

  const handleOptimizePrompt = useCallback(async (ruleId = 'expand-general') => {
    const currentPrompt = getPrompt();
    if (!currentPrompt.trim()) return;
    try {
      const data = await apiClient.post<{ optimized?: string }>(API_ROUTES.promptOptimize, { prompt: currentPrompt.trim(), ruleId }, { withCredentials: true });
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
