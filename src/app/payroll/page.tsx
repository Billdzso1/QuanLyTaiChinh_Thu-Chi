"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND } from "@/lib/finance";
import { getStatusLabel } from "@/lib/labels";
import { exportToExcel } from "@/lib/export";
import { buildPayrollPrintHtml, printPayrollHardcopy } from "@/lib/payrollPrint";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";
import { extractTextFromFile, parsePayrollItems } from "@/lib/smartScan";
import { Calculator, Check, ShieldCheck, Wallet, Download, Pencil, Printer, X, Camera, Upload, Eye, FileCheck2 } from "lucide-react";

interface PayrollRow {
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
  grossIncome: number;
  netSalary: number;
  status: string;
  attachmentUrl?: string | null;
  user: {
    employeeCode: string;
    fullName: string;
    role: string;
    position: string;
    department: { name: string };
  };
}

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [month, setMonth] = useState(11);
  const [year] = useState(2026);
  const [msg, setMsg] = useState("");
  const [editRow, setEditRow] = useState<PayrollRow | null>(null);
  const [adjForm, setAdjForm] = useState({ bonus: "0", overtimePay: "0", deduction: "0", note: "" });
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");
  const [directorName, setDirectorName] = useState("Nguyễn Đức Anh");
  const [signedDocUrl, setSignedDocUrl] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; title: string } | null>(null);

  async function loadData(m = month) {
    const res = await fetch(`/api/payroll?scope=all&month=${m}&year=${year}`);
    if (res.ok) {
      const d = await res.json();
      setPayrolls(d.payrolls);
      setSignedDocUrl(d.signedDocUrl || null);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleGenerate() {
    const res = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    if (res.ok) {
      setMsg(`Đã tổng hợp lại bảng lương tháng ${month}/${year} theo doanh số hợp đồng thực tế.`);
      loadData();
    }
  }

  async function handleAction(action: "CHECK_ALL" | "APPROVE_ALL" | "PAY_ALL") {
    const res = await fetch("/api/payroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, month, year }),
    });
    const d = await res.json();
    if (!res.ok) {
      setMsg(d.error || "Không thể thực hiện thao tác");
    } else {
      setMsg("Đã cập nhật trạng thái bảng lương!");
      loadData();
    }
  }

  async function uploadFileToServer(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const d = await res.json();
    return d.url || null;
  }

  async function handleUploadPayrollDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setScanStatus("Đang tải tệp & quét dữ liệu tự động...");
    try {
      const [url, extracted] = await Promise.all([
        uploadFileToServer(file),
        extractTextFromFile(file, (_pct, status) => setScanStatus(status)),
      ]);
      const scannedItems = parsePayrollItems(
        extracted.text,
        extracted.excelRows,
        payrolls.map((p) => ({ employeeCode: p.user.employeeCode, fullName: p.user.fullName }))
      );

      const res = await fetch("/api/payroll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BATCH_SCAN_UPDATE",
          month,
          year,
          attachmentUrl: url || signedDocUrl || "",
          items: scannedItems,
        }),
      });

      if (res.ok) {
        const d = await res.json();
        if (url) setSignedDocUrl(url);
        try {
          localStorage.setItem(
            `ndahome_payroll_scan_${year}_${month}`,
            JSON.stringify({
              fileName: file.name,
              url,
              updatedCount: d.updatedCount || 0,
              scannedAt: new Date().toISOString(),
              items: scannedItems,
            })
          );
        } catch {
          // ignore localStorage quota errors
        }
        await loadData();
        setMsg(
          d.updatedCount > 0
            ? `Đã quét "${file.name}" và tự động cập nhật ${d.updatedCount} nhân sự vào database & lưu cục bộ!`
            : `Đã lưu bản scan/tệp "${file.name}" cho bảng lương tháng ${month}/${year} vào database & lưu cục bộ!`
        );
      }
    } finally {
      setUploadingDoc(false);
      setScanStatus("");
      e.target.value = "";
    }
  }

  async function handleSaveAdjustments(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    const res = await fetch("/api/payroll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_ADJUSTMENTS",
        id: editRow.id,
        bonus: Number(adjForm.bonus) || 0,
        overtimePay: Number(adjForm.overtimePay) || 0,
        deduction: Number(adjForm.deduction) || 0,
        note: adjForm.note,
      }),
    });
    if (res.ok) {
      setEditRow(null);
      setMsg("Đã cập nhật thưởng / tăng ca / khấu trừ!");
      loadData();
    }
  }

  const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0);
  const totalSalesRetained = payrolls
    .filter((p) => p.user.role === "SALES")
    .reduce((s, p) => s + p.companyRetained, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Quản lý Lương & Hoa hồng Sales</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {[8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  Tháng {m}/2026
                </option>
              ))}
            </select>
            <button
              onClick={handleGenerate}
              className="px-3.5 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Calculator className="w-4 h-4" /> Tính lương tự động
            </button>
            <button
              onClick={() => handleAction("CHECK_ALL")}
              className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Kế toán kiểm tra
            </button>
            <button
              onClick={() => handleAction("APPROVE_ALL")}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" /> Giám đốc duyệt
            </button>
            <button
              onClick={() => handleAction("PAY_ALL")}
              className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Wallet className="w-4 h-4" /> Chi trả lương
            </button>
            <button
              onClick={() =>
                exportToExcel(
                  payrolls.map((p) => ({
                    MaNV: p.user.employeeCode,
                    HoTen: p.user.fullName,
                    PhongBan: p.user.department.name,
                    LuongCoBan: p.baseSalary,
                    DoanhSoSales: p.salesRevenue,
                    TyLeHH: `${(p.commissionRate * 100).toFixed(0)}%`,
                    HoaHong: p.commissionAmount,
                    PhuCap: p.allowance,
                    ThucNhan: p.netSalary,
                    CongTyGiuLai: p.companyRetained,
                    TrangThai: p.status,
                  })),
                  `NDAHOME_BangLuong_T${month}_${year}`
                )
              }
              className="px-3 py-2 rounded-lg bg-white border border-neutral-300 text-neutral-700 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={() => setShowPrintPreview(true)}
              disabled={payrolls.length === 0}
              className="px-3.5 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 disabled:opacity-50 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Xuất bảng cứng / PDF
            </button>
          </div>
        </div>

        {msg && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">{msg}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-white to-amber-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Tổng quỹ lương thực nhận ({payrolls.length} NV)</div>
            <div className="text-xl font-bold text-neutral-950 mt-1 tabular-nums">{formatVND(totalNet)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-emerald-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Phần công ty giữ lại từ Sales</div>
            <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">{formatVND(totalSalesRetained)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-sky-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-sky-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Số bảng lương đã lập</div>
            <div className="text-xl font-bold text-sky-700 mt-1">{payrolls.length} nhân sự</div>
          </div>
        </div>

        {/* Scan / Tải tệp Bảng lương đã ký & đóng mộc của tháng */}
        <div className="bg-white rounded-xl border border-neutral-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className={`w-5 h-5 ${signedDocUrl ? "text-emerald-600" : "text-amber-600"}`} />
            <div>
              <div className="text-sm font-semibold text-neutral-900">
                Quét tự động &amp; Lưu trữ Bảng lương (Tháng {month}/{year})
              </div>
              <div className="text-xs text-neutral-500">
                {scanStatus
                  ? scanStatus
                  : signedDocUrl
                    ? "Đã lưu bản scan / tệp bảng lương. Bấm Scan hoặc Tải tệp (Excel/Ảnh/PDF) để tự động quét & cập nhật dữ liệu."
                    : "Bấm Scan hình ảnh hoặc Tải tệp để hệ thống tự động quét thông tin, cập nhật database & lưu cục bộ."}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {signedDocUrl && (
              <button
                onClick={() =>
                  setPreviewAttachment({
                    url: signedDocUrl,
                    title: `Bảng lương đã ký & đóng mộc — Tháng ${month}/${year}`,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Xem bản đã lưu
              </button>
            )}
            <label className="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
              <Camera className="w-3.5 h-3.5" />
              {uploadingDoc ? "Đang tải..." : "Scan ảnh (Camera)"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleUploadPayrollDoc}
                className="hidden"
              />
            </label>
            <label className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-700 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {uploadingDoc ? "Đang tải..." : "Tải tệp (Ảnh / PDF)"}
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleUploadPayrollDoc}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3">Phòng ban</th>
                  <th className="px-4 py-3 text-right">Lương cứng</th>
                  <th className="px-4 py-3 text-right">Doanh số Sales</th>
                  <th className="px-4 py-3 text-right">Hoa hồng</th>
                  <th className="px-4 py-3 text-right">Phụ cấp</th>
                  <th className="px-4 py-3 text-right">Thực nhận</th>
                  <th className="px-4 py-3 text-right">CTY giữ lại</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Điều chỉnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {payrolls.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{p.user.fullName}</div>
                      <div className="text-xs text-neutral-400">
                        {p.user.employeeCode} • {p.user.position}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{p.user.department.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatVND(p.baseSalary)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                      {p.user.role === "SALES" ? formatVND(p.salesRevenue) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600 font-medium">
                      {p.user.role === "SALES"
                        ? `${formatVND(p.commissionAmount)} (${(p.commissionRate * 100).toFixed(0)}%)`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatVND(p.allowance)}</td>
                    <td className="px-4 py-3 text-right font-bold text-neutral-900 tabular-nums">
                      {formatVND(p.netSalary)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${p.companyRetained >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                    >
                      {p.user.role === "SALES" ? formatVND(p.companyRetained) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : p.status === "APPROVED"
                            ? "bg-sky-100 text-sky-700"
                            : p.status === "CHECKED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-neutral-100 text-neutral-700"
                          }`}
                      >
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status !== "PAID" && (
                        <button
                          onClick={() => {
                            setEditRow(p);
                            setAdjForm({
                              bonus: String(p.bonus || 0),
                              overtimePay: String(p.overtimePay || 0),
                              deduction: String(p.deduction || 0),
                              note: "",
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-100 hover:bg-amber-100 text-neutral-700 text-xs cursor-pointer"
                          title="Nhập thưởng, tăng ca, khấu trừ"
                        >
                          <Pencil className="w-3 h-3" /> Thưởng/Phạt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {editRow && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-neutral-900">
                Điều chỉnh lương — {editRow.user.fullName}
              </h3>
              <form onSubmit={handleSaveAdjustments} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Thưởng (VNĐ)</label>
                  <input
                    type="number"
                    value={adjForm.bonus}
                    onChange={(e) => setAdjForm({ ...adjForm, bonus: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tiền tăng ca (VNĐ)</label>
                  <input
                    type="number"
                    value={adjForm.overtimePay}
                    onChange={(e) => setAdjForm({ ...adjForm, overtimePay: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Khấu trừ / Phạt (VNĐ)</label>
                  <input
                    type="number"
                    value={adjForm.deduction}
                    onChange={(e) => setAdjForm({ ...adjForm, deduction: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Ghi chú</label>
                  <input
                    value={adjForm.note}
                    onChange={(e) => setAdjForm({ ...adjForm, note: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="VD: Thưởng đạt KPI, đi muộn..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditRow(null)}
                    className="px-4 py-2 rounded-lg border text-sm cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm font-medium cursor-pointer"
                  >
                    Lưu điều chỉnh
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPrintPreview && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Xem trước Bảng lương cứng — Tháng {month}/{year}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Khổ A4 ngang • Có mục Giám đốc ký tên &amp; đóng mộc ở cuối trang • Chọn &quot;Save as PDF&quot; khi in để xuất file PDF
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      printPayrollHardcopy(payrolls, month, year, {
                        preparedBy: preparedBy.trim() || undefined,
                        directorName: directorName.trim() || "Nguyễn Đức Anh",
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> In bảng cứng / Xuất PDF
                  </button>
                  <button
                    onClick={() => setShowPrintPreview(false)}
                    className="p-2 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-600 cursor-pointer"
                    title="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-5 py-3 bg-amber-50/50 border-b border-neutral-200 text-xs">
                <div className="flex items-center gap-2">
                  <label className="font-medium text-neutral-700 whitespace-nowrap">Người lập biểu:</label>
                  <input
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    placeholder="VD: Nguyễn Thị Minh Phương"
                    className="flex-1 border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-medium text-neutral-700 whitespace-nowrap">Giám đốc ký duyệt:</label>
                  <input
                    value={directorName}
                    onChange={(e) => setDirectorName(e.target.value)}
                    placeholder="Nguyễn Đức Anh"
                    className="flex-1 border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-neutral-200 p-4">
                <iframe
                  title="Xem trước bảng lương"
                  srcDoc={buildPayrollPrintHtml(payrolls, month, year, {
                    preparedBy: preparedBy.trim() || undefined,
                    directorName: directorName.trim() || "Nguyễn Đức Anh",
                  })}
                  className="w-full h-[65vh] bg-white rounded-lg shadow border border-neutral-300"
                />
              </div>
            </div>
          </div>
        )}
        <AttachmentPreviewModal
          url={previewAttachment?.url || null}
          title={previewAttachment?.title}
          onClose={() => setPreviewAttachment(null)}
        />
      </div>
    </AppShell>
  );
}
