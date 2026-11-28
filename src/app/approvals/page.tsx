"use client";

import React, { useEffect, useState } from "react";
import { AppShell, CurrentUser } from "@/components/AppShell";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";
import { BudgetsPanel } from "@/components/BudgetsPanel";
import { formatVND, formatDate } from "@/lib/finance";
import { getStatusLabel, APPROVAL_TYPE_LABELS } from "@/lib/labels";
import {
  Plus,
  Check,
  ShieldCheck,
  XCircle,
  Wallet,
  Upload,
  Image as ImageIcon,
  Receipt,
  CheckCircle2,
  X,
  PiggyBank,
} from "lucide-react";

interface ExpenseProofItem {
  id: string;
  title: string;
  amount: number;
  receiptUrl?: string | null;
  date: string;
  addedBy: string;
}

interface ApprovalItem {
  id: string;
  code: string;
  type: string;
  title: string;
  description: string;
  amount: number;
  approvedAmount?: number | null;
  approverNote?: string | null;
  actualSpent?: number;
  expenseItems?: string;
  settlementNote?: string | null;
  departmentCode: string;
  attachmentUrl?: string | null;
  status: string;
  rejectReason?: string;
  createdAt: string;
  createdById: string;
  createdBy: { fullName: string; position: string };
  checker?: { fullName: string };
  approver?: { fullName: string };
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"APPROVALS" | "BUDGETS">("APPROVALS");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [errMsg, setErrMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [form, setForm] = useState({ type: "PROJECT", title: "", description: "", amount: "", attachmentUrl: "" });

  // Modal Sếp duyệt ngân sách tùy chỉnh + lý do
  const [approveModalItem, setApproveModalItem] = useState<ApprovalItem | null>(null);
  const [approveAmount, setApproveAmount] = useState("");
  const [approverNote, setApproverNote] = useState("");

  // Modal thêm minh chứng chi tiêu khi triển khai
  const [expenseModalItem, setExpenseModalItem] = useState<ApprovalItem | null>(null);
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", receiptUrl: "" });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Modal Quyết toán & Đóng dự án
  const [settleModalItem, setSettleModalItem] = useState<ApprovalItem | null>(null);
  const [settlementNote, setSettlementNote] = useState("");

  async function loadData() {
    const [meRes, apRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/approvals")]);
    if (meRes.ok) {
      const m = await meRes.json();
      setUser(m.user);
    }
    if (apRes.ok) {
      const d = await apRes.json();
      setApprovals(d.approvals);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("tab") === "budgets") setActiveTab("BUDGETS");
    }
    loadData();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({ type: "PROJECT", title: "", description: "", amount: "", attachmentUrl: "" });
      loadData();
    }
  }

  async function handleAction(id: string, action: string) {
    setErrMsg("");
    let rejectReason: string | undefined;
    if (action === "REJECT") {
      rejectReason = window.prompt("Nhập lý do từ chối:") || "Không đạt yêu cầu";
    }
    const res = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, rejectReason }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErrMsg(d.error || "Không thể thực hiện thao tác");
    }
    loadData();
  }

  async function handleConfirmApprove(e: React.FormEvent) {
    e.preventDefault();
    if (!approveModalItem) return;
    setErrMsg("");
    const res = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: approveModalItem.id,
        action: "APPROVE",
        approvedAmount: Number(approveAmount) || approveModalItem.amount,
        approverNote,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErrMsg(d.error || "Không thể duyệt đề xuất");
    }
    setApproveModalItem(null);
    setApproveAmount("");
    setApproverNote("");
    loadData();
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseModalItem) return;
    setErrMsg("");
    const res = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: expenseModalItem.id,
        action: "ADD_EXPENSE",
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        receiptUrl: expenseForm.receiptUrl,
      }),
    });
    if (res.ok) {
      setExpenseModalItem(null);
      setExpenseForm({ title: "", amount: "", receiptUrl: "" });
      loadData();
    } else {
      const d = await res.json().catch(() => ({}));
      setErrMsg(d.error || "Không thể thêm khoản chi");
    }
  }

  async function handleSubmitSettlement(e: React.FormEvent) {
    e.preventDefault();
    if (!settleModalItem) return;
    setErrMsg("");
    const res = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: settleModalItem.id,
        action: "SUBMIT_SETTLEMENT",
        settlementNote,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErrMsg(d.error || "Không thể gửi quyết toán");
    }
    setSettleModalItem(null);
    setSettlementNote("");
    loadData();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Ngân sách &amp; Phê duyệt</h1>
            <p className="text-sm text-neutral-500">
              Quản lý đề xuất chi phí/dự án, duyệt hạn mức ngân sách phòng ban và quyết toán chứng từ
            </p>
          </div>
          {activeTab === "APPROVALS" && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tạo đề xuất mới
            </button>
          )}
        </div>

        {/* 2 Tabs */}
        <div className="inline-flex flex-wrap gap-1.5 bg-white p-1.5 rounded-xl border border-neutral-200 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("APPROVALS")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "APPROVALS"
                ? "bg-indigo-600 text-white shadow-sm shadow"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Receipt className="w-4 h-4" /> Đề xuất &amp; Phê duyệt ({approvals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("BUDGETS")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "BUDGETS"
                ? "bg-indigo-600 text-white shadow-sm shadow"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <PiggyBank className="w-4 h-4" /> Hạn mức Ngân sách Phòng ban
          </button>
        </div>

        {activeTab === "BUDGETS" ? (
          <BudgetsPanel />
        ) : (
          <>

        {errMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
            {errMsg}
          </div>
        )}

        {approvals.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center text-sm text-neutral-500">
            Chưa có đề xuất nào trong phòng ban của bạn. Bấm <strong>+ Tạo đề xuất mới</strong> để bắt đầu.
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((a) => {
              let parsedExpenses: ExpenseProofItem[] = [];
              try {
                parsedExpenses = a.expenseItems ? JSON.parse(a.expenseItems) : [];
              } catch {
                parsedExpenses = [];
              }
              const approvedBudget = a.approvedAmount ?? a.amount;
              const actualSpent = a.actualSpent ?? 0;
              const diff = approvedBudget - actualSpent;
              const isFinance = user?.role === "ADMIN" || user?.role === "ACCOUNTANT";
              const canImplement =
                isFinance ||
                user?.id === a.createdById ||
                user?.department?.code === a.departmentCode;

              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-700">{a.code}</span>
                        <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-xs font-medium">
                          {APPROVAL_TYPE_LABELS[a.type] || a.type}
                        </span>
                        <span className="text-xs text-neutral-400">{formatDate(a.createdAt)}</span>
                      </div>
                      <div className="font-semibold text-base text-neutral-900">{a.title}</div>
                      <div className="text-sm text-neutral-600">{a.description}</div>
                      <div className="text-xs text-neutral-500">
                        Người tạo: <strong>{a.createdBy.fullName}</strong> ({a.departmentCode})
                        {a.checker && ` • Kiểm tra: ${a.checker.fullName}`}
                        {a.approver && ` • Phê duyệt: ${a.approver.fullName}`}
                      </div>

                      {/* Thông tin đối chiếu ngân sách Sếp duyệt vs Đề xuất */}
                      {(a.approvedAmount !== null && a.approvedAmount !== undefined) || a.approverNote ? (
                        <div className="mt-2 p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs space-y-1">
                          <div className="flex flex-wrap gap-4">
                            <span>
                              Đề xuất ban đầu: <strong>{formatVND(a.amount)}</strong>
                            </span>
                            <span>
                              Ngân sách được duyệt:{" "}
                              <strong className="text-emerald-700">{formatVND(approvedBudget)}</strong>
                            </span>
                          </div>
                          {a.approverNote && (
                            <div className="text-neutral-700">
                              <strong>Lý do / Ghi chú của Sếp:</strong> {a.approverNote}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {a.attachmentUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(a.attachmentUrl || null)}
                          className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" /> Xem báo giá / chứng từ gốc
                        </button>
                      )}
                      {a.rejectReason && (
                        <div className="text-xs text-rose-600 font-medium">Lý do từ chối: {a.rejectReason}</div>
                      )}
                      {a.settlementNote && (
                        <div className="text-xs text-sky-700 font-medium">
                          Ghi chú quyết toán: {a.settlementNote}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[11px] text-neutral-500">
                          {a.approvedAmount !== null && a.approvedAmount !== undefined ? "Ngân sách được duyệt" : "Số tiền đề xuất"}
                        </div>
                        <div className="text-lg font-bold text-neutral-900 tabular-nums">
                          {formatVND(approvedBudget)}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          a.status === "APPROVED" || a.status === "PAID" || a.status === "CLOSED"
                            ? "bg-emerald-100 text-emerald-700"
                            : a.status === "REJECTED"
                            ? "bg-rose-100 text-rose-700"
                            : a.status === "SETTLEMENT_PENDING"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {getStatusLabel(a.status)}
                      </span>

                      <div className="flex flex-wrap justify-end gap-1.5 mt-1">
                        {isFinance && a.status === "PENDING" && (
                          <button
                            onClick={() => handleAction(a.id, "CHECK")}
                            className="px-2.5 py-1 rounded bg-amber-600 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Kế toán kiểm tra
                          </button>
                        )}
                        {user?.role === "ADMIN" && (a.status === "PENDING" || a.status === "ACCOUNTANT_CHECKED") && (
                          <>
                            <button
                              onClick={() => {
                                setApproveModalItem(a);
                                setApproveAmount(String(a.amount));
                                setApproverNote("");
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Duyệt &amp; Cấp ngân sách
                            </button>
                            <button
                              onClick={() => handleAction(a.id, "REJECT")}
                              className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Từ chối
                            </button>
                          </>
                        )}
                        {isFinance && a.status === "APPROVED" && (
                          <button
                            onClick={() => handleAction(a.id, "PAY")}
                            className="px-2.5 py-1 rounded bg-sky-600 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Wallet className="w-3.5 h-3.5" /> Giải ngân / Tạm ứng
                          </button>
                        )}
                        {canImplement && (a.status === "APPROVED" || a.status === "PAID") && (
                          <>
                            <button
                              onClick={() => {
                                setExpenseModalItem(a);
                                setExpenseForm({ title: "", amount: "", receiptUrl: "" });
                              }}
                              className="px-2.5 py-1 rounded bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5" /> + Chi tiêu / Up hóa đơn
                            </button>
                            <button
                              onClick={() => {
                                setSettleModalItem(a);
                                setSettlementNote("");
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Quyết toán &amp; Đóng dự án
                            </button>
                          </>
                        )}
                        {isFinance && a.status === "SETTLEMENT_PENDING" && (
                          <button
                            onClick={() => handleAction(a.id, "APPROVE_SETTLEMENT")}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Kế toán duyệt đóng &amp; hoàn quỹ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bảng theo dõi chi tiêu thực tế & quyết toán hoàn quỹ / vượt chi */}
                  {(parsedExpenses.length > 0 || actualSpent > 0 || a.status === "SETTLEMENT_PENDING" || a.status === "CLOSED") && (
                    <div className="border-t border-neutral-200 pt-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-neutral-800">
                          Minh chứng chi tiêu thực tế ({parsedExpenses.length} khoản)
                        </span>
                        <div className="flex flex-wrap items-center gap-3">
                          <span>
                            Thực tế đã chi: <strong className="text-neutral-950">{formatVND(actualSpent)}</strong>
                          </span>
                          {diff >= 0 ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                              Tiết kiệm / Hoàn quỹ: {formatVND(diff)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                              Phát sinh vượt chi: {formatVND(Math.abs(diff))}
                            </span>
                          )}
                        </div>
                      </div>
                      {parsedExpenses.length > 0 && (
                        <div className="divide-y divide-neutral-100 bg-neutral-50 rounded-lg border border-neutral-200">
                          {parsedExpenses.map((ex) => (
                            <div key={ex.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                              <div>
                                <span className="font-medium text-neutral-900">{ex.title}</span>{" "}
                                <span className="text-neutral-400">• {ex.addedBy} ({formatDate(ex.date)})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-rose-600 tabular-nums">{formatVND(ex.amount)}</span>
                                {ex.receiptUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewAttachment(ex.receiptUrl || null)}
                                    className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer"
                                  >
                                    Xem hóa đơn
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal tạo đề xuất mới */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold">Tạo đề xuất phê duyệt</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Loại đề xuất</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="PROJECT">Đề xuất dự án</option>
                    <option value="EXPENSE">Đề xuất chi phí</option>
                    <option value="PROCUREMENT">Đề xuất mua sắm</option>
                    <option value="BUDGET_SUPPLEMENT">Bổ sung ngân sách</option>
                    <option value="PAYMENT">Đề xuất thanh toán</option>
                    <option value="SALARY_ADJUSTMENT">Điều chỉnh lương</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tiêu đề</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Số tiền đề xuất (VNĐ)</label>
                  <input
                    type="number"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Mô tả chi tiết</label>
                  <textarea
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Ảnh báo giá / Chứng từ (tùy chọn)</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white shadow-sm text-xs font-medium cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingFile ? "Đang tải..." : "Tải tệp đính kèm"}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingFile(true);
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await fetch("/api/upload", { method: "POST", body: fd });
                          if (res.ok) {
                            const d = await res.json();
                            setForm((f) => ({ ...f, attachmentUrl: d.url }));
                          }
                          setUploadingFile(false);
                        }}
                        className="hidden"
                      />
                    </label>
                    {form.attachmentUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(form.attachmentUrl)}
                        className="text-xs text-amber-700 underline cursor-pointer"
                      >
                        Xem tệp
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-sm cursor-pointer">
                    Gửi đề xuất
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Sếp duyệt ngân sách tùy chỉnh & ghi chú lý do */}
        {approveModalItem && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Phê duyệt đề xuất {approveModalItem.code}</h3>
                <button onClick={() => setApproveModalItem(null)} className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs space-y-1">
                <div className="font-semibold text-neutral-900">{approveModalItem.title}</div>
                <div>
                  Ngân sách đề xuất ban đầu: <strong>{formatVND(approveModalItem.amount)}</strong>
                </div>
              </div>
              <form onSubmit={handleConfirmApprove} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Ngân sách Sếp duyệt (VNĐ)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Lý do / Ghi chú của Sếp</label>
                  <textarea
                    rows={3}
                    value={approverNote}
                    onChange={(e) => setApproverNote(e.target.value)}
                    placeholder="VD: Duyệt trước 8 triệu triển khai giai đoạn 1..."
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setApproveModalItem(null)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium cursor-pointer">
                    Xác nhận duyệt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Thêm khoản chi & Up minh chứng hóa đơn */}
        {expenseModalItem && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Up minh chứng chi tiêu ({expenseModalItem.code})</h3>
                <button onClick={() => setExpenseModalItem(null)} className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddExpense} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Nội dung đã chi *</label>
                  <input
                    required
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                    placeholder="VD: Mua vật tư, thuê server, in ấn..."
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Số tiền thực chi (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Hóa đơn / Hình ảnh minh chứng</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white shadow-sm text-xs font-medium cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingReceipt ? "Đang tải..." : "Scan / Tải hóa đơn"}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingReceipt(true);
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await fetch("/api/upload", { method: "POST", body: fd });
                          if (res.ok) {
                            const d = await res.json();
                            setExpenseForm((ef) => ({ ...ef, receiptUrl: d.url }));
                          }
                          setUploadingReceipt(false);
                        }}
                        className="hidden"
                      />
                    </label>
                    {expenseForm.receiptUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(expenseForm.receiptUrl)}
                        className="text-xs text-amber-700 underline cursor-pointer"
                      >
                        Xem hóa đơn
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setExpenseModalItem(null)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-sm font-medium cursor-pointer">
                    Lưu khoản chi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Quyết toán & Đóng dự án */}
        {settleModalItem && (() => {
          const approvedBudget = settleModalItem.approvedAmount ?? settleModalItem.amount;
          const actualSpent = settleModalItem.actualSpent ?? 0;
          const diff = approvedBudget - actualSpent;
          return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Quyết toán &amp; Đóng dự án ({settleModalItem.code})</h3>
                  <button onClick={() => setSettleModalItem(null)} className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span>Ngân sách đề xuất:</span>
                    <strong>{formatVND(settleModalItem.amount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Ngân sách được duyệt:</span>
                    <strong className="text-emerald-700">{formatVND(approvedBudget)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Thực tế đã chi (có hóa đơn):</span>
                    <strong className="text-rose-600">{formatVND(actualSpent)}</strong>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-neutral-200 font-bold">
                    <span>{diff >= 0 ? "Tiết kiệm & Hoàn quỹ:" : "Phát sinh vượt chi:"}</span>
                    <span className={diff >= 0 ? "text-emerald-700" : "text-rose-600"}>
                      {formatVND(Math.abs(diff))}
                    </span>
                  </div>
                </div>
                <form onSubmit={handleSubmitSettlement} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Ghi chú quyết toán</label>
                    <textarea
                      rows={3}
                      value={settlementNote}
                      onChange={(e) => setSettlementNote(e.target.value)}
                      placeholder="VD: Dự án đã hoàn tất, hoàn lại quỹ 3 triệu..."
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setSettleModalItem(null)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                      Hủy
                    </button>
                    <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium cursor-pointer">
                      Gửi Kế toán duyệt đóng
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        <AttachmentPreviewModal
          url={previewAttachment}
          title="Chứng từ / Hóa đơn dự án"
          onClose={() => setPreviewAttachment(null)}
        />
          </>
        )}
      </div>
    </AppShell>
  );
}
