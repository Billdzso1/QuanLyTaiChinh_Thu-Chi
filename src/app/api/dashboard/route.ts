import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readContractSplits, allocateContractRevenue } from "@/lib/contractSplits";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    transactions,
    contracts,
    deposits,
    payrolls,
    budgets,
    budgetRequests,
    approvals,
    projects,
    attendances,
    departments,
    salesUsers,
    splits,
  ] = await Promise.all([
    prisma.transaction.findMany({ include: { department: true, category: true } }),
    prisma.contract.findMany({ include: { sales: true } }),
    prisma.deposit.findMany(),
    prisma.payroll.findMany({ where: { month: 11, year: 2026 } }),
    prisma.departmentBudget.findMany({ include: { department: true } }),
    prisma.budgetRequest.findMany({ where: { status: { in: ["PENDING", "TEAM_CHECKED", "ACCOUNTANT_CHECKED"] } } }),
    prisma.approval.findMany({ where: { status: { in: ["PENDING", "ACCOUNTANT_CHECKED"] } }, include: { createdBy: true } }),
    prisma.project.findMany(),
    prisma.attendance.findMany({ where: { date: "2026-11-19" } }),
    prisma.department.findMany(),
    prisma.user.findMany({
      where: { isActive: true, role: "SALES" },
      select: { id: true, fullName: true, employeeCode: true, position: true, avatar: true, kpiTarget: true },
    }),
    readContractSplits(),
  ]);

  // Tổng thu & tổng chi (chỉ tính các khoản đã duyệt)
  const approvedTx = transactions.filter((t) => t.approvalStatus === "APPROVED");
  const totalRevenue = approvedTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = approvedTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const profit = totalRevenue - totalExpense;

  const paidIncome = approvedTx.filter((t) => t.type === "INCOME" && t.paymentStatus === "PAID").reduce((s, t) => s + t.amount, 0);
  const paidExpense = approvedTx.filter((t) => t.type === "EXPENSE" && t.paymentStatus === "PAID").reduce((s, t) => s + t.amount, 0);
  const cashBalance = paidIncome - paidExpense;

  const totalPayrollPayable = payrolls.filter((p) => p.status !== "PAID").reduce((s, p) => s + p.netSalary, 0);
  const unpaidExpenseDebts = transactions.filter((t) => t.type === "EXPENSE" && t.paymentStatus === "UNPAID");
  const landlordPayableUnpaid = deposits.filter((d) => d.landlordPayoutStatus !== "PAID").reduce((s, d) => s + (d.landlordShare - d.landlordPaidAmount), 0);
  const totalDebt = unpaidExpenseDebts.reduce((s, t) => s + t.amount, 0) + landlordPayableUnpaid;

  const approvedBudget = budgets.reduce((s, b) => s + b.allocatedAmount, 0);
  const usedBudget = budgets.reduce((s, b) => s + b.usedAmount, 0);

  // Biểu đồ doanh thu, chi phí, lợi nhuận theo tháng (T8 - T11)
  const months = ["2026-08", "2026-09", "2026-10", "2026-11"];
  const monthlyChart = months.map((m) => {
    const rev = approvedTx
      .filter((t) => t.type === "INCOME" && t.transactionDate.toISOString().startsWith(m))
      .reduce((s, t) => s + t.amount, 0);
    const exp = approvedTx
      .filter((t) => t.type === "EXPENSE" && t.transactionDate.toISOString().startsWith(m))
      .reduce((s, t) => s + t.amount, 0);
    return {
      month: `T${m.slice(5)}/${m.slice(0, 4)}`,
      revenue: rev,
      expense: exp,
      profit: rev - exp,
    };
  });

  // Tỷ trọng chi phí theo phòng ban
  const expenseByDept = departments
    .map((d) => ({
      name: d.name.replace("Phòng ", "").replace("Ban ", ""),
      value: approvedTx
        .filter((t) => t.type === "EXPENSE" && t.departmentId === d.id)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .filter((d) => d.value > 0);

  // Doanh thu theo hợp đồng 6 tháng vs 12 tháng
  const rev6m = contracts.filter((c) => c.durationMonths === 6).reduce((s, c) => s + c.companyRevenue, 0);
  const rev12m = contracts.filter((c) => c.durationMonths === 12).reduce((s, c) => s + c.companyRevenue, 0);
  const contractDurationChart = [
    { name: "Hợp đồng 6 tháng (50%)", revenue: rev6m, count: contracts.filter((c) => c.durationMonths === 6).length },
    { name: "Hợp đồng 12 tháng (70-100%)", revenue: rev12m, count: contracts.filter((c) => c.durationMonths === 12).length },
  ];

  // Doanh số nhân viên Sales (chỉ tính hợp đồng Đã thuê ACTIVE & áp dụng chia 50/50 Online-Offline)
  const activeContracts = contracts.filter((c) => c.status === "ACTIVE" || c.status === "FORFEITED");
  const allocatedStats = allocateContractRevenue(activeContracts, splits);
  const salesUserMap = new Map(salesUsers.map((u) => [u.id, u]));

  const salesChart = Object.entries(allocatedStats)
    .map(([uid, stat]) => {
      const su = salesUserMap.get(uid);
      const fallbackName = contracts.find((c) => c.salesId === uid)?.sales?.fullName || "Nhân viên Sales";
      return {
        name: su?.fullName || fallbackName,
        revenue: stat.revenue,
        contracts: stat.contractCount,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Top 3 nhân viên đạt KPI cao nhất công ty
  const topKpi = salesUsers
    .map((u) => {
      const stat = allocatedStats[u.id];
      const revenue = stat?.revenue || 0;
      const contractCount = stat?.contractCount || 0;
      const kpiTarget = u.kpiTarget > 0 ? u.kpiTarget : 15_000_000;
      const kpiPercent = Math.round((revenue / kpiTarget) * 100);
      return {
        id: u.id,
        fullName: u.fullName,
        employeeCode: u.employeeCode,
        position: u.position,
        avatar: u.avatar,
        revenue,
        contractCount,
        kpiTarget,
        kpiPercent,
      };
    })
    .filter((m) => m.revenue > 0)
    .sort((a, b) => b.kpiPercent - a.kpiPercent || b.revenue - a.revenue)
    .slice(0, 3);

  // Thông tin cần chú ý
  const alerts = {
    pendingApprovals: approvals.length + budgetRequests.length,
    pendingProjects: projects.filter((p) => p.status === "PENDING_APPROVAL").length,
    overBudgetCount: budgets.filter((b) => b.usedAmount > b.allocatedAmount || b.status === "EXCEEDED").length,
    unpaidDebtsCount: unpaidExpenseDebts.length + deposits.filter((d) => d.landlordPayoutStatus !== "PAID").length,
    unapprovedPayrolls: payrolls.filter((p) => p.status === "DRAFT" || p.status === "CHECKED").length,
    lateAttendanceToday: attendances.filter((a) => a.status === "LATE").length,
  };

  const isSalesRole = user.role === "SALES";

  return NextResponse.json({
    hideCompanyRevenue: isSalesRole,
    kpis: isSalesRole
      ? {
          totalRevenue: 0,
          totalExpense: 0,
          profit: 0,
          cashBalance: 0,
          totalPayrollPayable: 0,
          totalDebt: 0,
          approvedBudget: 0,
          usedBudget: 0,
        }
      : {
          totalRevenue,
          totalExpense,
          profit,
          cashBalance,
          totalPayrollPayable,
          totalDebt,
          approvedBudget,
          usedBudget,
        },
    charts: isSalesRole
      ? {
          monthlyChart: [],
          expenseByDept: [],
          contractDurationChart: [],
          salesChart: salesChart.filter((s) => s.name === user.fullName),
        }
      : {
          monthlyChart,
          expenseByDept,
          contractDurationChart,
          salesChart,
        },
    topKpi: isSalesRole
      ? topKpi.map((m) => ({ ...m, revenue: m.id === user.id ? m.revenue : 0 }))
      : topKpi,
    alerts,
    pendingApprovalsList: isSalesRole ? [] : approvals.slice(0, 5),
    overBudgetList: isSalesRole
      ? []
      : budgets.filter((b) => b.usedAmount > b.allocatedAmount || b.status === "EXCEEDED"),
  });
}
