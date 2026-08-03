/**
 * ⚠️ DEPRECATED — 本文件已废弃
 *
 * 所有配置已迁移到 @/config/api-config（统一类型和常量）
 * 和 @/lib/api-config-service（服务层，DB 读写）
 *
 * 本文件保留用于向后兼容，新代码请使用：
 *   import { ... } from '@/config/api-config';   // 类型 + 常量
 *   import { getApiConfig } from '@/lib/api-config-service'; // 服务层
 */

export * from '@/config/api-config';
export { initializeConfigs, featureApiMapping } from '@/lib/api-config-service';
