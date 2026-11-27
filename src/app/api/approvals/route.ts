import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isFinance = canAccessFinance(user.role as UserRole);
  const where = isFinance
    ? {}
    : { OR: [{ createdById: user.id }, { departmentCode: user.department.code }] };

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
    const approvedAmount =
      body.approvedAmount !== undefined && body.approvedAmount !== ""
        ? Number(body.approvedAmount)
        : existing.amount;
    const approverNote = body.approverNote ? String(body.approverNote).trim() : null;

    history.push({
      action: "APPROVED",
      by: user.fullName,
      approvedAmount,
      note: approverNote,
      at: new Date().toISOString(),
    });
    const updated = await prisma.approval.update({
      where: { id: existing.id },
      data: {
        status: "APPROVED",
        approverId: user.id,
        approvedAt: new Date(),
        approvedAmount,
        approverNote,
        history: JSON.stringify(history),
      } as Record<string, unknown>,
    });
    await logAudit({
      userId: user.id,
      action: "APPROVE_PROPOSAL",
      entity: "Approval",
      entityId: existing.id,
      details: `Giám đốc duyệt đề xuất ${existing.code}: ${approvedAmount}đ${approverNote ? ` (${approverNote})` : ""}`,
    });
    return NextResponse.json({ approval: updated });
  }

  if (body.action === "ADD_EXPENSE") {
    const canAdd =
      canAccessFinance(user.role as UserRole) ||
      existing.createdById === user.id ||
      existing.departmentCode === user.department.code;
    if (!canAdd) {
      return NextResponse.json({ error: "Không có quyền cập nhật chi tiêu cho dự án này" }, { status: 403 });
    }
    if (!["APPROVED", "PAID"].includes(existing.status)) {
      return NextResponse.json({ error: "Chỉ dự án đã duyệt/đang triển khai mới thêm được minh chứng chi tiêu" }, { status: 400 });
    }

    const expAmount = Number(body.amount) || 0;
    const expTitle = String(body.title || "").trim();
    if (!expTitle || expAmount <= 0) {
      return NextResponse.json({ error: "Vui lòng nhập nội dung và số tiền chi hợp lệ" }, { status: 400 });
    }

    const rawItems = (existing as unknown as { expenseItems?: string }).expenseItems || "[]";
    const items = JSON.parse(rawItems) as Array<{
      id: string;
      title: string;
      amount: number;
      receiptUrl?: string | null;
      date: string;
      addedBy: string;
    }>;
    items.push({
      id: `${Date.now()}`,
      title: expTitle,
      amount: expAmount,
      receiptUrl: body.receiptUrl || null,
      date: new Date().toISOString(),
      addedBy: user.fullName,
    });
    const actualSpent = items.reduce((s, it) => s + Number(it.amount || 0), 0);

    history.push({
      action: "ADD_EXPENSE",
      by: user.fullName,
      title: expTitle,
      amount: expAmount,
      at: new Date().toISOString(),
    });

    const updated = await prisma.approval.update({
      where: { id: existing.id },
      data: {
        expenseItems: JSON.stringify(items),
        actualSpent,
        history: JSON.stringify(history),
      } as Record<string, unknown>,
    });

    await logAudit({
      userId: user.id,
      action: "ADD_PROJECT_EXPENSE",
      entity: "Approval",
      entityId: existing.id,
      details: `Thêm minh chứng chi ${existing.code}: ${expTitle} (${expAmount}đ)`,
    });
    return NextResponse.json({ approval: updated });
  }

  if (body.action === "SUBMIT_SETTLEMENT") {
    const canSubmit =
      canAccessFinance(user.role as UserRole) ||
      existing.createdById === user.id ||
      existing.departmentCode === user.department.code;
    if (!canSubmit) {
      return NextResponse.json({ error: "Không có quyền gửi quyết toán dự án này" }, { status: 403 });
    }
    const settlementNote = body.settlementNote ? String(body.settlementNote).trim() : null;
    history.push({
      action: "SUBMIT_SETTLEMENT",
      by: user.fullName,
      note: settlementNote,
      at: new Date().toISOString(),
    });

    const updated = await prisma.approval.update({
      where: { id: existing.id },
      data: {
        status: "SETTLEMENT_PENDING",
        settlementNote,
        history: JSON.stringify(history),
      } as Record<string, unknown>,
    });

    const financeUsers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "ACCOUNTANT"] }, isActive: true },
      select: { id: true },
    });
    if (financeUsers.length > 0) {
      await prisma.notification.createMany({
        data: financeUsers.map((fu) => ({
          userId: fu.id,
          title: "Yêu cầu quyết toán & đóng dự án",
          message: `${user.fullName} đã gửi quyết toán cho ${existing.code} (${existing.title}). Vui lòng kiểm tra và duyệt đóng.`,
          type: "INFO",
          link: "/approvals",
        })),
      });
    }

    return NextResponse.json({ approval: updated });
  }

  if (body.action === "APPROVE_SETTLEMENT") {
    if (!canAccessFinance(user.role as UserRole)) {
      return NextResponse.json({ error: "Chỉ Kế toán/Giám đốc được duyệt quyết toán & đóng dự án" }, { status: 403 });
    }
    const ext = existing as unknown as { approvedAmount?: number | null; actualSpent?: number };
    const approvedBudget = ext.approvedAmount ?? existing.amount;
    const actualSpent = ext.actualSpent ?? 0;
    const diff = approvedBudget - actualSpent;

    history.push({
      action: "CLOSED",
      by: user.fullName,
      approvedBudget,
      actualSpent,
      refundOrOverrun: diff,
      at: new Date().toISOString(),
    });

    const updated = await prisma.approval.update({
      where: { id: existing.id },
      data: {
        status: "CLOSED",
        settledAt: new Date(),
        history: JSON.stringify(history),
      } as Record<string, unknown>,
    });

    // Nếu đã giải ngân/ứng trước và có tiền tiết kiệm hoàn quỹ (diff > 0), tự động ghi nhận khoản thu hoàn quỹ
    if (diff > 0) {
      const incCat = await prisma.category.findFirst({ where: { type: "INCOME" } });
      const dept = await prisma.department.findUnique({ where: { code: existing.departmentCode } });
      if (incCat && dept) {
        await prisma.transaction.create({
          data: {
            code: generateCode("TC"),
            type: "INCOME",
            title: `Hoàn quỹ quyết toán ${existing.code}: ${existing.title}`,
            amount: diff,
            categoryId: incCat.id,
            departmentId: dept.id,
            createdById: user.id,
            reason: `Ngân sách duyệt ${approvedBudget}đ - Thực chi ${actualSpent}đ = Hoàn quỹ ${diff}đ`,
            approvalStatus: "APPROVED",
            paymentStatus: "PAID",
          },
        });
      }
    }

    await logAudit({
      userId: user.id,
      action: "SETTLE_CLOSE_APPROVAL",
      entity: "Approval",
      entityId: existing.id,
      details: `Duyệt quyết toán & đóng ${existing.code}: Duyệt ${approvedBudget}đ, Thực chi ${actualSpent}đ, Chênh lệch ${diff}đ`,
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
