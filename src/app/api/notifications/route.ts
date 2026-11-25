import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [notifications, auditLogs] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: user.role === "ADMIN" ? {} : { userId: user.id },
      include: { user: { select: { fullName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({ notifications, auditLogs });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (body.id) {
    await prisma.notification.update({ where: { id: body.id }, data: { isRead: true } });
  } else {
    await prisma.notification.updateMany({ where: { userId: user.id }, data: { isRead: true } });
  }
  return NextResponse.json({ ok: true });
}
