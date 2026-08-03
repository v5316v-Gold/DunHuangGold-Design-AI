/**
 * AI 服务层 — 服务注册入口
 *
 * 导入此文件会自动注册所有 AI 服务到 registry。
 * 只需在路由文件顶部 import 一次即可。
 */

// 导入顺序很重要：先 types、registry，再导入各服务
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

export { registry } from '../service-registry';
export { pipeline } from '../generation-pipeline';
export type * from '../types';
