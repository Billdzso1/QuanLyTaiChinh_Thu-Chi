import { NextResponse } from "next/server";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { readContractSplits, allocateContractRevenue } from "@/lib/contractSplits";
import { getKvJsonWithFallback, setKvJson } from "@/lib/dbStore";

interface KpiPrize {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  bonusAmount: number;
  overtimeAmount: number;
  doubleBaseSalary?: boolean;
  color: string;
}

const KPI_PRIZES: KpiPrize[] = [
  {
    id: "BONUS_100K",
    label: "+100.000 đ Tiền thưởng",
    shortLabel: "+100K",
    description: "Cộng trực tiếp 100.000 đ tiền thưởng vào bảng lương tháng này.",
    bonusAmount: 100_000,
    overtimeAmount: 0,
    color: "#f59e0b",
  },
  {
    id: "BONUS_200K",
    label: "+200.000 đ Tiền thưởng",
    shortLabel: "+200K",
    description: "Cộng trực tiếp 200.000 đ tiền thưởng vào bảng lương tháng này.",
    bonusAmount: 200_000,
    overtimeAmount: 0,
    color: "#10b981",
  },
  {
    id: "BONUS_500K",
    label: "+500.000 đ Tiền thưởng",
    shortLabel: "+500K",
    description: "Cộng trực tiếp 500.000 đ tiền thưởng vào bảng lương tháng này.",
    bonusAmount: 500_000,
    overtimeAmount: 0,
    color: "#0ea5e9",
  },
  {
    id: "BONUS_1000K",
    label: "+1.000.000 đ Siêu Thưởng",
    shortLabel: "+1 Triệu",
    description: "Giải đặc biệt! Cộng ngay 1.000.000 đ vào bảng lương tháng này.",
    bonusAmount: 1_000_000,
    overtimeAmount: 0,
    color: "#ef4444",
  },
  {
    id: "DOUBLE_SALARY",
    label: "Lương cứng x2",
    shortLabel: "Lương x2",
    description: "Nhân đôi lương cơ bản tháng này (cộng thêm 2.000.000 đ vào thưởng).",
    bonusAmount: 0,
    overtimeAmount: 0,
    doubleBaseSalary: true,
    color: "#eab308",
  },
  {
    id: "OT_2H",
    label: "Tăng ca thêm +2h",
    shortLabel: "Tăng ca +2h",
    description: "Ghi nhận thưởng tăng ca +2 giờ (+200.000 đ) vào bảng lương.",
    bonusAmount: 0,
    overtimeAmount: 200_000,
    color: "#8b5cf6",
  },
  {
    id: "PAID_LEAVE_1D",
    label: "1 Ngày nghỉ có lương",
    shortLabel: "Nghỉ 1 ngày",
    description: "Đặc quyền nghỉ phép 1 ngày vẫn hưởng nguyên lương trong tháng.",
    bonusAmount: 0,
    overtimeAmount: 0,
    color: "#14b8a6",
  },
  {
    id: "VIP_300K",
    label: "Thẻ Quà Tặng VIP 300K",
    shortLabel: "VIP +300K",
    description: "Thẻ quà tặng trị giá 300.000 đ được cộng vào thưởng tháng này.",
    bonusAmount: 300_000,
    overtimeAmount: 0,
    color: "#f97316",
  },
];

interface RewardRecord {
  userId: string;
  fullName: string;
  monthKey: string;
  mode: "WHEEL" | "DRAW";
  prize: KpiPrize;
  claimedAt: string;
}

const REWARDS_FILE = path.join(process.cwd(), "data", "kpi-rewards.json");
const REWARDS_KV_KEY = "kpi_rewards";

async function readRewards(): Promise<Record<string, RewardRecord>> {
  return getKvJsonWithFallback<Record<string, RewardRecord>>(REWARDS_KV_KEY, REWARDS_FILE, {});
}

async function saveRewards(data: Record<string, RewardRecord>) {
  await setKvJson(REWARDS_KV_KEY, data);
}

async function getTopSalesInfo(userId: string) {
  const [salesUsers, activeContracts, splits] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SALES", isActive: true },
      select: { id: true, fullName: true, kpiTarget: true },
    }),
    prisma.contract.findMany({
      where: { status: { in: ["ACTIVE", "FORFEITED"] } },
      select: { id: true, salesId: true, companyRevenue: true },
    }),
    readContractSplits(),
  ]);

  const allocated = allocateContractRevenue(activeContracts, splits);

  const ranked = salesUsers
    .map((u) => {
      const revenue = allocated[u.id]?.revenue || 0;
      const target = u.kpiTarget > 0 ? u.kpiTarget : 15_000_000;
      const kpiPercent = Math.round((revenue / target) * 100);
      return { id: u.id, fullName: u.fullName, revenue, kpiPercent };
    })
    .sort((a, b) => b.kpiPercent - a.kpiPercent || b.revenue - a.revenue);

  const top = ranked[0];
  const isTopKpi = Boolean(top && top.id === userId && top.revenue > 0);
  const myRank = ranked.findIndex((r) => r.id === userId) + 1;
  const myRevenue = allocated[userId]?.revenue || 0;

  return { isTopKpi, rank: myRank, revenue: myRevenue };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "SALES") {
    return NextResponse.json({ isTopKpi: false, rewardClaimed: null, prizes: KPI_PRIZES });
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}_${now.getMonth() + 1}`;
  const [topInfo, rewards] = await Promise.all([getTopSalesInfo(user.id), readRewards()]);
  const recordKey = `${monthKey}_${user.id}`;

  return NextResponse.json({
    ...topInfo,
    monthKey,
    rewardClaimed: rewards[recordKey] || null,
    prizes: KPI_PRIZES,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topInfo = await getTopSalesInfo(user.id);
  if (!topInfo.isTopKpi) {
    return NextResponse.json({ error: "Chỉ nhân viên đạt Top 1 KPI Sales mới được nhận thưởng này" }, { status: 403 });
  }

  const body = await request.json();
  const mode: "WHEEL" | "DRAW" = body.mode === "DRAW" ? "DRAW" : "WHEEL";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthKey = `${year}_${month}`;
  const recordKey = `${monthKey}_${user.id}`;

  const rewards = await readRewards();
  if (rewards[recordKey]) {
    return NextResponse.json({ rewardClaimed: rewards[recordKey], alreadyClaimed: true });
  }

  const prizeIndex = Math.floor(Math.random() * KPI_PRIZES.length);
  const prize = KPI_PRIZES[prizeIndex];

  const record: RewardRecord = {
    userId: user.id,
    fullName: user.fullName,
    monthKey,
    mode,
    prize,
    claimedAt: now.toISOString(),
  };
  rewards[recordKey] = record;
  await saveRewards(rewards);

  // Cộng trực tiếp phần thưởng vào bảng lương tháng (nếu có)
  const payroll = await prisma.payroll.findUnique({
    where: { userId_month_year: { userId: user.id, month, year } },
  });
  if (payroll) {
    const extraBonus = prize.doubleBaseSalary ? payroll.baseSalary : prize.bonusAmount;
    const newBonus = payroll.bonus + extraBonus;
    const newOt = payroll.overtimePay + prize.overtimeAmount;
    const newGross = payroll.baseSalary + payroll.commissionAmount + payroll.allowance + newBonus + newOt;
    const newNet = Math.max(0, newGross - payroll.deduction);
    const noteAppend = `[Top 1 KPI: ${prize.label}]`;

    await prisma.payroll.update({
      where: { id: payroll.id },
      data: {
        bonus: newBonus,
        overtimePay: newOt,
        grossIncome: newGross,
        netSalary: newNet,
        note: payroll.note ? `${payroll.note} • ${noteAppend}` : noteAppend,
      },
    });
  }

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: "Top 1 KPI Sales đã nhận thưởng",
        message: `${user.fullName} (Top 1 KPI Sales) vừa ${mode === "WHEEL" ? "quay Vòng quay may mắn" : "bốc thăm"} trúng: ${prize.label}.`,
        type: "SUCCESS",
        link: "/payroll",
      })),
    });
  }

  await logAudit({
    userId: user.id,
    action: "CLAIM_TOP_KPI_REWARD",
    entity: "Payroll",
    details: `${user.fullName} đạt Top 1 KPI Sales và trúng thưởng (${mode}): ${prize.label}`,
  });

  return NextResponse.json({ rewardClaimed: record, prizeIndex });
}
