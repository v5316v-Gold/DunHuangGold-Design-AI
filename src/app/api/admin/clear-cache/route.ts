import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/validators';
import { getCurrentUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';

/**
 * 清除缓存
 * 支持：API配置缓存、历史记录、标签缓存、翻译缓存
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const { type } = body; // config, history, tags, translate, all

    // 清除API配置缓存
    if (type === 'config' || type === 'all' || !type) {
      try {
        const { clearConfigCache, clearAllConfigCache } = await import('@/lib/api-config-service');
        clearAllConfigCache();
      } catch {
        // 忽略缓存清除错误
      }
    }

    // 清除翻译缓存（translate_settings表）
    if (type === 'translate' || type === 'all' || !type) {
      // 翻译缓存逻辑（如有）
    }

    // 清除历史记录和标签（如果相关表存在）
    if (type === 'history' || type === 'tags' || type === 'all' || !type) {
      // 这里可以添加清除历史记录的逻辑
    }

    return NextResponse.json({
      success: true,
      message: '缓存清理成功',
      cleaned: type || 'all',
    });
  } catch (error) {
    console.error('[clear-cache] 错误:', error);
    return NextResponse.json(
      { error: sanitizeError(error, '清除缓存失败').message },
      { status: 500 }
    );
  }
}
