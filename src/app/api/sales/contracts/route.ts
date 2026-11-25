import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where: Record<string, unknown> = {};
  if (user.role === "SALES" && !user.isTeamLead) {
    where.salesId = user.id;
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      customer: true,
      room: { include: { property: true } },
      sales: { select: { id: true, fullName: true, employeeCode: true } },
      deposits: true,
    },
    orderBy: { signedDate: "desc" },
  });

  return NextResponse.json({ contracts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const durationMonths = Number(body.durationMonths) === 6 ? 6 : 12;
  const depositAmount = Number(body.depositAmount);
  // Chính sách hoa hồng công ty: 6 tháng = 50%, 12 tháng = 70-100%
  let rate = Number(body.companyCommissionRate);
  if (durationMonths === 6) rate = 0.5;
  else if (rate < 0.7 || rate > 1) rate = 0.8;

  const companyRevenue = Math.round(depositAmount * rate);
  const landlordPayable = depositAmount - companyRevenue;
  const signedDate = body.signedDate ? new Date(body.signedDate) : new Date();
  const endDate = new Date(signedDate);
  endDate.setMonth(endDate.getMonth() + durationMonths);

  const collectedAmount = Number(body.collectedAmount || 0);
  const collectionStatus =
    collectedAmount >= depositAmount ? "COLLECTED" : collectedAmount > 0 ? "PARTIAL" : "UNPAID";

  const contract = await prisma.contract.create({
    data: {
      contractCode: generateCode("HD"),
      customerId: body.customerId,
      roomId: body.roomId,
      salesId: body.salesId || user.id,
      durationMonths,
      monthlyRent: Number(body.monthlyRent),
      depositAmount,
      companyCommissionRate: rate,
      companyRevenue,
      landlordPayable,
      signedDate,
      startDate: signedDate,
      endDate,
      status: "ACTIVE",
      note: body.note || null,
      deposits: {
        create: {
          totalDeposit: depositAmount,
          collectedAmount,
          remainingAmount: Math.max(0, depositAmount - collectedAmount),
          companyShare: companyRevenue,
          landlordShare: landlordPayable,
          collectionStatus,
          landlordPayoutStatus: "UNPAID",
          collectedAt: collectedAmount > 0 ? new Date() : null,
        },
      },
    },
    include: { deposits: true, customer: true, room: true },
  });

  // Update room & customer status
  await prisma.room.update({
    where: { id: body.roomId },
    data: { status: collectionStatus === "COLLECTED" ? "RENTED" : "RESERVED" },
  });
  await prisma.customer.update({
    where: { id: body.customerId },
    data: { status: collectionStatus === "COLLECTED" ? "SIGNED" : "DEPOSITED" },
  });

  // Nếu đã thu cọc, ghi nhận giao dịch thu hoa hồng công ty
  if (collectedAmount >= depositAmount) {
    const cat = await prisma.category.findUnique({ where: { code: "INC_COMMISSION" } });
    if (cat) {
      await prisma.transaction.create({
        data: {
          code: generateCode("TC"),
          type: "INCOME",
          title: `Hoa hồng hợp đồng ${contract.contractCode} (${durationMonths} tháng - ${(rate * 100).toFixed(0)}%)`,
          amount: companyRevenue,
          categoryId: cat.id,
          departmentId: user.departmentId,
          createdById: user.id,
          reason: "Thu hoa hồng từ tiền cọc hợp đồng",
          approvalStatus: "APPROVED",
          paymentStatus: "PAID",
          transactionDate: signedDate,
        },
      });
    }
  }

  await logAudit({
    userId: user.id,
    action: "CREATE_CONTRACT",
    entity: "Contract",
    entityId: contract.id,
    details: `Tạo HĐ ${contract.contractCode} - Cọc: ${depositAmount}, Doanh thu CTY: ${companyRevenue}`,
  });

  return NextResponse.json({ contract }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || (!canAccessFinance(user.role as UserRole) && user.role !== "SALES")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "UPLOAD_INVOICE") {
    const updated = await prisma.contract.update({
      where: { id: body.contractId },
      data: { invoiceUrl: body.invoiceUrl || null },
    });
    await logAudit({
      userId: user.id,
      action: "UPLOAD_CONTRACT_INVOICE",
      entity: "Contract",
      entityId: updated.id,
      details: `Tải ảnh hóa đơn minh chứng HĐ ${updated.contractCode}`,
    });
    return NextResponse.json({ contract: updated });
  }

  const deposit = await prisma.deposit.findUnique({
    where: { id: body.depositId },
    include: { contract: true },
  });
  if (!deposit) return NextResponse.json({ error: "Không tìm thấy phiếu cọc" }, { status: 404 });

  if (body.action === "COLLECT_DEPOSIT") {
    const collected = Number(body.collectedAmount ?? deposit.totalDeposit);
    const status = collected >= deposit.totalDeposit ? "COLLECTED" : collected > 0 ? "PARTIAL" : "UNPAID";
    const updated = await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        collectedAmount: collected,
        remainingAmount: Math.max(0, deposit.totalDeposit - collected),
        collectionStatus: status,
        collectedAt: new Date(),
      },
    });
    if (status === "COLLECTED") {
      await prisma.room.update({ where: { id: deposit.contract.roomId }, data: { status: "RENTED" } });
      await prisma.customer.update({ where: { id: deposit.contract.customerId }, data: { status: "SIGNED" } });
    }
    await logAudit({
      userId: user.id,
      action: "COLLECT_DEPOSIT",
      entity: "Deposit",
      entityId: deposit.id,
      details: `Thu tiền cọc HĐ ${deposit.contract.contractCode}: ${collected}`,
    });
    return NextResponse.json({ deposit: updated });
  }

  if (body.action === "PAY_LANDLORD") {
    if (!canAccessFinance(user.role as UserRole)) {
      return NextResponse.json({ error: "Chỉ Kế toán/Giám đốc được thanh toán chủ trọ" }, { status: 403 });
    }
    const updated = await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        landlordPaidAmount: deposit.landlordShare,
        landlordPayoutStatus: "PAID",
        landlordPaidAt: new Date(),
      },
    });
    await logAudit({
      userId: user.id,
      action: "PAY_LANDLORD",
      entity: "Deposit",
      entityId: deposit.id,
      details: `Thanh toán chủ trọ HĐ ${deposit.contract.contractCode}: ${deposit.landlordShare}`,
    });
    return NextResponse.json({ deposit: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
