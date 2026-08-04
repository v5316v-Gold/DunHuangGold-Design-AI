/**
 * Phase 4.6 · 服务注册触发（对齐 services/index.ts 的 side-effect import）
 *
 * 供新架构入口统一注册 17 个 AI 服务。
 */

// 触发全部服务注册（与旧 services/index.ts 等价的副作用导入）
import '@/lib/ai-service/services/text2img';
import '@/lib/ai-service/services/refine';
import '@/lib/ai-service/services/relief';
import '@/lib/ai-service/services/sketch';
import '@/lib/ai-service/services/blend';
import '@/lib/ai-service/services/removebg';
import '@/lib/ai-service/services/upscale';
import '@/lib/ai-service/services/watermark';
import '@/lib/ai-service/services/image3d';
import '@/lib/ai-service/services/multiview';
import '@/lib/ai-service/services/oneclick';
import '@/lib/ai-service/services/free';
import '@/lib/ai-service/services/text2video';
import '@/lib/ai-service/services/img2video';
import '@/lib/ai-service/services/stereo';
import '@/lib/ai-service/services/dialogue';
import '@/lib/ai-service/services/ai-assistant';
import '@/lib/ai-service/services/tryon';

export function registerAllServices(): void {
  // side-effect 已通过 import 完成；此函数供显式调用以消除未使用告警
}
