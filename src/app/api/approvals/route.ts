import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isFinance = canAccessFinance(user.role as UserRole);
  const where = isFinance ? {} : { createdById: user.id };

  const approvals = await prisma.approval.findMany({
    where,
    include: {
      createdBy: { select: { id: true, fullName: true, position: true } },
      checker: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ approvals });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const history = [{ action: "CREATED", by: user.fullName, at: new Date().toISOString() }];

  const created = await prisma.approval.create({
    data: {
      code: generateCode("DX"),
      type: body.type || "EXPENSE",
      title: body.title,
      description: body.description,
      amount: Number(body.amount) || 0,
      departmentCode: user.department.code,
      attachmentUrl: body.attachmentUrl || null,
      createdById: user.id,
      status: "PENDING",
      history: JSON.stringify(history),
    },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE_APPROVAL",
    entity: "Approval",
    entityId: created.id,
    details: `Tạo đề xuất ${created.code}: ${created.title}`,
  });

  return NextResponse.json({ approval: created }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const existing = await prisma.approval.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const history = JSON.parse(existing.history || "[]");

  if (body.action === "CHECK") {
    if (!canAccessFinance(user.role as UserRole)) {
      return NextResponse.json({ error: "Chỉ Kế toán/Giám đốc được kiểm tra đề xuất" }, { status: 403 });
    }
    history.push({ action: "ACCOUNTANT_CHECKED", by: user.fullName, note: body.note, at: new Date().toISOString() });
    const updated = await prisma.approval.update({
      where: { id: existing.id },
      data: {
        status: "ACCOUNTANT_CHECKED",
        checkerId: user.id,
        checkedAt: new Date(),
        checkerNote: body.note || null,
        history: JSON.stringify(history),
      },
    });
    return NextResponse.json({ approval: updated });
  }

  if (body.action === "APPROVE") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ Giám đốc mới có quyền phê duyệt" }, { status: 403 });
    }
    history.push({ action: "APPROVED", by: user.fullName, at: new Date().toISOString() });
    const updated = await prisma.approval.update({
      where: { id: existing.id },
      data: {
        status: "APPROVED",
        approverId: user.id,
        approvedAt: new Date(),
        history: JSON.stringify(history),
      },
    });
    await logAudit({
      userId: user.id,
      action: "APPROVE_PROPOSAL",
      entity: "Approval",
      entityId: existing.id,
      details: `Giám đốc duyệt đề xuất ${existing.code}`,
    });
    return NextResponse.json({ approval: updated });
  }

  if (body.action === "REJECT") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ Giám đốc mới có quyền từ chối" }, { status: 403 });
    }
    history.push({ action: "REJECTED", by: user.fullName, reason: body.rejectReason, at: new Date().toISOString() });
    const updated = await prisma.approval.update({
      where: { id: existing.id },
      data: {
        status: "REJECTED",
        approverId: user.id,
        approvedAt: new Date(),
        rejectReason: body.rejectReason || "Không đạt yêu cầu",
        history: JSON.stringify(history),
      },
    });
    return NextResponse.json({ approval: updated });
  }

  if (body.action === "PAY") {
    if (!canAccessFinance(user.role as UserRole)) {
      return NextResponse.json({ error: "Chỉ Kế toán/Giám đốc được thực hiện thanh toán" }, { status: 403 });
    }
    history.push({ action: "PAID", by: user.fullName, at: new Date().toISOString() });
    const updated = await prisma.approval.update({
      where: { id: existing.id },
      data: { status: "PAID", history: JSON.stringify(history) },
    });
    return NextResponse.json({ approval: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
