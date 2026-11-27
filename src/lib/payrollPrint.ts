import { formatVND } from "@/lib/finance";
import { getStatusLabel } from "@/lib/labels";

export interface PrintablePayrollRow {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  salesRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  companyRetained: number;
  allowance: number;
  bonus: number;
  overtimePay: number;
  deduction: number;
  netSalary: number;
  status: string;
  user: {
    employeeCode: string;
    fullName: string;
    role: string;
    position: string;
    department: { name: string };
  };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildPayrollPrintHtml(
  payrolls: PrintablePayrollRow[],
  month: number,
  year: number,
  options?: { preparedBy?: string; directorName?: string; printDate?: Date }
): string {
  const now = options?.printDate ?? new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const curMonth = String(now.getMonth() + 1).padStart(2, "0");
  const curYear = now.getFullYear();

  const totalBase = payrolls.reduce((s, p) => s + p.baseSalary, 0);
  const totalSales = payrolls.reduce((s, p) => s + (p.user.role === "SALES" ? p.salesRevenue : 0), 0);
  const totalCommission = payrolls.reduce((s, p) => s + (p.user.role === "SALES" ? p.commissionAmount : 0), 0);
  const totalAllowance = payrolls.reduce((s, p) => s + p.allowance, 0);
  const totalBonusOt = payrolls.reduce((s, p) => s + (p.bonus || 0) + (p.overtimePay || 0), 0);
  const totalDeduction = payrolls.reduce((s, p) => s + (p.deduction || 0), 0);
  const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0);

  const rowsHtml = payrolls
    .map((p, idx) => {
      const bonusOt = (p.bonus || 0) + (p.overtimePay || 0);
      const isSales = p.user.role === "SALES";
      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center">${escapeHtml(p.user.employeeCode)}</td>
          <td>
            <div class="emp-name">${escapeHtml(p.user.fullName)}</div>
            <div class="emp-pos">${escapeHtml(p.user.position)}</div>
          </td>
          <td>${escapeHtml(p.user.department.name)}</td>
          <td class="num">${formatVND(p.baseSalary)}</td>
          <td class="num">${isSales ? formatVND(p.salesRevenue) : "—"}</td>
          <td class="num">${isSales ? `${formatVND(p.commissionAmount)} (${(p.commissionRate * 100).toFixed(0)}%)` : "—"}</td>
          <td class="num">${formatVND(p.allowance)}</td>
          <td class="num">${bonusOt > 0 ? formatVND(bonusOt) : "—"}</td>
          <td class="num">${p.deduction > 0 ? formatVND(p.deduction) : "—"}</td>
          <td class="num bold">${formatVND(p.netSalary)}</td>
          <td class="center">${escapeHtml(getStatusLabel(p.status))}</td>
          <td class="sign-cell"></td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Bang_Luong_NDAHOME_T${month}_${year}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 12mm 14mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      color: #111;
      margin: 0;
      padding: 0;
      font-size: 11.5px;
      line-height: 1.35;
      background: #fff;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .company-name {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .company-sub {
      font-size: 10.5px;
      color: #333;
      margin-top: 2px;
    }
    .doc-meta {
      text-align: right;
      font-size: 10.5px;
    }
    .doc-title {
      text-align: center;
      margin: 10px 0 4px;
      font-size: 17px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-period {
      text-align: center;
      font-size: 12px;
      font-style: italic;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    th, td {
      border: 1px solid #333;
      padding: 5px 6px;
      vertical-align: middle;
    }
    th {
      background: #f3f0e6;
      font-weight: bold;
      text-align: center;
      font-size: 10.5px;
      text-transform: uppercase;
    }
    td.center { text-align: center; }
    td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    td.bold { font-weight: bold; }
    td.sign-cell { min-width: 68px; }
    .emp-name { font-weight: bold; }
    .emp-pos { font-size: 10px; color: #444; }
    tr.total-row td {
      background: #faf6eb;
      font-weight: bold;
      font-size: 11.5px;
    }
    .summary-line {
      margin: 6px 0 14px;
      font-size: 12px;
    }
    .date-line {
      text-align: right;
      font-style: italic;
      margin-bottom: 10px;
      padding-right: 24px;
      font-size: 11.5px;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      text-align: center;
      page-break-inside: avoid;
      margin-top: 6px;
    }
    .sig-box {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .sig-title {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11.5px;
    }
    .sig-note {
      font-style: italic;
      font-size: 10.5px;
      color: #333;
      margin-top: 2px;
    }
    .sig-space {
      height: 92px;
      width: 100%;
    }
    .sig-stamp-hint {
      height: 92px;
      width: 170px;
      margin: 6px auto 4px;
      border: 1px dashed #999;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-style: italic;
      color: #777;
    }
    .sig-name {
      font-weight: bold;
      font-size: 11.5px;
    }
    @media print {
      .sig-stamp-hint {
        border-color: #bbb;
        color: #999;
      }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <div class="company-name">CÔNG TY TNHH NDAHOME</div>
      <div class="company-sub">Tòa nhà More Building, Số 36 Mạc Đĩnh Chi, Phường Tân Định, TP.HCM</div>
      <div class="company-sub">ĐT: 098.48.43.052 • Email: contact@ndahome.com</div>
    </div>
    <div class="doc-meta">
      <div><strong>Mẫu số:</strong> BL-NDA-${year}${String(month).padStart(2, "0")}</div>
      <div><strong>Đơn vị tính:</strong> VNĐ</div>
    </div>
  </div>

  <div class="doc-title">BẢNG THANH TOÁN LƯƠNG &amp; HOA HỒNG NHÂN VIÊN</div>
  <div class="doc-period">Kỳ lương: Tháng ${month} năm ${year} • Tổng nhân sự: ${payrolls.length} người</div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">STT</th>
        <th style="width: 68px;">Mã NV</th>
        <th>Họ và tên / Chức vụ</th>
        <th>Phòng ban</th>
        <th>Lương cứng</th>
        <th>Doanh số Sales</th>
        <th>Hoa hồng</th>
        <th>Phụ cấp</th>
        <th>Thưởng / TC</th>
        <th>Khấu trừ</th>
        <th>Thực nhận</th>
        <th style="width: 78px;">Trạng thái</th>
        <th style="width: 72px;">Ký nhận</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td colspan="4" class="center">TỔNG CỘNG (${payrolls.length} NHÂN SỰ)</td>
        <td class="num">${formatVND(totalBase)}</td>
        <td class="num">${formatVND(totalSales)}</td>
        <td class="num">${formatVND(totalCommission)}</td>
        <td class="num">${formatVND(totalAllowance)}</td>
        <td class="num">${formatVND(totalBonusOt)}</td>
        <td class="num">${formatVND(totalDeduction)}</td>
        <td class="num">${formatVND(totalNet)}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>

  <div class="summary-line">
    <strong>Tổng quỹ lương thực chi:</strong> ${formatVND(totalNet)}
  </div>

  <div class="date-line">
    TP. Hồ Chí Minh, ngày ${day} tháng ${curMonth} năm ${curYear}
  </div>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-title">Người lập biểu</div>
      <div class="sig-note">(Ký, ghi rõ họ tên)</div>
      <div class="sig-space"></div>
      <div class="sig-name">${escapeHtml(options?.preparedBy || "")}</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">Kế toán trưởng</div>
      <div class="sig-note">(Ký, ghi rõ họ tên)</div>
      <div class="sig-space"></div>
      <div class="sig-name"></div>
    </div>
    <div class="sig-box">
      <div class="sig-title">Giám đốc</div>
      <div class="sig-note">(Ký tên và đóng dấu / đóng mộc)</div>
      <div class="sig-stamp-hint">Ký tên &amp; Đóng mộc</div>
      <div class="sig-name">${escapeHtml(options?.directorName || "Nguyễn Đức Anh")}</div>
    </div>
  </div>
</body>
</html>`;
}

export function printPayrollHardcopy(
  payrolls: PrintablePayrollRow[],
  month: number,
  year: number,
  options?: { preparedBy?: string; directorName?: string }
) {
  const html = buildPayrollPrintHtml(payrolls, month, year, options);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 250);
}
