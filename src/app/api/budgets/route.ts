import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isFinance = canAccessFinance(user.role as UserRole);
  const where = isFinance ? {} : { departmentId: user.departmentId };

  const [requests, budgets, departments] = await Promise.all([
    prisma.budgetRequest.findMany({
      where,
      include: { department: true, createdBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.departmentBudget.findMany({
      where,
      include: { department: true, expenses: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.department.findMany({ orderBy: { code: "asc" } }),
  ]);

  return NextResponse.json({ requests, budgets, departments });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const req = await prisma.budgetRequest.create({
    data: {
      code: generateCode("NS"),
      departmentId: body.departmentId || user.departmentId,
      createdById: user.id,
      title: body.title,
      amount: Number(body.amount),
      reason: body.reason,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      attachmentUrl: body.attachmentUrl || null,
      status: "PENDING",
    },
    include: { department: true },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE_BUDGET_REQUEST",
    entity: "BudgetRequest",
    entityId: req.id,
    details: `${req.title} - ${req.amount}`,
  });

  return NextResponse.json({ request: req }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const existing = await prisma.budgetRequest.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "ACCOUNTANT_CHECK") {
    if (!canAccessFinance(user.role as UserRole)) {
      return NextResponse.json({ error: "Chỉ Kế toán/Giám đốc được kiểm tra số liệu" }, { status: 403 });
    }
    const updated = await prisma.budgetRequest.update({
      where: { id: existing.id },
      data: { status: "ACCOUNTANT_CHECKED" },
    });
    return NextResponse.json({ request: updated });
  }

  if (body.action === "APPROVE") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ Giám đốc mới được phê duyệt ngân sách" }, { status: 403 });
    }
    const updated = await prisma.budgetRequest.update({
      where: { id: existing.id },
      data: { status: "APPROVED" },
    });

    const d = new Date(existing.periodStart || new Date());
    await prisma.departmentBudget.create({
      data: {
        departmentId: existing.departmentId,
        budgetRequestId: existing.id,
        title: existing.title,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        allocatedAmount: existing.amount,
        usedAmount: 0,
        status: "ACTIVE",
      },
    });

    await logAudit({
      userId: user.id,
      action: "APPROVE_BUDGET",
      entity: "BudgetRequest",
      entityId: existing.id,
      details: `Phê duyệt ngân sách ${existing.code}: ${existing.amount}`,
    });

    return NextResponse.json({ request: updated });
  }

  if (body.action === "REJECT" || body.action === "REVISION") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ Giám đốc mới được từ chối/yêu cầu chỉnh sửa" }, { status: 403 });
    }
    const updated = await prisma.budgetRequest.update({
      where: { id: existing.id },
      data: {
        status: body.action === "REJECT" ? "REJECTED" : "REVISION_REQUESTED",
        rejectReason: body.rejectReason || null,
      },
    });
    return NextResponse.json({ request: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
