import { prisma } from "./prisma";

export async function logAudit(params: {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details,
      },
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "ALERT";
  link?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type ?? "INFO",
        link: params.link,
      },
    });
  } catch (e) {
    console.error("Notification error:", e);
  }
}
