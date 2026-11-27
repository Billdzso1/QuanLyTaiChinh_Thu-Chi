"use client";

import React, { useEffect, useState } from "react";
import { AppShell, CurrentUser } from "@/components/AppShell";
import { formatDate } from "@/lib/finance";
import { getStatusLabel, LEAVE_TYPE_LABELS } from "@/lib/labels";
import { LogIn, LogOut, CalendarPlus, CheckCircle, Lock, Upload, Image as ImageIcon, X, Clock, UserCheck } from "lucide-react";

interface AttendanceRow {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  workHours: number;
  status: string;
  isConfirmed: boolean;
  isLocked: boolean;
  user?: { fullName: string; employeeCode: string; department?: { name: string } };
}

interface LeaveRow {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  evidenceUrl?: string | null;
  status: string;
  user?: { fullName: string };
}

interface AdjustmentRow {
  id: string;
  date: string;
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  reason: string;
  status: string;
  user?: { fullName: string };
}

export default function AttendancePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [scope, setScope] = useState<"personal" | "all">("personal");
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [msg, setMsg] = useState("");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [showAdminMarkModal, setShowAdminMarkModal] = useState(false);
  const [allEmployees, setAllEmployees] = useState<
    { id: string; fullName: string; employeeCode: string; employmentType: string; department: { name: string } }[]
  >([]);
  const [adminMarkForm, setAdminMarkForm] = useState({
    targetUserId: "",
    date: "2026-11-24",
    checkInTime: "08:00",
    checkOutTime: "17:30",
    status: "PRESENT",
    note: "",
  });
  const [previewEvidence, setPreviewEvidence] = useState<string | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [adjForm, setAdjForm] = useState({
    date: "2026-11-20",
    requestedCheckIn: "08:00",
    requestedCheckOut: "17:30",
    reason: "",
  });
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "ANNUAL",
    startDate: "2026-11-20",
    endDate: "2026-11-20",
    days: "1",
    reason: "",
    evidenceUrl: "",
  });

  async function loadData(s = scope) {
    const [meRes, attRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch(`/api/attendance?scope=${s}`),
    ]);
    if (meRes.ok) {
      const m = await meRes.json();
      setUser(m.user);
      if (m.user.role === "ADMIN") {
        fetch("/api/employees")
          .then((r) => (r.ok ? r.json() : null))
          .then((ed) => {
            if (ed?.users) {
              setAllEmployees(ed.users);
              setAdminMarkForm((f) => ({ ...f, targetUserId: f.targetUserId || ed.users[0]?.id || "" }));
            }
          });
      }
    }
    if (attRes.ok) {
      const d = await attRes.json();
      setAttendances(d.attendances);
      setLeaves(d.leaveRequests);
      setAdjustments(d.adjustments || []);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function handleClock(action: "CHECK_IN" | "CHECK_OUT") {
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    setMsg(res.ok ? (action === "CHECK_IN" ? "Đã chấm công vào thành công!" : "Đã chấm công ra thành công!") : d.error);
    loadData();
  }

  async function handleEvidenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEvidence(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const d = await res.json();
      setLeaveForm((f) => ({ ...f, evidenceUrl: d.url }));
    }
    setUploadingEvidence(false);
  }

  async function handleLeaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "LEAVE_REQUEST", ...leaveForm }),
    });
    if (res.ok) {
      setShowLeaveModal(false);
      setLeaveForm({ ...leaveForm, reason: "", evidenceUrl: "" });
      loadData();
    }
  }

  async function handleAdjSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADJUSTMENT_REQUEST", ...adjForm }),
    });
    if (res.ok) {
      setShowAdjModal(false);
      setAdjForm({ ...adjForm, reason: "" });
      setMsg("Đã gửi yêu cầu điều chỉnh giờ công!");
      loadData();
    }
  }

  async function handleAdminMarkSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ADMIN_MARK_ATTENDANCE", ...adminMarkForm }),
    });
    const d = await res.json();
    if (res.ok) {
      setShowAdminMarkModal(false);
      setMsg("Đã chấm công cho nhân sự thành công!");
      setScope("all");
      loadData("all");
    } else {
      setMsg(d.error || "Lỗi chấm công");
    }
  }

  async function handleAdminAction(action: string, payload: Record<string, unknown>) {
    await fetch("/api/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    loadData();
  }

  const isFinance = user?.role === "ADMIN" || user?.role === "ACCOUNTANT";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Chấm công & Nghỉ phép</h1>
            <p className="text-sm text-neutral-500">
              Nhân viên tự chấm công trên website • Kế toán kiểm tra, xác nhận và chốt bảng công tháng
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleClock("CHECK_IN")}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Chấm công Vào
            </button>
            <button
              onClick={() => handleClock("CHECK_OUT")}
              className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Chấm công Ra
            </button>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="px-4 py-2 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" /> Xin nghỉ phép
            </button>
            <button
              onClick={() => setShowAdjModal(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4" /> Sửa giờ công
            </button>
            {user?.role === "ADMIN" && (
              <button
                onClick={() => setShowAdminMarkModal(true)}
                className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" /> Chấm công nhân sự
              </button>
            )}
          </div>
        </div>

        {msg && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">{msg}</div>}

        {isFinance && (
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-neutral-200">
            <div className="flex gap-2">
              <button
                onClick={() => setScope("personal")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${scope === "personal" ? "bg-neutral-950 text-amber-400 border border-amber-500" : "bg-neutral-100 text-neutral-700"
                  }`}
              >
                Chấm công cá nhân
              </button>
              <button
                onClick={() => setScope("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${scope === "all" ? "bg-neutral-950 text-amber-400 border border-amber-500" : "bg-neutral-100 text-neutral-700"
                  }`}
              >
                Toàn công ty (16 nhân sự)
              </button>
            </div>
            {scope === "all" && (
              <button
                onClick={() => handleAdminAction("LOCK_MONTH", { monthPrefix: "2026-11" })}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> Chốt bảng công T11/2026
              </button>
            )}
          </div>
        )}

        {/* Attendance Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 font-semibold text-sm text-neutral-800">
            Lịch sử chấm công
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  {scope === "all" && <th className="px-4 py-3">Nhân viên</th>}
                  <th className="px-4 py-3">Giờ vào</th>
                  <th className="px-4 py-3">Giờ ra</th>
                  <th className="px-4 py-3 text-right">Số giờ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Xác nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {attendances.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium">{formatDate(a.date)}</td>
                    {scope === "all" && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{a.user?.fullName}</div>
                        <div className="text-xs text-neutral-400">{a.user?.department?.name}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs">
                      {a.checkIn ? new Date(a.checkIn).toLocaleTimeString("vi-VN") : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {a.checkOut ? new Date(a.checkOut).toLocaleTimeString("vi-VN") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{a.workHours.toFixed(1)}h</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "PRESENT"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                          }`}
                      >
                        {getStatusLabel(a.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.isLocked ? (
                        <span className="text-xs text-neutral-500 font-medium">Đã chốt</span>
                      ) : a.isConfirmed ? (
                        <span className="text-xs text-emerald-600 font-medium">Đã xác nhận</span>
                      ) : isFinance ? (
                        <button
                          onClick={() => handleAdminAction("CONFIRM_ATTENDANCE", { id: a.id })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-medium cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Xác nhận
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">Chờ kế toán</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leave Requests */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 font-semibold text-sm text-neutral-800">
            Đơn xin nghỉ phép
          </div>
          <div className="divide-y divide-neutral-100">
            {leaves.map((l) => (
              <div key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-sm text-neutral-900">
                    {l.user?.fullName ? `${l.user.fullName} — ` : ""}
                    {LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType} ({l.days} ngày: {l.startDate} → {l.endDate})
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">Lý do: {l.reason}</div>
                  {l.evidenceUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewEvidence(l.evidenceUrl || null)}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Xem hình ảnh minh chứng
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${l.status === "APPROVED"
                      ? "bg-emerald-100 text-emerald-700"
                      : l.status === "REJECTED"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-800"
                      }`}
                  >
                    {getStatusLabel(l.status)}
                  </span>
                  {isFinance && l.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleAdminAction("REVIEW_LEAVE", { id: l.id, status: "APPROVED" })}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs cursor-pointer"
                      >
                        Duyệt
                      </button>
                      <button
                        onClick={() => handleAdminAction("REVIEW_LEAVE", { id: l.id, status: "REJECTED" })}
                        className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs cursor-pointer"
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Adjustment Requests */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 font-semibold text-sm text-neutral-800">
            Yêu cầu điều chỉnh giờ công
          </div>
          <div className="divide-y divide-neutral-100">
            {adjustments.length === 0 ? (
              <div className="p-4 text-xs text-neutral-500">Chưa có yêu cầu điều chỉnh giờ công nào.</div>
            ) : (
              adjustments.map((adj) => (
                <div key={adj.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm text-neutral-900">
                      {adj.user?.fullName ? `${adj.user.fullName} — ` : ""}
                      Ngày {formatDate(adj.date)} ({adj.requestedCheckIn || "—"} → {adj.requestedCheckOut || "—"})
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">Lý do: {adj.reason}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${adj.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-700"
                        : adj.status === "REJECTED"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      {getStatusLabel(adj.status)}
                    </span>
                    {isFinance && adj.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleAdminAction("REVIEW_ADJUSTMENT", { id: adj.id, status: "APPROVED" })}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs cursor-pointer"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => handleAdminAction("REVIEW_ADJUSTMENT", { id: adj.id, status: "REJECTED" })}
                          className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs cursor-pointer"
                        >
                          Từ chối
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {showAdjModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold">Yêu cầu điều chỉnh giờ công</h3>
              <form onSubmit={handleAdjSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Ngày cần điều chỉnh</label>
                  <input
                    type="date"
                    required
                    value={adjForm.date}
                    onChange={(e) => setAdjForm({ ...adjForm, date: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Giờ vào thực tế</label>
                    <input
                      type="time"
                      value={adjForm.requestedCheckIn}
                      onChange={(e) => setAdjForm({ ...adjForm, requestedCheckIn: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Giờ ra thực tế</label>
                    <input
                      type="time"
                      value={adjForm.requestedCheckOut}
                      onChange={(e) => setAdjForm({ ...adjForm, requestedCheckOut: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Lý do điều chỉnh</label>
                  <textarea
                    required
                    value={adjForm.reason}
                    onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    rows={3}
                    placeholder="VD: Quên bấm chấm công vào, đi gặp khách hàng..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAdjModal(false)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    Gửi yêu cầu
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showAdminMarkModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold">Chấm công cho Nhân viên / Thực tập sinh</h3>
              <form onSubmit={handleAdminMarkSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Chọn nhân sự (Chính thức / Thực tập sinh)</label>
                  <select
                    required
                    value={adminMarkForm.targetUserId}
                    onChange={(e) => setAdminMarkForm({ ...adminMarkForm, targetUserId: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {allEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeCode} — {emp.fullName} ({emp.employmentType === "INTERN" ? "Thực tập sinh" : "Chính thức"} • {emp.department.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Ngày chấm công</label>
                    <input
                      type="date"
                      required
                      value={adminMarkForm.date}
                      onChange={(e) => setAdminMarkForm({ ...adminMarkForm, date: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Trạng thái</label>
                    <select
                      value={adminMarkForm.status}
                      onChange={(e) => setAdminMarkForm({ ...adminMarkForm, status: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="PRESENT">Đúng giờ</option>
                      <option value="LATE">Đi muộn</option>
                      <option value="EARLY_LEAVE">Về sớm</option>
                      <option value="LEAVE">Nghỉ phép</option>
                      <option value="ABSENT">Vắng mặt</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Giờ vào</label>
                    <input
                      type="time"
                      value={adminMarkForm.checkInTime}
                      onChange={(e) => setAdminMarkForm({ ...adminMarkForm, checkInTime: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Giờ ra</label>
                    <input
                      type="time"
                      value={adminMarkForm.checkOutTime}
                      onChange={(e) => setAdminMarkForm({ ...adminMarkForm, checkOutTime: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Ghi chú (tùy chọn)</label>
                  <input
                    value={adminMarkForm.note}
                    onChange={(e) => setAdminMarkForm({ ...adminMarkForm, note: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="VD: Giám đốc chấm công ca sáng..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowAdminMarkModal(false)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    Lưu chấm công
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showLeaveModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold">Gửi đơn xin nghỉ phép</h3>
              <form onSubmit={handleLeaveSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Loại nghỉ</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="ANNUAL">Nghỉ phép năm</option>
                    <option value="SICK">Nghỉ ốm</option>
                    <option value="PERSONAL">Việc riêng</option>
                    <option value="UNPAID">Nghỉ không lương</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Từ ngày</label>
                    <input
                      type="date"
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Đến ngày</label>
                    <input
                      type="date"
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Lý do</label>
                  <textarea
                    required
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Hình ảnh minh chứng (giấy khám, lịch thi/học...)</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 text-amber-400 text-xs font-medium cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingEvidence ? "Đang tải..." : "Tải ảnh minh chứng"}
                      <input type="file" accept="image/*" onChange={handleEvidenceUpload} className="hidden" />
                    </label>
                    {leaveForm.evidenceUrl && (
                      <img
                        src={leaveForm.evidenceUrl}
                        alt="Minh chứng"
                        className="w-12 h-12 rounded-lg object-cover border border-amber-400"
                      />
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(false)}
                    className="px-4 py-2 rounded-lg border text-sm cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    Gửi đơn
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {previewEvidence && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewEvidence(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-neutral-900">Hình ảnh minh chứng xin nghỉ phép</div>
                <button onClick={() => setPreviewEvidence(null)} className="p-1 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img src={previewEvidence} alt="Minh chứng xin nghỉ" className="w-full max-h-[70vh] object-contain rounded-lg border border-neutral-200" />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
