// ==================== 审计日志表 ====================
// 注：表定义已合并到 src/db/schema/_tables.ts（避免循环依赖与 schema 分散）。
// 本文件保留为类型导出与统一 re-export，便于跨模块引用。
import { users } from './_tables';

// 运行时表对象（实际定义在 _tables.ts）— 这里导出一个空对象用于占位，
// 真正的字段定义在 _tables.ts 中。本文件仅作为类型与审计日志入口。
export type AuditLog = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

// 用户关联（仅类型层面）
export type AuditActor = typeof users.$inferSelect;