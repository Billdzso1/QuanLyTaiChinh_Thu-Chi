"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TopKpiPodium, TopKpiMember } from "@/components/TopKpiPodium";
import { formatVND, formatShortVND } from "@/lib/finance";
import { exportToExcel } from "@/lib/export";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BadgeDollarSign,
  AlertTriangle,
  PiggyBank,
  Download,
  Printer,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardData {
  hideCompanyRevenue?: boolean;
  kpis: {
    totalRevenue: number;
    totalExpense: number;
    profit: number;
    cashBalance: number;
    totalPayrollPayable: number;
    totalDebt: number;
    approvedBudget: number;
    usedBudget: number;
  };
  charts: {
    monthlyChart: { month: string; revenue: number; expense: number; profit: number }[];
    expenseByDept: { name: string; value: number }[];
    contractDurationChart: { name: string; revenue: number; count: number }[];
    salesChart: { name: string; revenue: number; contracts: number }[];
  };
  topKpi?: TopKpiMember[];
  alerts: {
    pendingApprovals: number;
    pendingProjects: number;
    overBudgetCount: number;
    unpaidDebtsCount: number;
    unapprovedPayrolls: number;
    lateAttendanceToday: number;
  };
}

const PIE_COLORS = ["#d97706", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        const role = me?.user?.role || "";
        setUserRole(role);
        if (role && role !== "ADMIN" && role !== "ACCOUNTANT") {
          const homeByRole: Record<string, string> = {
            SALES: "/sales",
            IT: "/it",
            MARKETING: "/marketing",
            LANDLORD: "/landlord",
          };
          router.replace(homeByRole[role] || "/attendance");
          return;
        }
        return fetch("/api/dashboard")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            setData(d);
            setLoading(false);
          });
      })
      .catch(() => setLoading(false));
  }, [router]);

  const canExport = userRole === "ADMIN" || userRole === "ACCOUNTANT";

  function handleExportExcel() {
    if (!data) return;
    exportToExcel(
      data.charts.monthlyChart.map((m) => ({
        Thang: m.month,
        DoanhThu: m.revenue,
        ChiPhi: m.expense,
        LoiNhuan: m.profit,
      })),
      "NDAHOME_BaoCao_TaiChinh",
      "TaiChinh"
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 nda-page-enter">
        {/* Executive Hero Header */}
        <div className="relative overflow-hidden rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-6 sm:p-7 text-white shadow-xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 20%, rgba(56,189,248,0.38), transparent 45%), radial-gradient(circle at 15% 85%, rgba(99,102,241,0.35), transparent 45%)",
            }}
          />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-300 mb-1">
                NDAHOME Executive Intelligence
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-sky-100 to-cyan-300 bg-clip-text text-transparent">
                Dashboard Tổng quan NDAHOME
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Theo dõi doanh thu, chi phí, lợi nhuận, ngân sách, bảng vàng KPI và các đầu việc cần phê duyệt
              </p>
            </div>
            {canExport && (
              <div className="flex items-center gap-2 no-print shrink-0">
                <button
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold backdrop-blur-md transition cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Xuất Excel
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold backdrop-blur-md transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> In / Xuất PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {loading || !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white border border-neutral-200 animate-pulse p-5" />
            ))}
          </div>
        ) : (
          <>
            {/* 8 KPI Cards (ẩn doanh thu/tài chính công ty đối với Sales) */}
            {!data.hideCompanyRevenue && userRole !== "SALES" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="Tổng doanh thu"
                  value={formatVND(data.kpis.totalRevenue)}
                  icon={<TrendingUp className="w-5 h-5 text-emerald-700" />}
                  bg="bg-emerald-100"
                  accent="border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/70"
                  highlight="text-emerald-700"
                />
                <KpiCard
                  title="Tổng chi phí"
                  value={formatVND(data.kpis.totalExpense)}
                  icon={<TrendingDown className="w-5 h-5 text-rose-700" />}
                  bg="bg-rose-100"
                  accent="border-l-4 border-l-rose-500 bg-gradient-to-br from-white to-rose-50/70"
                  highlight="text-rose-700"
                />
                <KpiCard
                  title="Lợi nhuận ròng"
                  value={formatVND(data.kpis.profit)}
                  icon={<BadgeDollarSign className="w-5 h-5 text-amber-700" />}
                  bg="bg-amber-100"
                  accent="border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/80"
                  highlight={data.kpis.profit >= 0 ? "text-amber-700" : "text-rose-700"}
                />
                <KpiCard
                  title="Số dư tiền thực tế"
                  value={formatVND(data.kpis.cashBalance)}
                  icon={<Wallet className="w-5 h-5 text-sky-700" />}
                  bg="bg-sky-100"
                  accent="border-l-4 border-l-sky-500 bg-gradient-to-br from-white to-sky-50/70"
                  highlight="text-sky-700"
                />
                <KpiCard
                  title="Lương phải trả (T11)"
                  value={formatVND(data.kpis.totalPayrollPayable)}
                  icon={<BadgeDollarSign className="w-5 h-5 text-yellow-700" />}
                  bg="bg-yellow-100"
                  accent="border-l-4 border-l-yellow-500 bg-gradient-to-br from-white to-yellow-50/70"
                  highlight="text-yellow-800"
                />
                <KpiCard
                  title="Công nợ & Phải trả chủ trọ"
                  value={formatVND(data.kpis.totalDebt)}
                  icon={<AlertTriangle className="w-5 h-5 text-orange-700" />}
                  bg="bg-orange-100"
                  accent="border-l-4 border-l-orange-500 bg-gradient-to-br from-white to-orange-50/70"
                  highlight="text-orange-700"
                />
                <KpiCard
                  title="Ngân sách đã duyệt"
                  value={formatVND(data.kpis.approvedBudget)}
                  icon={<PiggyBank className="w-5 h-5 text-violet-700" />}
                  bg="bg-violet-100"
                  accent="border-l-4 border-l-violet-500 bg-gradient-to-br from-white to-violet-50/70"
                  highlight="text-violet-700"
                />
                <KpiCard
                  title="Ngân sách đã sử dụng"
                  value={formatVND(data.kpis.usedBudget)}
                  icon={<PiggyBank className="w-5 h-5 text-teal-700" />}
                  bg="bg-teal-100"
                  accent="border-l-4 border-l-teal-500 bg-gradient-to-br from-white to-teal-50/70"
                  highlight="text-teal-700"
                />
              </div>
            )}

            {/* Bảng vàng Top 3 KPI toàn công ty + hiệu ứng pháo hoa */}
            {data.topKpi && data.topKpi.length > 0 && <TopKpiPodium topKpi={data.topKpi} />}

            {/* Thông tin cần chú ý */}
            <div className="bg-white rounded-xl border border-neutral-200 p-5">
              <h2 className="text-base font-semibold text-neutral-900 mb-3">Thông tin cần chú ý</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <AlertTile label="Đề xuất chờ duyệt" count={data.alerts.pendingApprovals} href="/approvals" color="amber" />
                {!data.hideCompanyRevenue && userRole !== "SALES" && (
                  <>
                    <AlertTile label="Dự án cần duyệt" count={data.alerts.pendingProjects} href="/it" color="violet" />
                    <AlertTile label="Vượt ngân sách" count={data.alerts.overBudgetCount} href="/budgets" color="rose" />
                    <AlertTile label="Công nợ chưa trả" count={data.alerts.unpaidDebtsCount} href="/finance" color="orange" />
                    <AlertTile label="Bảng lương chưa duyệt" count={data.alerts.unapprovedPayrolls} href="/payroll" color="sky" />
                  </>
                )}
                <AlertTile label="Đi muộn gần nhất" count={data.alerts.lateAttendanceToday} href="/attendance" color="emerald" />
              </div>
            </div>

            {/* Charts Row 1 (ẩn biểu đồ tài chính công ty đối với Sales) */}
            {!data.hideCompanyRevenue && userRole !== "SALES" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5">
                <h3 className="text-base font-semibold text-neutral-900 mb-4">
                  Doanh thu, Chi phí & Lợi nhuận theo tháng
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.monthlyChart} accessibilityLayer={false}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => formatShortVND(Number(v))} tick={{ fontSize: 12 }} />
                      <Tooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.92)",
                          border: "none",
                          borderRadius: "8px",
                          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
                          fontFamily: '"Segoe UI", Inter, system-ui, sans-serif',
                        }}
                        formatter={(v) => formatVND(Number(v))}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="Doanh thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Chi phí" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Lợi nhuận" fill="#d97706" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-neutral-200 p-5">
                <h3 className="text-base font-semibold text-neutral-900 mb-4">
                  Tỷ trọng chi phí phòng ban
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart accessibilityLayer={false}>
                      <Pie
                        data={data.charts.expenseByDept}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {data.charts.expenseByDept.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.92)",
                          border: "none",
                          borderRadius: "8px",
                          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
                          fontFamily: '"Segoe UI", Inter, system-ui, sans-serif',
                        }}
                        formatter={(v) => formatVND(Number(v))}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-neutral-200 p-5">
                <h3 className="text-base font-semibold text-neutral-900 mb-4">
                  Doanh thu theo loại hợp đồng (6 tháng vs 12 tháng)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.contractDurationChart} accessibilityLayer={false}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => formatShortVND(Number(v))} tick={{ fontSize: 12 }} />
                      <Tooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.92)",
                          border: "none",
                          borderRadius: "8px",
                          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
                          fontFamily: '"Segoe UI", Inter, system-ui, sans-serif',
                        }}
                        formatter={(v) => formatVND(Number(v))}
                      />
                      <Bar dataKey="revenue" name="Doanh thu công ty" fill="#171717" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-neutral-200 p-5">
                <h3 className="text-base font-semibold text-neutral-900 mb-4">
                  Doanh số nhân viên Sales
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.salesChart} layout="vertical" accessibilityLayer={false}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(v) => formatShortVND(Number(v))} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                      <Tooltip
                        cursor={false}
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.92)",
                          border: "none",
                          borderRadius: "8px",
                          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
                          fontFamily: '"Segoe UI", Inter, system-ui, sans-serif',
                        }}
                        formatter={(v) => formatVND(Number(v))}
                      />
                      <Bar dataKey="revenue" name="Doanh số" fill="#eab308" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
              </>
            )}

            {/* Quick Personal Bar */}
            <div className="bg-neutral-950 text-white border border-amber-500/40 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-400" />
                <div>
                  <div className="font-semibold">Thao tác nhanh hàng ngày</div>
                  <div className="text-xs text-neutral-300">
                    Chấm công vào/ra, xem phiếu lương cá nhân hoặc gửi đề xuất chi phí/ngân sách
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/attendance"
                  className="px-3.5 py-2 rounded-lg bg-white text-neutral-950 text-xs font-semibold hover:bg-amber-50 inline-flex items-center gap-1"
                >
                  Chấm công ngay <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/profile"
                  className="px-3.5 py-2 rounded-lg bg-neutral-800 text-amber-400 text-xs font-semibold hover:bg-amber-700"
                >
                  Lương cá nhân
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function KpiCard({
  title,
  value,
  icon,
  bg,
  accent = "border-l-4 border-l-amber-500 bg-white",
  highlight = "text-neutral-900",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
  accent?: string;
  highlight?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200/90 p-5 flex items-start justify-between cursor-default shadow-xs transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl active:translate-y-0 ${accent}`}
    >
      <div>
        <div className="text-xs font-medium text-neutral-600">{title}</div>
        <div className={`text-xl font-extrabold mt-1.5 tabular-nums ${highlight}`}>{value}</div>
      </div>
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0 shadow-xs`}>{icon}</div>
    </div>
  );
}

function AlertTile({
  label,
  count,
  href,
  color,
}: {
  label: string;
  count: number;
  href: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    amber: "bg-amber-50 text-amber-800 border-amber-300",
    violet: "bg-violet-50 text-violet-800 border-violet-300",
    rose: "bg-rose-50 text-rose-800 border-rose-300",
    orange: "bg-orange-50 text-orange-800 border-orange-300",
    sky: "bg-sky-50 text-sky-800 border-sky-300",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-300",
  };
  return (
    <Link
      href={href}
      className={`p-3.5 rounded-xl border ${colorMap[color] || colorMap.amber} transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0`}
    >
      <div className="text-2xl font-bold tabular-nums">{count}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </Link>
  );
}
