import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSalesCommission, generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month")) || 11;
  const year = Number(searchParams.get("year")) || 2026;
  const scope = searchParams.get("scope");

  const canViewAll = scope === "all" && canAccessFinance(user.role as UserRole);
  const where: Record<string, unknown> = { month, year };
  if (!canViewAll) where.userId = user.id;

  const payrolls = await prisma.payroll.findMany({
    where,
    include: {
      user: { select: { id: true, employeeCode: true, fullName: true, role: true, position: true, department: true } },
      details: true,
    },
    orderBy: { user: { employeeCode: "asc" } },
  });

  const history = !canViewAll
    ? await prisma.payroll.findMany({
        where: { userId: user.id },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      })
    : [];

  return NextResponse.json({ payrolls, history });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessFinance(user.role as UserRole)) {
    return NextResponse.json({ error: "Chỉ Kế toán/Giám đốc được tính bảng lương" }, { status: 403 });
  }

  const { month = 11, year = 2026 } = await request.json();
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  const users = await prisma.user.findMany({ where: { isActive: true } });
  const contracts = await prisma.contract.findMany({
    where: {
      status: { not: "CANCELLED" },
      signedDate: {
        gte: new Date(`${monthStr}-01T00:00:00Z`),
        lt: new Date(month === 12 ? `${year + 1}-01-01T00:00:00Z` : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`),
      },
    },
  });

  const results = [];
  for (const u of users) {
    if (u.role === "SALES") {
      const salesRev = contracts.filter((c) => c.salesId === u.id).reduce((s, c) => s + c.companyRevenue, 0);
      const calc = calculateSalesCommission(salesRev);
      const grossIncome = calc.grossIncome + u.allowance;
      const p = await prisma.payroll.upsert({
        where: { userId_month_year: { userId: u.id, month, year } },
        update: {
          baseSalary: calc.baseSalary,
          salesRevenue: salesRev,
          commissionRate: calc.rate,
          commissionAmount: calc.commissionAmount,
          companyRetained: calc.companyRetained,
          allowance: u.allowance,
          grossIncome,
          netSalary: grossIncome,
        },
        create: {
          userId: u.id,
          month,
          year,
          baseSalary: calc.baseSalary,
          salesRevenue: salesRev,
          commissionRate: calc.rate,
          commissionAmount: calc.commissionAmount,
          companyRetained: calc.companyRetained,
          allowance: u.allowance,
          grossIncome,
          netSalary: grossIncome,
          status: "DRAFT",
        },
      });
      results.push(p);
    } else {
      const gross = u.baseSalary + u.allowance;
      const p = await prisma.payroll.upsert({
        where: { userId_month_year: { userId: u.id, month, year } },
        update: { baseSalary: u.baseSalary, allowance: u.allowance, grossIncome: gross, netSalary: gross },
        create: {
          userId: u.id,
          month,
          year,
          baseSalary: u.baseSalary,
          allowance: u.allowance,
          grossIncome: gross,
          netSalary: gross,
          status: "DRAFT",
        },
      });
      results.push(p);
    }
  }

  await logAudit({
    userId: user.id,
    action: "GENERATE_PAYROLL",
    entity: "Payroll",
    details: `Tổng hợp bảng lương tháng ${month}/${year} cho ${results.length} nhân sự`,
  });

  return NextResponse.json({ count: results.length });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessFinance(user.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "UPDATE_ADJUSTMENTS") {
    const existing = await prisma.payroll.findUnique({ where: { id: body.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const bonus = Number(body.bonus ?? existing.bonus);
    const overtimePay = Number(body.overtimePay ?? existing.overtimePay);
    const deduction = Number(body.deduction ?? existing.deduction);
    const grossIncome = existing.baseSalary + existing.commissionAmount + existing.allowance + bonus + overtimePay;
    const netSalary = Math.max(0, grossIncome - deduction);

    const updated = await prisma.payroll.update({
      where: { id: existing.id },
      data: { bonus, overtimePay, deduction, grossIncome, netSalary, note: body.note },
    });
    return NextResponse.json({ payroll: updated });
  }

  if (body.action === "CHECK_ALL") {
    await prisma.payroll.updateMany({
      where: { month: body.month, year: body.year, status: "DRAFT" },
      data: { status: "CHECKED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "APPROVE_ALL") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ Giám đốc mới có quyền duyệt bảng lương" }, { status: 403 });
    }
    await prisma.payroll.updateMany({
      where: { month: body.month, year: body.year, status: { in: ["DRAFT", "CHECKED"] } },
      data: { status: "APPROVED" },
    });
    await logAudit({ userId: user.id, action: "APPROVE_PAYROLL", entity: "Payroll", details: `Duyệt bảng lương T${body.month}/${body.year}` });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "PAY_ALL") {
    const approved = await prisma.payroll.findMany({
      where: { month: body.month, year: body.year, status: "APPROVED" },
    });
    const totalPay = approved.reduce((s, p) => s + p.netSalary, 0);
    await prisma.payroll.updateMany({
      where: { month: body.month, year: body.year, status: "APPROVED" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (totalPay > 0) {
      const cat = await prisma.category.findUnique({ where: { code: "EXP_SALARY" } });
      if (cat) {
        await prisma.transaction.create({
          data: {
            code: generateCode("TC"),
            type: "EXPENSE",
            title: `Chi trả bảng lương tháng ${body.month}/${body.year}`,
            amount: totalPay,
            categoryId: cat.id,
            departmentId: user.departmentId,
            createdById: user.id,
            reason: `Thanh toán lương cho ${approved.length} nhân sự`,
            approvalStatus: "APPROVED",
            paymentStatus: "PAID",
          },
        });
      }
    }
    return NextResponse.json({ ok: true, totalPay });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
