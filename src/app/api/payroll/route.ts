import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSalesCommission, generateCode } from "@/lib/finance";
import { readContractSplits, allocateContractRevenue } from "@/lib/contractSplits";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissionsServer";

const PAYROLL_DOCS_FILE = path.join(process.cwd(), "data", "payroll-docs.json");

async function getPayrollDocs(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(PAYROLL_DOCS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function setPayrollDoc(key: string, url: string) {
  const docs = await getPayrollDocs();
  docs[key] = url;
  await mkdir(path.dirname(PAYROLL_DOCS_FILE), { recursive: true });
  await writeFile(PAYROLL_DOCS_FILE, JSON.stringify(docs, null, 2), "utf-8");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month")) || 11;
  const year = Number(searchParams.get("year")) || 2026;
  const scope = searchParams.get("scope");
  if (scope === "all") {
    const denied = await requirePermission(user, "payroll", "view");
    if (denied) return denied;
  }

  const canViewAll = scope === "all" && canAccessFinance(user.role as UserRole);
  const where: Record<string, unknown> = { month, year };
  if (!canViewAll) where.userId = user.id;

  const docKey = `${year}_${month}`;
  const [payrolls, docs] = await Promise.all([
    prisma.payroll.findMany({
      where,
      include: {
        user: { select: { id: true, employeeCode: true, fullName: true, role: true, position: true, department: true } },
        details: true,
      },
      orderBy: { user: { employeeCode: "asc" } },
    }),
    getPayrollDocs(),
  ]);

  const history = !canViewAll
    ? await prisma.payroll.findMany({
        where: { userId: user.id },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      })
    : [];

  return NextResponse.json({ payrolls, history, signedDocUrl: docs[docKey] || null });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const denied = await requirePermission(user, "payroll", "create");
  if (denied) return denied;
  if (!user || !canAccessFinance(user.role as UserRole)) {
    return NextResponse.json({ error: "Chỉ Kế toán/Giám đốc được tính bảng lương" }, { status: 403 });
  }

  const { month = 11, year = 2026 } = await request.json();
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  const users = await prisma.user.findMany({ where: { isActive: true } });
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: ["ACTIVE", "FORFEITED"] },
      signedDate: {
        gte: new Date(`${monthStr}-01T00:00:00Z`),
        lt: new Date(month === 12 ? `${year + 1}-01-01T00:00:00Z` : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`),
      },
    },
  });

  const splits = await readContractSplits();
  const salesStats = allocateContractRevenue(contracts, splits);

  const results = [];
  for (const u of users) {
    if (u.role === "SALES") {
      const salesRev = salesStats[u.id]?.revenue || 0;
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
  const denied = await requirePermission(user, "payroll", "edit");
  if (denied) return denied;
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

  if (body.action === "UPLOAD_PAYROLL_DOC") {
    const docKey = `${body.year}_${body.month}`;
    await setPayrollDoc(docKey, body.attachmentUrl || "");
    await logAudit({
      userId: user.id,
      action: "UPLOAD_PAYROLL_DOC",
      entity: "Payroll",
      details: `Tải lên/scan bảng lương đã ký T${body.month}/${body.year}`,
    });
    return NextResponse.json({ signedDocUrl: body.attachmentUrl || null });
  }

  if (body.action === "UPLOAD_ROW_ATTACHMENT") {
    const updated = await prisma.payroll.update({
      where: { id: body.id },
      data: { attachmentUrl: body.attachmentUrl || null } as Record<string, unknown>,
    });
    await logAudit({
      userId: user.id,
      action: "UPLOAD_PAYROLL_ATTACHMENT",
      entity: "Payroll",
      entityId: updated.id,
      details: `Đính kèm chứng từ/scan lương cho ID ${updated.id}`,
    });
    return NextResponse.json({ payroll: updated });
  }

  if (body.action === "BATCH_SCAN_UPDATE") {
    const docKey = `${body.year}_${body.month}`;
    if (body.attachmentUrl) {
      await setPayrollDoc(docKey, body.attachmentUrl);
    }

    const items = Array.isArray(body.items) ? body.items : [];
    let updatedCount = 0;

    if (items.length > 0) {
      const monthPayrolls = await prisma.payroll.findMany({
        where: { month: body.month, year: body.year },
        include: { user: { select: { employeeCode: true, fullName: true } } },
      });

      const norm = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

      for (const item of items) {
        const match = monthPayrolls.find((p) => {
          if (item.employeeCode && norm(p.user.employeeCode) === norm(String(item.employeeCode))) return true;
          if (item.fullName && norm(p.user.fullName) === norm(String(item.fullName))) return true;
          return false;
        });
        if (!match) continue;

        const bonus = item.bonus !== undefined ? Number(item.bonus) : match.bonus;
        const overtimePay = item.overtimePay !== undefined ? Number(item.overtimePay) : match.overtimePay;
        const deduction = item.deduction !== undefined ? Number(item.deduction) : match.deduction;
        const grossIncome = match.baseSalary + match.commissionAmount + match.allowance + bonus + overtimePay;
        const netSalary = Math.max(0, grossIncome - deduction);

        await prisma.payroll.update({
          where: { id: match.id },
          data: {
            bonus,
            overtimePay,
            deduction,
            grossIncome,
            netSalary,
            note: item.note || match.note,
          },
        });
        updatedCount++;
      }
    }

    await logAudit({
      userId: user.id,
      action: "SCAN_UPDATE_PAYROLL",
      entity: "Payroll",
      details: `Quét & cập nhật tự động ${updatedCount} bảng lương T${body.month}/${body.year}`,
    });

    return NextResponse.json({ updatedCount, signedDocUrl: body.attachmentUrl || null });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
