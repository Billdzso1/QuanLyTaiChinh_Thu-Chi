"use client";

import React, { useEffect, useState } from "react";
import { AppShell, CurrentUser } from "@/components/AppShell";
import { formatVND, formatDate } from "@/lib/finance";
import { getStatusLabel, APPROVAL_TYPE_LABELS } from "@/lib/labels";
import { Plus, Check, ShieldCheck, XCircle, Wallet, Upload, Image as ImageIcon, X } from "lucide-react";

interface ApprovalItem {
  id: string;
  code: string;
  type: string;
  title: string;
  description: string;
  amount: number;
  departmentCode: string;
  attachmentUrl?: string | null;
  status: string;
  rejectReason?: string;
  createdAt: string;
  createdBy: { fullName: string; position: string };
  checker?: { fullName: string };
  approver?: { fullName: string };
}

export default function ApprovalsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [form, setForm] = useState({ type: "EXPENSE", title: "", description: "", amount: "", attachmentUrl: "" });

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
      setForm({ type: "EXPENSE", title: "", description: "", amount: "", attachmentUrl: "" });
      loadData();
    }
  }

  async function handleAction(id: string, action: string) {
    let rejectReason: string | undefined;
    if (action === "REJECT") {
      rejectReason = window.prompt("Nhập lý do từ chối:") || "Không đạt yêu cầu";
    }
    await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, rejectReason }),
    });
    loadData();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Quản lý Đề xuất & Phê duyệt</h1>
            <p className="text-sm text-neutral-500">
              Quy trình: Nhân viên tạo đề xuất → Kế toán kiểm tra → Giám đốc phê duyệt → Kế toán thanh toán
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tạo đề xuất mới
          </button>
        </div>

        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-neutral-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-700">{a.code}</span>
                  <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-xs font-medium">
                    {APPROVAL_TYPE_LABELS[a.type] || a.type}
                  </span>
                  <span className="text-xs text-neutral-400">{formatDate(a.createdAt)}</span>
                </div>
                <div className="font-semibold text-neutral-900">{a.title}</div>
                <div className="text-sm text-neutral-600">{a.description}</div>
                <div className="text-xs text-neutral-500">
                  Người tạo: <strong>{a.createdBy.fullName}</strong> ({a.departmentCode})
                  {a.checker && ` • Kiểm tra: ${a.checker.fullName}`}
                  {a.approver && ` • Phê duyệt: ${a.approver.fullName}`}
                </div>
                {a.attachmentUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(a.attachmentUrl || null)}
                    className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Xem chứng từ đính kèm
                  </button>
                )}
                {a.rejectReason && <div className="text-xs text-rose-600 font-medium">Lý do từ chối: {a.rejectReason}</div>}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-lg font-bold text-neutral-900 tabular-nums">{formatVND(a.amount)}</div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    a.status === "APPROVED" || a.status === "PAID"
                      ? "bg-emerald-100 text-emerald-700"
                      : a.status === "REJECTED"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {getStatusLabel(a.status)}
                </span>

                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(user?.role === "ACCOUNTANT" || user?.role === "ADMIN") && a.status === "PENDING" && (
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
                        onClick={() => handleAction(a.id, "APPROVE")}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Duyệt
                      </button>
                      <button
                        onClick={() => handleAction(a.id, "REJECT")}
                        className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Từ chối
                      </button>
                    </>
                  )}
                  {(user?.role === "ACCOUNTANT" || user?.role === "ADMIN") && a.status === "APPROVED" && (
                    <button
                      onClick={() => handleAction(a.id, "PAY")}
                      className="px-2.5 py-1 rounded bg-sky-600 text-white text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5" /> Thực hiện thanh toán
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

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
                    <option value="EXPENSE">Đề xuất chi phí</option>
                    <option value="PROCUREMENT">Đề xuất mua sắm</option>
                    <option value="PROJECT">Đề xuất dự án</option>
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
                  <label className="block text-xs font-medium mb-1">Số tiền (VNĐ)</label>
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
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 text-amber-400 text-xs font-medium cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingFile ? "Đang tải..." : "Tải ảnh đính kèm"}
                      <input
                        type="file"
                        accept="image/*"
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
                      <img src={form.attachmentUrl} alt="Đính kèm" className="w-10 h-10 rounded object-cover border border-amber-400" />
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    Gửi đề xuất
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {previewAttachment && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewAttachment(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-neutral-900">Chứng từ / Báo giá đính kèm</div>
                <button onClick={() => setPreviewAttachment(null)} className="p-1 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img src={previewAttachment} alt="Đính kèm" className="w-full max-h-[70vh] object-contain rounded-lg border border-neutral-200" />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
