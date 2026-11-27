"use client";

import React, { useEffect, useState } from "react";
import type { CurrentUser } from "@/components/AppShell";
import { formatVND, formatDate } from "@/lib/finance";
import { getStatusLabel } from "@/lib/labels";
import { Plus, Check, ShieldCheck, XCircle, X, AlertTriangle, Pencil, Trash2 } from "lucide-react";

interface BudgetReq {
  id: string;
  code: string;
  departmentId: string;
  title: string;
  amount: number;
  reason: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  department: { id: string; name: string };
  createdBy: { fullName: string };
}

interface SourceTx {
  id: string;
  code: string;
  title: string;
  amount: number;
  paymentStatus: string;
  transactionDate: string;
  category?: { name: string };
  createdBy?: { fullName: string };
}

interface DeptBudget {
  id: string;
  departmentId: string;
  title: string;
  month: number;
  year: number;
  allocatedAmount: number;
  usedAmount: number;
  status: string;
  department: { id: string; name: string };
  expenses?: { id: string; title: string; amount: number; expenseDate: string }[];
  sourceTransactions?: SourceTx[];
}

export function BudgetsPanel() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<BudgetReq[]>([]);
  const [budgets, setBudgets] = useState<DeptBudget[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<DeptBudget | null>(null);
  const [form, setForm] = useState({
    departmentId: "",
    title: "",
    amount: "",
    reason: "",
    periodStart: "2026-12-01",
    periodEnd: "2026-12-31",
  });

  async function loadData() {
    const [meRes, bRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/budgets")]);
    if (meRes.ok) {
      const m = await meRes.json();
      setUser(m.user);
      setForm((f) => ({ ...f, departmentId: f.departmentId || m.user.department.id }));
    }
    if (bRes.ok) {
      const d = await bRes.json();
      setRequests(d.requests);
      setBudgets(d.budgets);
      setDepartments(d.departments);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = editingRequestId
      ? await fetch("/api/budgets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "EDIT", id: editingRequestId, ...form }),
        })
      : await fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
    if (res.ok) {
      setShowModal(false);
      setEditingRequestId(null);
      setForm({ ...form, title: "", amount: "", reason: "" });
      loadData();
    }
  }

  async function handleDeleteRequest(r: BudgetReq) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa đề xuất "${r.title}" (${r.code})?`)) return;
    const res = await fetch(`/api/budgets?id=${r.id}`, { method: "DELETE" });
    if (res.ok) {
      loadData();
    } else {
      const d = await res.json();
      alert(d.error || "Không thể xóa đề xuất");
    }
  }

  async function handleAction(id: string, action: string) {
    await fetch("/api/budgets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    loadData();
  }

  const totalApproved = budgets.reduce((s, b) => s + b.allocatedAmount, 0);
  const totalUsed = budgets.reduce((s, b) => s + b.usedAmount, 0);

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Ngân sách Phòng ban</h1>
            <p className="text-sm text-neutral-500">
              Các phòng ban chủ động đề xuất ngân sách theo nhu cầu thực tế → Kế toán kiểm tra → Giám đốc phê duyệt
            </p>
          </div>
          <button
            onClick={() => {
              setEditingRequestId(null);
              setForm({
                departmentId: user?.department?.id || departments[0]?.id || "",
                title: "",
                amount: "",
                reason: "",
                periodStart: "2026-12-01",
                periodEnd: "2026-12-31",
              });
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Đề xuất ngân sách mới
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-white to-amber-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Tổng ngân sách đã duyệt</div>
            <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">{formatVND(totalApproved)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-violet-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-violet-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Đã sử dụng</div>
            <div className="text-xl font-bold text-violet-700 mt-1 tabular-nums">{formatVND(totalUsed)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-emerald-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Còn lại</div>
            <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
              {formatVND(totalApproved - totalUsed)}
            </div>
          </div>
        </div>

        {/* Active Department Budgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const pct = b.allocatedAmount > 0 ? Math.round((b.usedAmount / b.allocatedAmount) * 100) : 0;
            const exceeded = b.usedAmount > b.allocatedAmount;
            return (
              <div
                key={b.id}
                onClick={() => setSelectedBudget(b)}
                className="bg-white rounded-xl border border-neutral-200 p-5 space-y-3 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-amber-400"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-semibold text-amber-600">{b.department.name}</div>
                    <div className="font-semibold text-neutral-900">{b.title}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      exceeded ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {exceeded ? "Vượt ngân sách" : "Đang hoạt động"}
                  </span>
                </div>
                <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${exceeded ? "bg-rose-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Đã dùng: {formatVND(b.usedAmount)} ({pct}%)</span>
                  <span>Được duyệt: {formatVND(b.allocatedAmount)}</span>
                </div>
                <div className="text-[11px] text-amber-700 font-medium pt-1">
                  Bấm để xem nguồn chi tiết ({b.sourceTransactions?.length || 0} khoản chi) →
                </div>
              </div>
            );
          })}
        </div>

        {/* Budget Requests Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 font-semibold text-sm text-neutral-800">
            Danh sách đề xuất ngân sách
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Mã / Phòng ban</th>
                  <th className="px-4 py-3">Tên đề xuất & Lý do</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-amber-700">{r.code}</div>
                      <div className="text-xs text-neutral-500">{r.department.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{r.title}</div>
                      <div className="text-xs text-neutral-500">{r.reason}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{formatVND(r.amount)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                        {getStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {(user?.role === "ACCOUNTANT" || user?.role === "ADMIN") && r.status === "PENDING" && (
                        <button
                          onClick={() => handleAction(r.id, "ACCOUNTANT_CHECK")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 text-white text-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Kế toán kiểm tra
                        </button>
                      )}
                      {user?.role === "ADMIN" && (r.status === "PENDING" || r.status === "ACCOUNTANT_CHECKED") && (
                        <>
                          <button
                            onClick={() => handleAction(r.id, "APPROVE")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-xs cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Duyệt
                          </button>
                          <button
                            onClick={() => handleAction(r.id, "REJECT")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 text-white text-xs cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Từ chối
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setEditingRequestId(r.id);
                          setForm({
                            departmentId: r.departmentId || r.department?.id || "",
                            title: r.title,
                            amount: String(r.amount),
                            reason: r.reason,
                            periodStart: r.periodStart,
                            periodEnd: r.periodEnd,
                          });
                          setShowModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-100 hover:bg-amber-100 text-neutral-800 text-xs cursor-pointer"
                        title="Sửa đề xuất"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Sửa
                      </button>
                      {(user?.role === "ADMIN" || r.status !== "APPROVED") && (
                        <button
                          onClick={() => handleDeleteRequest(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs cursor-pointer"
                          title="Xóa đề xuất"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold">
                {editingRequestId ? "Chỉnh sửa đề xuất ngân sách" : "Tạo đề xuất ngân sách"}
              </h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Phòng ban</label>
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
                <div>
                  <label className="block text-xs font-medium mb-1">Tên đề xuất</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Số tiền dự kiến (VNĐ)</label>
                  <input
                    type="number"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Lý do sử dụng</label>
                  <textarea
                    required
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg border text-sm cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    {editingRequestId ? "Lưu thay đổi" : "Gửi đề xuất"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Chi tiết nguồn chi của gói ngân sách */}
        {selectedBudget && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedBudget(null)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
                <div>
                  <div className="text-xs font-bold text-amber-600">{selectedBudget.department.name} • Tháng {selectedBudget.month}/{selectedBudget.year}</div>
                  <h3 className="text-lg font-bold text-neutral-950">{selectedBudget.title}</h3>
                </div>
                <button onClick={() => setSelectedBudget(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-amber-700">Ngân sách được duyệt</div>
                  <div className="text-base font-bold text-amber-900 mt-0.5 tabular-nums">
                    {formatVND(selectedBudget.allocatedAmount)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-violet-50 border border-violet-200">
                  <div className="text-violet-700">Tổng đã sử dụng</div>
                  <div className="text-base font-bold text-violet-900 mt-0.5 tabular-nums">
                    {formatVND(selectedBudget.usedAmount)}
                  </div>
                </div>
                <div
                  className={`p-3 rounded-xl border ${
                    selectedBudget.usedAmount > selectedBudget.allocatedAmount
                      ? "bg-rose-50 border-rose-200"
                      : "bg-emerald-50 border-emerald-200"
                  }`}
                >
                  <div className={selectedBudget.usedAmount > selectedBudget.allocatedAmount ? "text-rose-700" : "text-emerald-700"}>
                    {selectedBudget.usedAmount > selectedBudget.allocatedAmount ? "Số tiền vượt ngân sách" : "Còn lại"}
                  </div>
                  <div
                    className={`text-base font-bold mt-0.5 tabular-nums ${
                      selectedBudget.usedAmount > selectedBudget.allocatedAmount ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {selectedBudget.usedAmount > selectedBudget.allocatedAmount
                      ? `+${formatVND(selectedBudget.usedAmount - selectedBudget.allocatedAmount)}`
                      : formatVND(selectedBudget.allocatedAmount - selectedBudget.usedAmount)}
                  </div>
                </div>
              </div>

              {selectedBudget.usedAmount > selectedBudget.allocatedAmount && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-rose-800">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      Đang vượt hạn mức{" "}
                      <strong>{formatVND(selectedBudget.usedAmount - selectedBudget.allocatedAmount)}</strong>. Phòng ban cần tạo đề xuất bổ sung ngân sách để Giám đốc duyệt.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const diff = selectedBudget.usedAmount - selectedBudget.allocatedAmount;
                      setForm({
                        departmentId: selectedBudget.departmentId,
                        title: `Bổ sung ngân sách: ${selectedBudget.title}`,
                        amount: String(diff),
                        reason: `Bổ sung phần chi vượt ngân sách tháng ${selectedBudget.month}/${selectedBudget.year}`,
                        periodStart: `${selectedBudget.year}-${String(selectedBudget.month).padStart(2, "0")}-01`,
                        periodEnd: `${selectedBudget.year}-${String(selectedBudget.month).padStart(2, "0")}-28`,
                      });
                      setSelectedBudget(null);
                      setShowModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    + Đề xuất bổ sung
                  </button>
                </div>
              )}

              <div className="overflow-y-auto flex-1 border border-neutral-200 rounded-xl">
                <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-xs font-bold text-neutral-700">
                  Nguồn chi tiết các khoản chi (từ mục Thu Chi & Công nợ)
                </div>
                {!selectedBudget.sourceTransactions?.length ? (
                  <div className="p-6 text-center text-xs text-neutral-500">
                    Chưa có khoản chi thực tế nào phát sinh trong tháng {selectedBudget.month}/{selectedBudget.year}.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                      <tr>
                        <th className="px-3 py-2.5">Mã / Ngày</th>
                        <th className="px-3 py-2.5">Nội dung khoản chi</th>
                        <th className="px-3 py-2.5">Người tạo</th>
                        <th className="px-3 py-2.5">Thanh toán</th>
                        <th className="px-3 py-2.5 text-right">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {selectedBudget.sourceTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="px-3 py-2.5">
                            <div className="font-mono font-semibold text-neutral-800">{tx.code}</div>
                            <div className="text-neutral-400">{formatDate(tx.transactionDate)}</div>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-neutral-900">{tx.title}</td>
                          <td className="px-3 py-2.5 text-neutral-600">{tx.createdBy?.fullName || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium ${
                                tx.paymentStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {tx.paymentStatus === "PAID" ? "Đã trả" : "Công nợ"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-rose-600 tabular-nums">
                            {formatVND(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    
  );
}

