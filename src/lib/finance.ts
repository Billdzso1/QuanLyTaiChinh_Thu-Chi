export interface CommissionResult {
  baseSalary: number;
  rate: number;
  tierLabel: string;
  commissionAmount: number;
  grossIncome: number;
  companyRetained: number;
}

/**
 * Công thức tính hoa hồng Sales NDAHOME (Mục VI.1):
 * - Dưới 6 triệu: 2.000.000đ + 40% doanh số
 * - 6 – 12 triệu: 2.000.000đ + 45% doanh số
 * - 12 – 20 triệu: 2.000.000đ + 50% doanh số
 * - Trên 20 triệu: 2.000.000đ + 60% doanh số
 * Phần công ty giữ lại = doanh số - tổng thu nhập của Sales
 */
export function calculateSalesCommission(revenue: number): CommissionResult {
  const baseSalary = 2_000_000;
  let rate = 0.4;
  let tierLabel = "Dưới 6 triệu (40%)";

  if (revenue > 20_000_000) {
    rate = 0.6;
    tierLabel = "Trên 20 triệu (60%)";
  } else if (revenue >= 12_000_000) {
    rate = 0.5;
    tierLabel = "12 – 20 triệu (50%)";
  } else if (revenue >= 6_000_000) {
    rate = 0.45;
    tierLabel = "6 – 12 triệu (45%)";
  }

  const commissionAmount = Math.round(revenue * rate);
  const grossIncome = baseSalary + commissionAmount;
  const companyRetained = revenue - grossIncome;

  return {
    baseSalary,
    rate,
    tierLabel,
    commissionAmount,
    grossIncome,
    companyRetained,
  };
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatShortVND(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)} tỷ`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} tr`;
  }
  return formatVND(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN");
}

export function generateCode(prefix: string): string {
  const now = new Date();
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${rand}`;
}
