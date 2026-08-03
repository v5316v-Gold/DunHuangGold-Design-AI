import { db } from '@/db';
import { auditLogs } from '@/db/schema/_tables';

export async function logAudit(input: {
  action: string;
  resourceType: string;
  resourceId?: string;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  if (!db) return;
  try {
    await db.insert(auditLogs).values({
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      details: input.details || {},
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  } catch (error) {
    console.error('[audit] 写审计失败:', error);
  }
}
