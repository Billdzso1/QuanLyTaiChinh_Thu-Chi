import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const user = await getCurrentUser();
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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const isFinance = canAccessFinance(user.role as UserRole);

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
      transactionDate: body.transactionDate ? new Date(body.transactionDate) : new Date(),
    },
    include: { category: true, department: true },
  });

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
  if (!user || !canAccessFinance(user.role as UserRole)) {
    return NextResponse.json({ error: "Không có quyền cập nhật giao dịch" }, { status: 403 });
  }

  const body = await request.json();
  const updated = await prisma.transaction.update({
    where: { id: body.id },
    data: {
      approvalStatus: body.approvalStatus,
      paymentStatus: body.paymentStatus,
      isDebt: body.isDebt !== undefined ? Boolean(body.isDebt) : undefined,
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
