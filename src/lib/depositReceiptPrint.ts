import { formatVND, formatDate } from "@/lib/finance";

export interface DepositReceiptData {
  contractCode: string;
  customerName: string;
  customerPhone: string;
  customerIdCard?: string;
  roomLabel: string;
  address: string;
  monthlyRent: number;
  depositAmount: number;
  collectedAmount: number;
  durationMonths: number;
  moveInDate: string;
  salesName: string;
  paymentMethodLabel?: string;
  evidenceUrl?: string;
  note?: string;
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildDepositReceiptHtml(data: DepositReceiptData): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Hoa_Don_Dat_Coc_${esc(data.contractCode)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      color: #171717;
      margin: 0;
      padding: 0;
      background: #fff;
      font-size: 13px;
      line-height: 1.5;
    }
    .sheet {
      border: 2px solid #171717;
      outline: 3px solid #f59e0b;
      outline-offset: -7px;
      border-radius: 10px;
      padding: 26px 28px;
      background: #fff;
      page-break-inside: avoid;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f59e0b;
      padding-bottom: 14px;
      margin-bottom: 18px;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-box {
      width: 50px;
      height: 50px;
      border-radius: 10px;
      background: #0a0a0a;
      border: 2px solid #f59e0b;
      color: #facc15;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
      line-height: 1.1;
      letter-spacing: 0.5px;
      shrink: 0;
    }
    .company-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      color: #0a0a0a;
      letter-spacing: 0.4px;
    }
    .company-info {
      font-size: 11.5px;
      color: #525252;
      margin-top: 2px;
    }
    .receipt-meta {
      text-align: right;
      font-size: 11.5px;
    }
    .badge-doc {
      display: inline-block;
      background: #0a0a0a;
      color: #facc15;
      border: 1px solid #f59e0b;
      padding: 3px 10px;
      border-radius: 999px;
      font-weight: bold;
      font-size: 10.5px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .title-block {
      text-align: center;
      margin: 6px 0 18px;
    }
    .doc-title {
      font-size: 21px;
      font-weight: bold;
      text-transform: uppercase;
      color: #0a0a0a;
      letter-spacing: 0.6px;
      margin: 0;
    }
    .doc-sub {
      display: inline-block;
      margin-top: 5px;
      padding: 3px 14px;
      border-radius: 999px;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      color: #92400e;
      font-size: 12px;
      font-weight: bold;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 16px;
    }
    .info-card {
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 12px 14px;
      background: #fafafa;
    }
    .card-title {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      color: #b45309;
      border-bottom: 1px solid #fde68a;
      padding-bottom: 5px;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .row-item {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 12.5px;
      margin-bottom: 5px;
    }
    .row-label { color: #525252; }
    .row-val { font-weight: bold; color: #111; text-align: right; }
    .amount-box {
      border: 1.5px solid #f59e0b;
      background: #fffbeb;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .amount-left .lbl {
      font-size: 11.5px;
      text-transform: uppercase;
      font-weight: bold;
      color: #92400e;
    }
    .amount-left .sub-lbl {
      font-size: 12px;
      color: #525252;
      margin-top: 2px;
    }
    .amount-right {
      text-align: right;
    }
    .big-money {
      font-size: 22px;
      font-weight: bold;
      color: #b45309;
      line-height: 1.2;
    }
    .paid-pill {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 10px;
      border-radius: 999px;
      background: #d1fae5;
      color: #065f46;
      font-size: 11px;
      font-weight: bold;
    }
    .note-box {
      border: 1px dashed #d4d4d4;
      border-radius: 8px;
      padding: 10px 14px;
      background: #fff;
      font-size: 12px;
      margin-bottom: 14px;
    }
    .terms {
      font-size: 11.5px;
      color: #404040;
      background: #f5f5f5;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .terms ul {
      margin: 4px 0 0 18px;
      padding: 0;
    }
    .terms li { margin-bottom: 2px; }
    .date-line {
      text-align: right;
      font-style: italic;
      font-size: 12px;
      color: #404040;
      margin-bottom: 10px;
    }
    .sigs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      text-align: center;
      page-break-inside: avoid;
    }
    .sig-title {
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12px;
      color: #0a0a0a;
    }
    .sig-note {
      font-style: italic;
      font-size: 11px;
      color: #525252;
    }
    .sig-space { height: 74px; }
    .sig-name {
      font-weight: bold;
      font-size: 12.5px;
      color: #111;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top-bar">
      <div class="brand">
        <div class="logo-box">NDA<br/>HOME</div>
        <div>
          <div class="company-name">CÔNG TY TNHH NDAHOME</div>
          <div class="company-info">Tòa nhà More Building, Số 36 Mạc Đĩnh Chi, P. Tân Định, TP.HCM</div>
          <div class="company-info">Hotline: 098.48.43.052 • Email: contact@ndahome.com</div>
        </div>
      </div>
      <div class="receipt-meta">
        <div class="badge-doc">Phiếu thu đặt cọc</div>
        <div><strong>Mã chứng từ:</strong> ${esc(data.contractCode)}</div>
        <div><strong>Ngày lập:</strong> ${day}/${month}/${year}</div>
      </div>
    </div>

    <div class="title-block">
      <h1 class="doc-title">HÓA ĐƠN XÁC NHẬN ĐẶT CỌC THUÊ PHÒNG</h1>
      <div class="doc-sub">Thời hạn hợp đồng: ${data.durationMonths} tháng • Mã HĐ: ${esc(data.contractCode)}</div>
    </div>

    <div class="two-col">
      <div class="info-card">
        <div class="card-title">1. Thông tin khách hàng đặt cọc</div>
        <div class="row-item">
          <span class="row-label">Họ và tên:</span>
          <span class="row-val">${esc(data.customerName)}</span>
        </div>
        <div class="row-item">
          <span class="row-label">Số điện thoại:</span>
          <span class="row-val">${esc(data.customerPhone)}</span>
        </div>
        <div class="row-item">
          <span class="row-label">Số CCCD / CMND:</span>
          <span class="row-val">${esc(data.customerIdCard || "Chưa cập nhật")}</span>
        </div>
        <div class="row-item">
          <span class="row-label">Ngày dự kiến nhận phòng:</span>
          <span class="row-val">${formatDate(data.moveInDate)}</span>
        </div>
      </div>

      <div class="info-card">
        <div class="card-title">2. Thông tin phòng &amp; phụ trách</div>
        <div class="row-item">
          <span class="row-label">Phòng / Tòa nhà:</span>
          <span class="row-val">${esc(data.roomLabel)}</span>
        </div>
        <div class="row-item">
          <span class="row-label">Địa chỉ:</span>
          <span class="row-val">${esc(data.address || "TP.HCM")}</span>
        </div>
        <div class="row-item">
          <span class="row-label">Giá thuê / tháng:</span>
          <span class="row-val">${formatVND(data.monthlyRent)}</span>
        </div>
        <div class="row-item">
          <span class="row-label">Nhân viên Sales:</span>
          <span class="row-val">${esc(data.salesName)}</span>
        </div>
      </div>
    </div>

    <div class="amount-box">
      <div class="amount-left">
        <div class="lbl">Tổng số tiền đặt cọc giữ phòng</div>
        <div class="sub-lbl">Khoản cọc được đối trừ trực tiếp khi ký hợp đồng thuê chính thức.</div>
        ${
          data.paymentMethodLabel
            ? `<div class="sub-lbl" style="margin-top:4px;color:#111;"><strong>Hình thức thanh toán:</strong> ${esc(data.paymentMethodLabel)}</div>`
            : ""
        }
      </div>
      <div class="amount-right">
        <div class="big-money">${formatVND(data.depositAmount)}</div>
        <div class="paid-pill">Đã thu đủ: ${formatVND(data.collectedAmount)}</div>
      </div>
    </div>

    ${
      data.evidenceUrl
        ? (() => {
            const fullUrl =
              typeof window !== "undefined" && data.evidenceUrl.startsWith("/")
                ? `${window.location.origin}${data.evidenceUrl}`
                : data.evidenceUrl;
            return `<div class="note-box" style="background:#fffbeb;border-color:#f59e0b;">
              <strong>Link minh chứng thanh toán / chuyển khoản:</strong>
              <a href="${esc(fullUrl)}" target="_blank" rel="noreferrer" style="color:#b45309;text-decoration:underline;word-break:break-all;margin-left:4px;">${esc(fullUrl)}</a>
            </div>`;
          })()
        : ""
    }

    ${
      data.note
        ? `<div class="note-box"><strong>Ghi chú / Cam kết thêm:</strong> ${esc(data.note)}</div>`
        : ""
    }

    <div class="terms">
      <strong>Điều khoản xác nhận đặt cọc:</strong>
      <ul>
        <li>NDAHOME cam kết giữ đúng phòng <strong>${esc(data.roomLabel)}</strong> cho khách hàng đến ngày <strong>${formatDate(data.moveInDate)}</strong>.</li>
        <li>Khách hàng thanh toán phần tiền thuê còn lại và ký hợp đồng chính thức tại ngày nhận phòng.</li>
        <li>Phiếu này có giá trị xác nhận giao dịch giữa khách hàng và Công ty TNHH NDAHOME.</li>
      </ul>
    </div>

    <div class="date-line">TP. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}</div>

    <div class="sigs">
      <div>
        <div class="sig-title">Khách hàng</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
        <div class="sig-space"></div>
        <div class="sig-name">${esc(data.customerName)}</div>
      </div>
      <div>
        <div class="sig-title">Nhân viên Sales</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
        <div class="sig-space"></div>
        <div class="sig-name">${esc(data.salesName)}</div>
      </div>
      <div>
        <div class="sig-title">Đại diện Công ty</div>
        <div class="sig-note">(Ký tên &amp; đóng dấu)</div>
        <div class="sig-space"></div>
        <div class="sig-name">CÔNG TY TNHH NDAHOME</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildReceiptFileName(data: DepositReceiptData): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const safeCode = data.contractCode.replace(/[\\/:*?"<>|\s]+/g, "-");
  const safeName = data.customerName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_");
  return `${safeCode}_${safeName}_${dd}-${mm}-${yyyy}`;
}

export function printDepositReceiptPdf(data: DepositReceiptData) {
  const html = buildDepositReceiptHtml(data);
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

  const prevTitle = document.title;
  const pdfTitle = buildReceiptFileName(data);

  const restore = () => {
    document.title = prevTitle;
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
    window.removeEventListener("afterprint", restore);
  };

  setTimeout(() => {
    document.title = pdfTitle;
    window.addEventListener("afterprint", restore);
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(restore, 3000);
  }, 250);
}
