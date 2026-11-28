import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissionsServer";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const denied = await requirePermission(user, "finance", "view");
  if (denied) return denied;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const deptId = searchParams.get("departmentId");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (deptId) where.departmentId = deptId;

  // Nhân viên thường chỉ xem giao dịch của phòng ban mình hoặc do mình tạo
  if (!canAccessFinance(user.role as UserRole)) {
    where.OR = [{ departmentId: user.departmentId }, { createdById: user.id }];
  }

  const [transactions, categories, departments] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, department: true, createdBy: { select: { id: true, fullName: true } } },
      orderBy: { transactionDate: "desc" },
    }),
    prisma.category.findMany({ orderBy: { code: "asc" } }),
    prisma.department.findMany({ orderBy: { code: "asc" } }),
  ]);

  return NextResponse.json({ transactions, categories, departments });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const denied = await requirePermission(user, "finance", "create");
  if (denied) return denied;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const isFinance = canAccessFinance(user.role as UserRole);

  const txDate = body.transactionDate ? new Date(body.transactionDate) : new Date();
  const tx = await prisma.transaction.create({
    data: {
      code: generateCode("TC"),
      type: body.type || "EXPENSE",
      title: body.title,
      amount: Number(body.amount),
      categoryId: body.categoryId,
      departmentId: body.departmentId || user.departmentId,
      createdById: user.id,
      reason: body.reason || body.title,
      voucherUrl: body.voucherUrl || null,
      approvalStatus: isFinance ? body.approvalStatus || "APPROVED" : "PENDING",
      paymentStatus: isFinance ? body.paymentStatus || "PAID" : "UNPAID",
      isDebt: Boolean(body.isDebt),
      transactionDate: txDate,
    },
    include: { category: true, department: true },
  });

  // Tự động cập nhật số tiền đã sử dụng vào Ngân sách phòng ban (nếu có gói ngân sách tháng đó)
  if (tx.type === "EXPENSE") {
    const matchingBudget = await prisma.departmentBudget.findFirst({
      where: {
        departmentId: tx.departmentId,
        month: txDate.getMonth() + 1,
        year: txDate.getFullYear(),
      },
    });
    if (matchingBudget) {
      const newUsed = matchingBudget.usedAmount + tx.amount;
      await prisma.departmentBudget.update({
        where: { id: matchingBudget.id },
        data: {
          usedAmount: newUsed,
          status: newUsed > matchingBudget.allocatedAmount ? "EXCEEDED" : "ACTIVE",
        },
      });
      await prisma.budgetExpense.create({
        data: {
          departmentBudgetId: matchingBudget.id,
          title: tx.title,
          amount: tx.amount,
          expenseDate: txDate,
          note: `Tự động liên kết từ ${tx.code}`,
        },
      });
    }
  }

  await logAudit({
    userId: user.id,
    action: "CREATE_TRANSACTION",
    entity: "Transaction",
    entityId: tx.id,
    details: `${tx.type}: ${tx.title} - ${tx.amount}`,
  });

  return NextResponse.json({ transaction: tx }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  const denied = await requirePermission(user, "finance", "edit");
  if (denied) return denied;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "UPLOAD_VOUCHER") {
    const existing = await prisma.transaction.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy giao dịch" }, { status: 404 });
    }
    if (!canAccessFinance(user.role as UserRole) && existing.createdById !== user.id) {
      return NextResponse.json({ error: "Không có quyền đính kèm chứng từ cho giao dịch này" }, { status: 403 });
    }
    const updated = await prisma.transaction.update({
      where: { id: body.id },
      data: { voucherUrl: body.voucherUrl || null },
    });
    await logAudit({
      userId: user.id,
      action: "UPLOAD_TRANSACTION_VOUCHER",
      entity: "Transaction",
      entityId: updated.id,
      details: `Đính kèm chứng từ/scan cho ${updated.code}`,
    });
    return NextResponse.json({ transaction: updated });
  }

  if (!canAccessFinance(user.role as UserRole)) {
    return NextResponse.json({ error: "Không có quyền cập nhật giao dịch" }, { status: 403 });
  }

  const updated = await prisma.transaction.update({
    where: { id: body.id },
    data: {
      approvalStatus: body.approvalStatus,
      paymentStatus: body.paymentStatus,
      isDebt: body.isDebt !== undefined ? Boolean(body.isDebt) : undefined,
      voucherUrl: body.voucherUrl !== undefined ? body.voucherUrl : undefined,
    },
  });

  if (body.paymentStatus === "PAID") {
    await prisma.paymentRecord.create({
      data: {
        transactionId: updated.id,
        amount: updated.amount,
        method: body.method || "BANK_TRANSFER",
        note: `Thanh toán bởi ${user.fullName}`,
      },
    });
  }

  await logAudit({
    userId: user.id,
    action: "UPDATE_TRANSACTION",
    entity: "Transaction",
    entityId: updated.id,
    details: `Cập nhật trạng thái: ${updated.approvalStatus} / ${updated.paymentStatus}`,
  });

  return NextResponse.json({ transaction: updated });
}
