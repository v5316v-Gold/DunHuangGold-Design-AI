import { useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { getAuthHeader } from '@/lib/auth-client';
import { apiClient, API_ROUTES } from '@/lib/api-client';

export type TranslateDirection = 'zh-en' | 'en-zh';

export function usePromptTranslate(getPrompt: () => string, setPrompt: (v: string) => void) {
  const setPromptRef = useRef(setPrompt);
  useEffect(() => { setPromptRef.current = setPrompt; }, [setPrompt]);

  const handleTranslatePrompt = useCallback(async (dir: TranslateDirection = 'zh-en') => {
    const currentPrompt = getPrompt();
    if (!currentPrompt.trim()) return;
    try {
      const data = await apiClient.post<{ translated?: string }>(API_ROUTES.translate, { text: currentPrompt.trim(), dir }, { withCredentials: true });
      if (data.success && data.data?.translated) {
        setPromptRef.current(data.data.translated);
      } else {
        toast.error(data.error || '翻译失败');
      }
    } catch (error) {
      console.error('翻译失败:', error);
      toast.error('翻译失败，请重试');
    }
  }, [getPrompt]);

  return { handleTranslatePrompt };
}
