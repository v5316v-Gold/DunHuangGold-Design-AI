/**
 * GET /api/v1/features
 *
 * Phase 7.1 · 版本化功能元数据端点（v1）
 *
 * 与 /api/features 的区别：
 *   - 走 FeatureRepository（ADR-014）+ withRetry（自动重连）
 *   - 返回统一 envelope（requestId）
 *   - 数据源：DB（运行时真源 ADR-012）→ 静态兜底
 *
 * 响应：{ success, data: { features: [...], source }, requestId }
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { ok } from '@/lib/api/envelope';
import { featureRepository } from '@/db/repositories';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('X-Request-Id') || `req_${randomUUID()}`;

  const features = await featureRepository.listEnabled();
  const source = features.length > 17 ? 'database' : 'static-fallback';

  return ok(
    { features, source },
    { requestId, meta: { count: features.length } }
  );
}
