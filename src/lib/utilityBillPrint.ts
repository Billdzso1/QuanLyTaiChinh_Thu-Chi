import { formatVND } from "@/lib/finance";

export interface UtilityBillPrintData {
  monthKey: string;
  roomLabel: string;
  roomRent: number;
  oldElectric: number;
  newElectric: number;
  electricRate: number;
  oldWater: number;
  newWater: number;
  waterRate: number;
  serviceFee: number;
  totalAmount: number;
  isPaid: boolean;
  bankCode?: string;
  accountNo?: string;
  accountName?: string;
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildUtilityBillHtml(data: UtilityBillPrintData): string {
  const elecDiff = Math.max(0, data.newElectric - data.oldElectric);
  const elecCost = elecDiff * data.electricRate;
  const waterDiff = Math.max(0, data.newWater - data.oldWater);
  const waterCost = waterDiff * data.waterRate;

  const bankCode = data.bankCode || "MB";
  const accountNo = data.accountNo || "0984843052";
  const accountName = data.accountName || "CHU TRO NDAHOME";
  const addInfo = `TIEN PHONG ${data.monthKey} ${data.roomLabel}`.slice(0, 50);
  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact2.png?amount=${Math.max(
    0,
    Math.round(data.totalAmount)
  )}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(accountName)}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Phieu_Bao_Tien_Phong_${esc(data.monthKey)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: "Times New Roman", Times, serif; color: #171717; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; background: #fff; }
    .sheet { border: 2px solid #171717; outline: 3px solid #f59e0b; outline-offset: -7px; border-radius: 12px; padding: 24px 26px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin: 0; color: #0a0a0a; }
    .sub { font-size: 12px; color: #525252; margin-top: 2px; }
    .badge { background: #0a0a0a; color: #facc15; padding: 4px 12px; border-radius: 999px; font-weight: bold; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; }
    th, td { border: 1px solid #e5e5e5; padding: 9px 12px; text-align: left; }
    th { background: #fafafa; font-size: 12px; color: #525252; }
    .right { text-align: right; font-weight: bold; }
    .total-row td { background: #fffbeb; font-size: 15px; font-weight: bold; color: #b45309; border-top: 2px solid #f59e0b; }
    .qr-box { display: flex; align-items: center; gap: 18px; border: 1.5px solid #0ea5e9; background: #f0f9ff; border-radius: 10px; padding: 14px 16px; margin-top: 16px; }
    .qr-img { width: 130px; height: 130px; background: #fff; border-radius: 8px; padding: 4px; border: 1px solid #bae6fd; object-fit: contain; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1 class="title">PHIẾU BÁO TIỀN PHÒNG &amp; ĐIỆN NƯỚC</h1>
        <div class="sub">Phòng: <strong>${esc(data.roomLabel)}</strong> • Kỳ thanh toán: <strong>${esc(data.monthKey)}</strong></div>
      </div>
      <div class="badge">${data.isPaid ? "ĐÃ THANH TOÁN" : "CHỜ THANH TOÁN"}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Khoản mục</th>
          <th>Chi tiết chỉ số / Đơn giá</th>
          <th class="right">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1. Tiền thuê phòng tháng ${esc(data.monthKey)}</td>
          <td>Cố định theo hợp đồng</td>
          <td class="right">${formatVND(data.roomRent)}</td>
        </tr>
        <tr>
          <td>2. Tiền điện</td>
          <td>${data.oldElectric} → ${data.newElectric} (${elecDiff} kWh × ${formatVND(data.electricRate)})</td>
          <td class="right">${formatVND(elecCost)}</td>
        </tr>
        <tr>
          <td>3. Tiền nước</td>
          <td>${data.oldWater} → ${data.newWater} (${waterDiff} m³ × ${formatVND(data.waterRate)})</td>
          <td class="right">${formatVND(waterCost)}</td>
        </tr>
        <tr>
          <td>4. Phí dịch vụ / Rác / Wifi</td>
          <td>Trọn gói hàng tháng</td>
          <td class="right">${formatVND(data.serviceFee)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="2">TỔNG CỘNG CẦN THANH TOÁN</td>
          <td class="right">${formatVND(data.totalAmount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="qr-box">
      <img src="${qrUrl}" alt="VietQR" class="qr-img" />
      <div style="font-size:12.5px; line-height:1.6;">
        <div style="font-weight:bold; color:#0369a1; font-size:13.5px; margin-bottom:4px;">QUÉT MÃ VIETQR ĐỂ CHUYỂN KHOẢN NHANH</div>
        <div>Ngân hàng: <strong>${esc(bankCode)}</strong> • STK: <strong>${esc(accountNo)}</strong></div>
        <div>Chủ tài khoản: <strong>${esc(accountName)}</strong></div>
        <div>Số tiền: <strong style="color:#047857;">${formatVND(data.totalAmount)}</strong></div>
        <div>Nội dung CK: <strong>${esc(addInfo)}</strong></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function printUtilityBillPdf(data: UtilityBillPrintData) {
  const html = buildUtilityBillHtml(data);
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
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 3000);
  }, 300);
}
