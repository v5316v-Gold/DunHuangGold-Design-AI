import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { listEnabledLLMProviders } from '@/lib/llm-providers-service';

export const runtime = 'nodejs';

/**
 * 获取 LLM provider + models 清单
 *
 * 数据源：system_settings.cloud_connections（id 以 llm- 开头）
 * 管理员和普通用户都能读，但显示的是"已启用的"
 */
export async function GET(request: Request) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  const data = await listEnabledLLMProviders();
  return NextResponse.json(data);
}
