import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { readContractSplits, saveContractSplit, allocateContractRevenue } from "@/lib/contractSplits";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where: Record<string, unknown> = {};
  if (user.role === "SALES" && !user.isTeamLead) {
    where.salesId = user.id;
  }

  const [contracts, allActiveContracts, splits] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        customer: true,
        room: { include: { property: true } },
        sales: { select: { id: true, fullName: true, employeeCode: true } },
        deposits: true,
      },
      orderBy: { signedDate: "desc" },
    }),
    prisma.contract.findMany({
      where: { status: { in: ["ACTIVE", "FORFEITED"] } },
      select: { id: true, salesId: true, companyRevenue: true },
    }),
    readContractSplits(),
  ]);

  const statsMap = allocateContractRevenue(allActiveContracts, splits);

  return NextResponse.json({ contracts, salesStats: statsMap });
}

function formatPaymentSummary(
  paymentMethod?: string,
  transferAmount?: number | string,
  cashAmount?: number | string
): string {
  if (paymentMethod === "TRANSFER") return "Hình thức thanh toán: Chuyển khoản";
  if (paymentMethod === "CASH") return "Hình thức thanh toán: Tiền mặt";
  if (paymentMethod === "MIXED") {
    const ck = Number(transferAmount || 0).toLocaleString("vi-VN");
    const tm = Number(cashAmount || 0).toLocaleString("vi-VN");
    return `Hình thức thanh toán: Chuyển khoản (${ck} đ) + Tiền mặt (${tm} đ)`;
  }
  return "";
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

  const isDepositOnly = Boolean(body.isDepositOnly);
  const collectedAmount = Number(body.collectedAmount || 0);
  const collectionStatus =
    collectedAmount >= depositAmount ? "COLLECTED" : collectedAmount > 0 ? "PARTIAL" : "UNPAID";
  const isFullySignedAndPaid = !isDepositOnly && collectionStatus === "COLLECTED";

  const paymentSummary = formatPaymentSummary(body.paymentMethod, body.transferAmount, body.cashAmount);
  const combinedNote = [String(body.note || "").trim(), paymentSummary].filter(Boolean).join(" • ") || null;

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
      status: isFullySignedAndPaid ? "ACTIVE" : "RESERVED",
      invoiceUrl: body.evidenceUrl || null,
      note: combinedNote,
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

  // Lưu chia hoa hồng 50% Sales Online / 50% Sales Offline nếu là lịch phối hợp
  const offlineSalesId = body.salesId || user.id;
  if (
    body.hybridMode &&
    body.hybridMode !== "SELF_100" &&
    body.onlineSalesId &&
    body.onlineSalesId !== offlineSalesId
  ) {
    await saveContractSplit({
      contractId: contract.id,
      onlineSalesId: body.onlineSalesId,
      offlineSalesId,
      onlineShare: 0.5,
      offlineShare: 0.5,
    });
  }

  // Update room & customer status
  await prisma.room.update({
    where: { id: body.roomId },
    data: { status: isFullySignedAndPaid ? "RENTED" : "RESERVED" },
  });
  const idCardTrimmed = String(body.customerIdCard || "").trim();
  await prisma.customer.update({
    where: { id: body.customerId },
    data: {
      status: isFullySignedAndPaid ? "SIGNED" : "DEPOSITED",
      ...(idCardTrimmed ? { idCard: idCardTrimmed } : {}),
    },
  });

  // Nếu đã thanh toán đủ & ký hợp đồng chính thức, ghi nhận giao dịch thu hoa hồng công ty
  if (isFullySignedAndPaid) {
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

  if (body.action === "SIGN_AND_RENT") {
    const updated = await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        collectedAmount: deposit.totalDeposit,
        remainingAmount: 0,
        collectionStatus: "COLLECTED",
        collectedAt: new Date(),
      },
    });
    const paymentSummary = formatPaymentSummary(body.paymentMethod, body.transferAmount, body.cashAmount);
    const extraNote = [String(body.note || "").trim(), paymentSummary].filter(Boolean).join(" • ");
    const nextNote = [deposit.contract.note, extraNote].filter(Boolean).join(" • ") || null;

    await prisma.contract.update({
      where: { id: deposit.contractId },
      data: {
        status: "ACTIVE",
        ...(body.evidenceUrl ? { invoiceUrl: body.evidenceUrl } : {}),
        ...(extraNote ? { note: nextNote } : {}),
      },
    });
    await prisma.room.update({
      where: { id: deposit.contract.roomId },
      data: { status: "RENTED" },
    });
    const idCardTrimmed = String(body.customerIdCard || "").trim();
    await prisma.customer.update({
      where: { id: deposit.contract.customerId },
      data: {
        status: "SIGNED",
        ...(idCardTrimmed ? { idCard: idCardTrimmed } : {}),
      },
    });

    const cat = await prisma.category.findUnique({ where: { code: "INC_COMMISSION" } });
    if (cat) {
      await prisma.transaction.create({
        data: {
          code: generateCode("TC"),
          type: "INCOME",
          title: `Hoa hồng hợp đồng ${deposit.contract.contractCode} (${deposit.contract.durationMonths} tháng - ${(deposit.contract.companyCommissionRate * 100).toFixed(0)}%)`,
          amount: deposit.companyShare,
          categoryId: cat.id,
          departmentId: user.departmentId,
          createdById: user.id,
          reason: "Thanh toán đủ & ký HĐ chính thức",
          approvalStatus: "APPROVED",
          paymentStatus: "PAID",
          transactionDate: new Date(),
        },
      });
    }

    await logAudit({
      userId: user.id,
      action: "SIGN_AND_RENT_CONTRACT",
      entity: "Contract",
      entityId: deposit.contractId,
      details: `Thanh toán đủ & ký HĐ ${deposit.contract.contractCode} — chuyển phòng sang Đã thuê`,
    });
    return NextResponse.json({ deposit: updated });
  }

  if (body.action === "CANCEL_DEPOSIT") {
    const holdDays = Math.max(0, Number(body.holdDays ?? 7));
    const collectedDeposit = Math.max(
      0,
      Number(
        body.collectedDeposit ??
          (deposit.collectedAmount > 0 ? deposit.collectedAmount : deposit.totalDeposit)
      )
    );
    const monthlyRent = deposit.contract.monthlyRent;
    const rawHoldFee = Math.round((monthlyRent / 30) * holdDays);
    const landlordHoldFee = Math.min(collectedDeposit, rawHoldFee);
    const remainingPool = Math.max(0, collectedDeposit - landlordHoldFee);
    const salesRemainderShare = Math.round(remainingPool * 0.5);
    const landlordRemainderShare = remainingPool - salesRemainderShare;
    const totalLandlordShare = landlordHoldFee + landlordRemainderShare;

    const cancelSummary = `Hủy cọc (${holdDays} ngày giữ phòng: ${landlordHoldFee.toLocaleString("vi-VN")}đ trả chủ trọ, dư ${remainingPool.toLocaleString("vi-VN")}đ chia 50/50 -> Chủ trọ thêm ${landlordRemainderShare.toLocaleString("vi-VN")}đ, Sales ${salesRemainderShare.toLocaleString("vi-VN")}đ)`;
    const cancelNote = [String(body.note || "").trim(), cancelSummary].filter(Boolean).join(" • ");
    const nextNote = [deposit.contract.note, cancelNote].filter(Boolean).join(" • ");

    const updated = await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        collectedAmount: collectedDeposit,
        remainingAmount: 0,
        companyShare: salesRemainderShare,
        landlordShare: totalLandlordShare,
        collectionStatus: "COLLECTED",
        landlordPayoutStatus: totalLandlordShare > 0 ? "UNPAID" : "PAID",
        collectedAt: deposit.collectedAt || new Date(),
      },
    });

    await prisma.contract.update({
      where: { id: deposit.contractId },
      data: {
        status: "FORFEITED",
        companyRevenue: salesRemainderShare,
        landlordPayable: totalLandlordShare,
        note: nextNote,
      },
    });

    await prisma.room.update({
      where: { id: deposit.contract.roomId },
      data: { status: "AVAILABLE" },
    });

    await prisma.customer.update({
      where: { id: deposit.contract.customerId },
      data: { status: "POTENTIAL" },
    });

    if (salesRemainderShare > 0) {
      const cat = await prisma.category.findUnique({ where: { code: "INC_COMMISSION" } });
      if (cat) {
        await prisma.transaction.create({
          data: {
            code: generateCode("TC"),
            type: "INCOME",
            title: `Chia 50% tiền cọc dư sau hủy cọc ${deposit.contract.contractCode}`,
            amount: salesRemainderShare,
            categoryId: cat.id,
            departmentId: user.departmentId,
            createdById: user.id,
            reason: cancelSummary,
            approvalStatus: "APPROVED",
            paymentStatus: "PAID",
            transactionDate: new Date(),
          },
        });
      }
    }

    await logAudit({
      userId: user.id,
      action: "CANCEL_DEPOSIT",
      entity: "Contract",
      entityId: deposit.contractId,
      details: `${deposit.contract.contractCode}: ${cancelSummary}`,
    });

    return NextResponse.json({
      deposit: updated,
      breakdown: {
        collectedDeposit,
        holdDays,
        landlordHoldFee,
        remainingPool,
        salesRemainderShare,
        landlordRemainderShare,
        totalLandlordShare,
      },
    });
  }

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
