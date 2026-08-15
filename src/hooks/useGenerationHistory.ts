import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthHeader } from '@/lib/auth-client';
import { apiClient, API_ROUTES } from '@/lib/api-client';
import { toast } from 'sonner';

interface HistoryItem {
  id: string;
  featureId: string;
  imageUrl?: string;
  modelUrl?: string;
  videoUrl?: string;
  prompt?: string;
  params?: Record<string, unknown>;
  timestamp: Date;
}

/** API 作品记录响应项 */
interface ApiWorkItem {
  id: string;
  type: string;
  image_url?: string | null;
  outputImageUrl?: string | null;
  model_url?: string | null;
  outputModelUrl?: string | null;
  video_url?: string | null;
  outputVideoUrl?: string | null;
  prompt?: string | null;
  params?: Record<string, unknown>;
  createdAt: string;
}

interface UseGenerationHistoryOptions {
  featureId?: string;        // 可选：只获取特定功能的记录
  limit?: number;            // 最多获取多少条，默认 20
  persistToDb?: boolean;     // 是否同步到数据库，默认 true
}

interface UseGenerationHistoryReturn {
  history: HistoryItem[];
  isLoading: boolean;
  error: string | null;
  addToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  removeFromHistory: (id: string) => void;
  removeWithUndo: (id: string) => void;
  clearHistory: () => void;
  refresh: () => Promise<void>;
}

/**
 * 生成历史记录 Hook
 * 
 * 功能：
 * - IndexedDB 本地存储（快速访问）
 * - 可选同步到数据库（跨设备同步）
 * - 按功能筛选
 * - 自动清理过期记录
 * 
 * @example
 * ```tsx
 * function Text2Image() {
 *   const [result, setResult] = useState<string | null>(null);
 *   
 *   const { history, addToHistory } = useGenerationHistory({
 *     featureId: 'text2img',
 *     limit: 10,
 *   });
 * 
 *   const handleGenerate = async () => {
 *     const imageUrl = await callApi('generate-image', { prompt });
 *     setResult(imageUrl);
 *     addToHistory({
 *       featureId: 'text2img',
 *       imageUrl,
 *       prompt,
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       {result && <img src={result} alt="生成结果" />}
 *       <HistoryList items={history} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useGenerationHistory({
  featureId,
  limit = 20,
  persistToDb = true,
}: UseGenerationHistoryOptions = {}): UseGenerationHistoryReturn {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Undo 撤销栈：存储最近删除的项目，5秒内可撤销
  const undoStackRef = useRef<{ item: HistoryItem; timer: NodeJS.Timeout }[]>([]);

  /**
   * 清空已过期的撤销项（内部使用）
   */
  const expireUndoItem = useCallback((itemId: string) => {
    undoStackRef.current = undoStackRef.current.filter(
      (entry) => entry.item.id !== itemId
    );
  }, []);

  /**
   * featureId 标准化：兼容连字符版本和无连字符版本
   * 'image-3d' <-> 'image3d'
   * 'text-3d' <-> 'text3d'
   */
  const normalizeFeatureId = (id: string): string => {
    const map: Record<string, string> = {
      'image-3d': 'image3d',
      'text-3d': 'text3d',
    };
    return map[id] || id;
  };

  /**
   * 初始化 IndexedDB
   */
  const initDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('敦煌金历史记录', 1);
      
      request.onerror = () => reject(new Error('IndexedDB 打开失败'));
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('history')) {
          const store = db.createObjectStore('history', { keyPath: 'id' });
          store.createIndex('featureId', 'featureId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }, []);

  /**
   * 从 IndexedDB 加载历史记录
   */
  const loadFromIndexedDB = useCallback(async () => {
    try {
      const db = await initDB();
      
      return new Promise<HistoryItem[]>((resolve, reject) => {
        const transaction = db.transaction('history', 'readonly');
        const store = transaction.objectStore('history');
        
        // featureId 标准化
        const normalizedId = featureId ? normalizeFeatureId(featureId) : null;
        const index = normalizedId ? store.index('featureId') : store;
        
        const request = normalizedId
          ? index.getAll(normalizedId)
          : store.getAll();
        
        request.onsuccess = () => {
          let items = request.result as HistoryItem[];
          // 如果标准化后查不到，尝试原始 featureId（兼容旧数据）
          if (items.length === 0 && featureId && featureId !== normalizedId) {
            const fallbackIndex = store.index('featureId');
            const fallbackReq = fallbackIndex.getAll(featureId);
            fallbackReq.onsuccess = () => {
              items = (fallbackReq.result as HistoryItem[]) || [];
              items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              items = items.slice(0, limit);
              resolve(items);
            };
            fallbackReq.onerror = () => reject(new Error('读取历史记录失败'));
            return;
          }
          // 按时间倒序排序
          items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          // 限制数量
          items = items.slice(0, limit);
          resolve(items);
        };
        request.onerror = () => reject(new Error('读取历史记录失败'));
      });
    } catch (err) {
      console.error('[useGenerationHistory] IndexedDB 加载失败:', err);
      return [];
    }
  }, [featureId, limit, initDB]);

  /**
   * 从数据库 API 加载历史记录
   */
  const loadFromApi = useCallback(async () => {
    try {
      const authHeader = getAuthHeader();
      // featureId 标准化
      const normalizedId = featureId ? normalizeFeatureId(featureId) : null;
      const apiUrl = normalizedId 
        ? `/api/works?type=${normalizedId}&limit=${limit}`
        : `/api/works?limit=${limit}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        credentials: 'include',
      });
      if (!response.ok) return [];
      
      const result = await response.json();
      return (result.data || []).map((item: ApiWorkItem) => ({
        id: item.id,
        featureId: item.type,
        imageUrl: item.image_url || item.outputImageUrl || null,
        modelUrl: item.model_url || item.outputModelUrl || null,
        videoUrl: item.video_url || item.outputVideoUrl || null,
        prompt: item.prompt,
        params: item.params,
        timestamp: new Date(item.createdAt),
      }));
    } catch (err) {
      console.error('[useGenerationHistory] API 加载失败:', err);
      return [];
    }
  }, [featureId, limit]);

  /**
   * 保存记录到 IndexedDB
   */
  const saveToIndexedDB = useCallback(async (item: HistoryItem) => {
    try {
      const db = await initDB();
      const transaction = db.transaction('history', 'readwrite');
      const store = transaction.objectStore('history');
      store.put(item);
    } catch (err) {
      console.error('[useGenerationHistory] IndexedDB 保存失败:', err);
    }
  }, [initDB]);

  /**
   * 功能 ID → 作品展示分类名映射
   */
  const FEATURE_TO_CATEGORY: Record<string, string> = {
    text2img: '文案生图',
    dialogue: 'AI对话',
    relief: '图转浮雕图',
    text3d: '文生3D模型',
    image3d: '图转3D模型',
    '2dto3d': '平面转雕塑',
    refine: '产品精修',
    blend: '多图融合',
    oneclick: '一键设计',
    multiview: '生成多视图',
    sketch: '线稿/写实',
    free: '自由创作区',
    text2video: '文生视频',
    img2video: '图生视频',
    removebg: '移除背景',
    upscale: '高清放大',
    watermark: '去除水印',
  };

  /**
   * 保存记录到数据库 API
   */
  const saveToApi = useCallback(async (item: HistoryItem) => {
    try {
      // 生成标题
      const categoryName = FEATURE_TO_CATEGORY[item.featureId] || item.featureId;
      const title = `${categoryName}作品`;

      // 优先用 imageUrl（与 HistoryItem 一致）
      const imageUrl = item.imageUrl || null;

      // 从 localStorage 取 token（与 useAuth 一致）
      const authHeader = getAuthHeader();

      await apiClient.post(API_ROUTES.works, {
        title,
        type: item.featureId,
        prompt: item.prompt || null,
        image_url: imageUrl,
        model_url: item.modelUrl || null,
        video_url: item.videoUrl || null,
      });
    } catch (err) {
      console.error('[useGenerationHistory] API 保存失败:', err);
    }
  }, []);

  /**
   * 初始加载
   */
  useEffect(() => {
    let cancelled = false;
     
    setIsLoading(true);
     
    setError(null);

    const doLoad = async () => {
      try {
        // IndexedDB 为主数据源（包含完整数据：图片+模型+视频URL）
        // API 为补充数据源（用于跨设备同步）
        let items: HistoryItem[] = [];

        // 1. 先从 IndexedDB 加载
        const localItems = await loadFromIndexedDB();

        if (persistToDb) {
          // 2. 从 API 加载（可能包含新的跨设备数据）
          const apiItems = await loadFromApi();

          // 3. 合并：以 IndexedDB 为主，API 中的新项目补充进来
          const localIds = new Set(localItems.map((i: HistoryItem) => i.id));
          const newFromApi = apiItems.filter((i: HistoryItem) => !localIds.has(i.id));
          items = [...localItems, ...newFromApi];
        } else {
          items = localItems;
        }

        // 4. 按时间倒序
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (!cancelled) {
          setHistory(items);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
          setIsLoading(false);
        }
      }
    };

    doLoad();
    return () => { cancelled = true; };
  }, [featureId, limit, persistToDb, loadFromApi, loadFromIndexedDB]);

  /**
   * 添加到历史记录
   */
  const addToHistory = useCallback(async (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    // 更新本地状态
    setHistory((prev) => [newItem, ...prev].slice(0, limit));

    // 保存到 IndexedDB
    await saveToIndexedDB(newItem);

    // 同步到数据库
    if (persistToDb) {
      await saveToApi(newItem);
    }
  }, [limit, persistToDb, saveToIndexedDB, saveToApi]);

  /**
   * 从历史记录中移除
   */
  const removeFromHistory = useCallback(async (id: string) => {
    // 更新本地状态
    setHistory((prev) => prev.filter((item) => item.id !== id));

    // 从 IndexedDB 删除
    try {
      const db = await initDB();
      const transaction = db.transaction('history', 'readwrite');
      const store = transaction.objectStore('history');
      store.delete(id);
    } catch (err) {
      console.error('[useGenerationHistory] 删除失败:', err);
    }

    // TODO: 从数据库 API 删除（需要后端支持）
  }, [initDB]);

  /**
   * 恢复已删除的项目（用于撤销操作）
   */
  const restoreItem = useCallback(async (item: HistoryItem) => {
    // 恢复到历史记录顶部
    setHistory((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
    // 恢复到 IndexedDB
    await saveToIndexedDB(item);
    // 清除撤销栈中的记录
    expireUndoItem(item.id);
  }, [saveToIndexedDB, expireUndoItem]);

  /**
   * 带撤销功能的删除
   * 删除项目后显示 5 秒撤销提示
   */
  const removeWithUndo = useCallback(async (id: string) => {
    // 找到要删除的项目
    const itemToDelete = history.find((i) => i.id === id);
    if (!itemToDelete) return;

    // 先执行删除
    await removeFromHistory(id);

    // 清除该项目的旧定时器（如果有）
    const existingEntry = undoStackRef.current.find((e) => e.item.id === id);
    if (existingEntry) {
      clearTimeout(existingEntry.timer);
    }

    // 设置新的撤销窗口（5秒）
    const timer = setTimeout(() => {
      expireUndoItem(id);
    }, 5000);

    // 添加到撤销栈
    undoStackRef.current.push({ item: itemToDelete, timer });

    // 显示撤销吐司
    toast.error('已删除', {
      description: '5 秒内点击撤销恢复',
      action: {
        label: '撤销',
        onClick: () => restoreItem(itemToDelete),
      },
      duration: 5000,
    });
  }, [history, removeFromHistory, restoreItem, expireUndoItem]);

  /**
   * 清空历史记录
   */
  const clearHistory = useCallback(async () => {
    setHistory([]);

    // 清空 IndexedDB
    try {
      const db = await initDB();
      const transaction = db.transaction('history', 'readwrite');
      const store = transaction.objectStore('history');
      if (featureId) {
        // 只删除特定功能的记录
        const index = store.index('featureId');
        const request = index.getAllKeys(featureId);
        request.onsuccess = () => {
          request.result.forEach((key) => store.delete(key));
        };
      } else {
        store.clear();
      }
    } catch (err) {
      console.error('[useGenerationHistory] 清空失败:', err);
    }
  }, [featureId, initDB]);

  /**
   * 刷新历史记录
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      let items: HistoryItem[] = [];
      if (persistToDb) {
        items = await loadFromApi();
      }
      if (items.length === 0) {
        items = await loadFromIndexedDB();
      }
      setHistory(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新失败');
    } finally {
      setIsLoading(false);
    }
  }, [persistToDb, loadFromApi, loadFromIndexedDB]);

  return {
    history,
    isLoading,
    error,
    addToHistory,
    removeFromHistory,
    removeWithUndo,
    clearHistory,
    refresh,
  };
}
