"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND, formatDate } from "@/lib/finance";
import { exportToExcel } from "@/lib/export";
import { AttachmentPreviewModal, isImageUrl } from "@/components/AttachmentPreviewModal";
import { extractTextFromFile, parseFinanceItems } from "@/lib/smartScan";
import { Plus, Download, CheckCircle2, Search, Upload, Camera, FileText, Eye } from "lucide-react";

interface Transaction {
  id: string;
  code: string;
  type: "INCOME" | "EXPENSE";
  title: string;
  amount: number;
  category: { id: string; name: string };
  department: { id: string; name: string };
  createdBy: { fullName: string };
  reason?: string;
  voucherUrl?: string | null;
  approvalStatus: string;
  paymentStatus: string;
  isDebt: boolean;
  transactionDate: string;
}

export default function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [previewVoucher, setPreviewVoucher] = useState<string | null>(null);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [scanningSmart, setScanningSmart] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  const [form, setForm] = useState({
    type: "EXPENSE",
    title: "",
    amount: "",
    categoryId: "",
    departmentId: "",
    reason: "",
    voucherUrl: "",
    paymentStatus: "PAID",
    isDebt: false,
  });

  async function loadData() {
    const res = await fetch("/api/finance/transactions");
    if (res.ok) {
      const d = await res.json();
      setTransactions(d.transactions);
      setCategories(d.categories);
      setDepartments(d.departments);
      if (d.categories?.length && !form.categoryId) {
        const expCat = d.categories.find((c: { type: string }) => c.type === "EXPENSE");
        setForm((f) => ({
          ...f,
          categoryId: expCat?.id || d.categories[0].id,
          departmentId: d.departments[0]?.id || "",
        }));
      }
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVoucherUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVoucher(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const d = await res.json();
      setForm((f) => ({ ...f, voucherUrl: d.url }));
    }
    setUploadingVoucher(false);
    e.target.value = "";
  }

  async function handleSmartScanFinance(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningSmart(true);
    setScanMsg("Đang tải tệp & quét thông tin tự động...");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const [uploadRes, extracted] = await Promise.all([
        fetch("/api/upload", { method: "POST", body: fd }),
        extractTextFromFile(file, (_pct, status) => setScanMsg(status)),
      ]);
      const voucherUrl = uploadRes.ok ? (await uploadRes.json()).url : "";
      const parsedItems = parseFinanceItems(
        extracted.text,
        extracted.excelRows,
        categories,
        departments,
        file.name
      );

      const validItems = parsedItems.filter((item) => item.amount > 0);
      if (validItems.length > 0) {
        let createdCount = 0;
        for (const item of validItems) {
          const res = await fetch("/api/finance/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...item, voucherUrl }),
          });
          if (res.ok) createdCount++;
        }
        try {
          localStorage.setItem(
            "ndahome_finance_last_scan",
            JSON.stringify({
              fileName: file.name,
              voucherUrl,
              createdCount,
              items: validItems,
              scannedAt: new Date().toISOString(),
            })
          );
        } catch {
          // ignore localStorage quota errors
        }
        await loadData();
        setShowModal(false);
        const first = validItems[0];
        setScanMsg(
          createdCount === 1
            ? `Đã quét "${file.name}" và tự động lưu ${first.type === "INCOME" ? "Khoản Thu" : "Khoản Chi"} "${first.title}" (${formatVND(first.amount)}) vào database & local!`
            : `Đã quét "${file.name}" và tự động lưu ${createdCount} khoản Thu/Chi vào database & local!`
        );
      } else {
        // Fallback: pre-fill modal so user just enters amount
        const first = parsedItems[0];
        setForm((f) => ({
          ...f,
          type: first?.type || "EXPENSE",
          title: first?.title || file.name,
          categoryId: first?.categoryId || f.categoryId,
          departmentId: first?.departmentId || f.departmentId,
          paymentStatus: first?.paymentStatus || "PAID",
          isDebt: first?.isDebt || false,
          reason: first?.reason || "",
          voucherUrl,
        }));
        setShowModal(true);
        setScanMsg(`Đã tải "${file.name}" & điền sẵn thông tin — vui lòng kiểm tra lại số tiền và bấm Lưu.`);
      }
    } finally {
      setScanningSmart(false);
      e.target.value = "";
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/finance/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({ ...form, title: "", amount: "", reason: "", voucherUrl: "" });
      loadData();
    }
  }

  async function markPaid(id: string) {
    await fetch("/api/finance/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, paymentStatus: "PAID", isDebt: false, approvalStatus: "APPROVED" }),
    });
    loadData();
  }

  const baseFiltered = transactions.filter((t) => {
    if (deptFilter !== "ALL" && t.department.id !== deptFilter) return false;
    if (monthFilter !== "ALL" && !t.transactionDate.startsWith(monthFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.code.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.createdBy?.fullName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filtered = baseFiltered.filter((t) => {
    if (filterType === "INCOME" && t.type !== "INCOME") return false;
    if (filterType === "EXPENSE" && t.type !== "EXPENSE") return false;
    if (filterType === "DEBT" && t.paymentStatus !== "UNPAID" && !t.isDebt) return false;
    return true;
  });

  const totalIncome = baseFiltered.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = baseFiltered.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const totalUnpaidDebt = baseFiltered
    .filter((t) => t.type === "EXPENSE" && t.paymentStatus === "UNPAID")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Quản lý Thu Chi & Công nợ</h1>
            <p className="text-sm text-neutral-500">
              Theo dõi doanh thu công ty, các khoản chi theo phòng ban, chứng từ và công nợ chưa thanh toán
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                exportToExcel(
                  filtered.map((t) => ({
                    Ma: t.code,
                    Loai: t.type === "INCOME" ? "Thu" : "Chi",
                    NoiDung: t.title,
                    DanhMuc: t.category.name,
                    PhongBan: t.department.name,
                    SoTien: t.amount,
                    TrangThai: t.paymentStatus,
                    Ngay: formatDate(t.transactionDate),
                  })),
                  "NDAHOME_ThuChi"
                )
              }
              className="px-3.5 py-2 rounded-lg bg-white border border-neutral-300 text-neutral-700 text-sm font-medium inline-flex items-center gap-2 hover:bg-neutral-50 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Xuất Excel
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Ghi nhận Thu / Chi
            </button>
          </div>
        </div>

        {scanMsg && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm">
            {scanMsg}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-white to-emerald-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600 font-medium">Tổng Thu</div>
            <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">{formatVND(totalIncome)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-rose-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-rose-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600 font-medium">Tổng Chi</div>
            <div className="text-xl font-bold text-rose-700 mt-1 tabular-nums">{formatVND(totalExpense)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-orange-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-orange-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600 font-medium">Công nợ chi chưa thanh toán</div>
            <div className="text-xl font-bold text-orange-700 mt-1 tabular-nums">{formatVND(totalUnpaidDebt)}</div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "ALL", label: "Tất cả" },
              { key: "INCOME", label: "Khoản Thu" },
              { key: "EXPENSE", label: "Khoản Chi" },
              { key: "DEBT", label: "Công nợ chưa trả" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${filterType === tab.key
                  ? "bg-neutral-950 text-amber-400 border border-amber-500"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2" />
              <input
                placeholder="Tìm mã, nội dung..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white w-44"
              />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="ALL">Tất cả phòng ban</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="ALL">Tất cả các tháng</option>
              <option value="2026-11">Tháng 11/2026</option>
              <option value="2026-10">Tháng 10/2026</option>
              <option value="2026-09">Tháng 09/2026</option>
              <option value="2026-08">Tháng 08/2026</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Mã / Ngày</th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3">Phòng ban</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Thanh toán</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-neutral-700">{tx.code}</div>
                      <div className="text-xs text-neutral-400">{formatDate(tx.transactionDate)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{tx.title}</div>
                      <div className="text-xs text-neutral-500">Người tạo: {tx.createdBy?.fullName}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{tx.category.name}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{tx.department.name}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${tx.type === "INCOME" ? "text-emerald-600" : "text-rose-600"
                        }`}
                    >
                      {tx.type === "INCOME" ? "+" : "-"}
                      {formatVND(tx.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tx.paymentStatus === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                          }`}
                      >
                        {tx.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1">
                        {tx.voucherUrl && (
                          <button
                            onClick={() => setPreviewVoucher(tx.voucherUrl || null)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium cursor-pointer"
                            title="Xem chứng từ / tệp đính kèm"
                          >
                            <Eye className="w-3.5 h-3.5" /> Chứng từ
                          </button>
                        )}
                        {tx.paymentStatus === "UNPAID" && (
                          <button
                            onClick={() => markPaid(tx.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Thanh toán
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-neutral-900">Ghi nhận khoản Thu / Chi mới</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Loại giao dịch</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="EXPENSE">Khoản Chi</option>
                      <option value="INCOME">Khoản Thu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Số tiền (VNĐ)</label>
                    <input
                      type="number"
                      required
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Tên khoản thu/chi</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="VD: Chi phí chạy Facebook Ads..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Danh mục</label>
                    <select
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {categories
                        .filter((c) => c.type === form.type)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Phòng ban</label>
                    <select
                      value={form.departmentId}
                      onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Trạng thái thanh toán</label>
                  <select
                    value={form.paymentStatus}
                    onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="PAID">Đã thanh toán ngay</option>
                    <option value="UNPAID">Ghi nhận công nợ (Chưa thanh toán)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Hóa đơn / Chứng từ (Tự động quét &amp; thêm vào hệ thống)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-xs font-medium cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      {scanningSmart || uploadingVoucher ? "Đang quét..." : "Scan / Chụp ảnh"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleSmartScanFinance}
                        disabled={scanningSmart || uploadingVoucher}
                        className="hidden"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-xs font-medium cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {scanningSmart || uploadingVoucher ? "Đang quét..." : "Tải tệp (Ảnh / Excel / PDF)"}
                      <input
                        type="file"
                        accept="image/*,.xlsx,.xls,.csv,.pdf,.doc,.docx,.txt"
                        onChange={handleSmartScanFinance}
                        disabled={scanningSmart || uploadingVoucher}
                        className="hidden"
                      />
                    </label>
                    {form.voucherUrl && (
                      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900">
                        {isImageUrl(form.voucherUrl) ? (
                          <img
                            src={form.voucherUrl}
                            alt="Chứng từ"
                            className="w-8 h-8 rounded object-cover border border-amber-400"
                          />
                        ) : (
                          <FileText className="w-4 h-4 text-amber-700" />
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewVoucher(form.voucherUrl)}
                          className="underline font-medium cursor-pointer"
                        >
                          Xem tệp
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-sm cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm font-medium cursor-pointer"
                  >
                    Lưu giao dịch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <AttachmentPreviewModal
          url={previewVoucher}
          title="Chứng từ Thu / Chi & Công nợ"
          onClose={() => setPreviewVoucher(null)}
        />
      </div>
    </AppShell>
  );
}
