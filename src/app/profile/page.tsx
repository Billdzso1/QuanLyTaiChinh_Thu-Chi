"use client";

import React, { useEffect, useState } from "react";
import { AppShell, CurrentUser } from "@/components/AppShell";
import { formatVND } from "@/lib/finance";
import { getStatusLabel } from "@/lib/labels";
import { KeyRound, Bell, BadgeDollarSign, Image as ImageIcon, Upload } from "lucide-react";
import { CompanyLogo, setGlobalLogoUrl } from "@/components/CompanyLogo";

interface PayrollSelf {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  salesRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  allowance: number;
  bonus: number;
  deduction: number;
  grossIncome: number;
  netSalary: number;
  status: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [payrolls, setPayrolls] = useState<PayrollSelf[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; isRead: boolean }[]>([]);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [logoInputUrl, setLogoInputUrl] = useState("");
  const [logoMsg, setLogoMsg] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/auth/me"), fetch("/api/payroll"), fetch("/api/notifications")]).then(
      async ([meRes, pRes, nRes]) => {
        if (meRes.ok) setUser((await meRes.json()).user);
        if (pRes.ok) {
          const pd = await pRes.json();
          setPayrolls(pd.history?.length ? pd.history : pd.payrolls || []);
        }
        if (nRes.ok) setNotifications((await nRes.json()).notifications || []);
      }
    );
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CHANGE_PASSWORD", ...pwForm }),
    });
    const d = await res.json();
    setPwMsg(res.ok ? "Đổi mật khẩu thành công!" : d.error);
    if (res.ok) setPwForm({ currentPassword: "", newPassword: "" });
  }

  async function handleUploadLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
    const d = await res.json();
    if (res.ok) {
      setGlobalLogoUrl(d.logoUrl);
      setLogoMsg("Đã tải lên logo công ty thành công!");
    } else {
      setLogoMsg(d.error || "Lỗi tải logo");
    }
  }

  async function handleSaveLogoUrl(url: string | null) {
    const res = await fetch("/api/settings/logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: url }),
    });
    const d = await res.json();
    if (res.ok) {
      setGlobalLogoUrl(d.logoUrl);
      setLogoMsg(url ? "Đã cập nhật link logo thành công!" : "Đã khôi phục logo mặc định!");
    } else {
      setLogoMsg(d.error || "Lỗi cập nhật logo");
    }
  }

  const currentPayroll = payrolls[0];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Hồ sơ & Lương cá nhân</h1>
          <p className="text-sm text-neutral-500">Thông tin tài khoản, bảng lương cá nhân, thông báo nội bộ và bảo mật</p>
        </div>

        {user && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/80 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
              <div className="text-xs font-semibold text-neutral-500">Họ và tên</div>
              <div className="font-bold text-neutral-900 text-lg mt-1">{user.fullName}</div>
              <div className="text-xs text-amber-700 font-semibold mt-0.5">
                {user.employeeCode} • {user.position}
              </div>
            </div>
            <div className="p-5 rounded-xl border border-neutral-200 border-l-4 border-l-sky-500 bg-gradient-to-br from-white to-sky-50/70 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
              <div className="text-xs font-semibold text-neutral-500">Phòng ban &amp; Email</div>
              <div className="font-bold text-sky-800 text-base mt-1">{user.department.name}</div>
              <div className="text-xs text-neutral-600 mt-0.5">{user.email}</div>
            </div>
            <div className="p-5 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/70 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
              <div className="text-xs font-semibold text-neutral-500">Lương cơ bản / Phụ cấp</div>
              <div className="font-bold text-emerald-700 text-lg mt-1 tabular-nums">
                {formatVND(user.baseSalary)} <span className="text-xs font-normal text-neutral-500">/ {formatVND(user.allowance)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Current Month Salary */}
        {currentPayroll && (
          <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-neutral-900">
                <BadgeDollarSign className="w-5 h-5 text-emerald-600" /> Tổng quan lương tháng {currentPayroll.month}/
                {currentPayroll.year}
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold">
                {getStatusLabel(currentPayroll.status)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-neutral-200 border-l-4 border-l-sky-500 bg-gradient-to-br from-white to-sky-50/70 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
                <div className="text-xs font-medium text-neutral-600">Lương cơ bản</div>
                <div className="font-bold text-sky-700 text-lg mt-1 tabular-nums">{formatVND(currentPayroll.baseSalary)}</div>
              </div>
              <div className="p-4 rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/80 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
                <div className="text-xs font-medium text-neutral-600">Hoa hồng ({(currentPayroll.commissionRate * 100).toFixed(0)}%)</div>
                <div className="font-bold text-amber-700 text-lg mt-1 tabular-nums">{formatVND(currentPayroll.commissionAmount)}</div>
              </div>
              <div className="p-4 rounded-xl border border-neutral-200 border-l-4 border-l-violet-500 bg-gradient-to-br from-white to-violet-50/70 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
                <div className="text-xs font-medium text-neutral-600">Phụ cấp &amp; Thưởng</div>
                <div className="font-bold text-violet-700 text-lg mt-1 tabular-nums">
                  {formatVND(currentPayroll.allowance + currentPayroll.bonus)}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/80 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
                <div className="text-xs text-emerald-700 font-semibold">Tổng lương thực nhận</div>
                <div className="font-bold text-emerald-700 text-lg mt-1 tabular-nums">{formatVND(currentPayroll.netSalary)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Notifications */}
          <div className="bg-white rounded-xl border border-neutral-200 border-t-4 border-t-amber-500 p-5 space-y-3 transition-all duration-300 hover:shadow-lg">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <Bell className="w-5 h-5 text-amber-600" /> Thông báo nội bộ
            </div>
            <div className="divide-y divide-neutral-100">
              {notifications.length === 0 ? (
                <div className="text-sm text-neutral-400 py-4">Không có thông báo mới.</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="py-3 hover:bg-amber-50/30 px-2 rounded-lg transition-colors">
                    <div className="font-medium text-sm text-neutral-900">{n.title}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{n.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-xl border border-neutral-200 border-t-4 border-t-sky-500 p-5 space-y-4 transition-all duration-300 hover:shadow-lg">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <KeyRound className="w-5 h-5 text-amber-600" /> Đổi mật khẩu
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                required
                placeholder="Mật khẩu hiện tại"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
              />
              {pwMsg && <div className="text-xs font-medium text-amber-700">{pwMsg}</div>}
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-sm font-medium cursor-pointer"
              >
                Cập nhật mật khẩu
              </button>
            </form>
          </div>
        </div>

        {user?.role === "ADMIN" && (
          <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <ImageIcon className="w-5 h-5 text-amber-600" /> Cài đặt Logo Công ty (Chỉ Giám đốc)
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex items-center gap-3">
                <CompanyLogo size={56} />
                <div className="text-xs text-neutral-500">Logo hiện tại hiển thị trên toàn hệ thống</div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-sm font-medium cursor-pointer">
                    <Upload className="w-4 h-4" /> Tải tệp ảnh từ máy
                    <input type="file" accept="image/*" onChange={handleUploadLogoFile} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSaveLogoUrl(null)}
                    className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-xs font-medium text-neutral-700 cursor-pointer"
                  >
                    Khôi phục mặc định
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Hoặc dán link URL ảnh logo (https://...)"
                    value={logoInputUrl}
                    onChange={(e) => setLogoInputUrl(e.target.value)}
                    className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveLogoUrl(logoInputUrl)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-600 hover:to-sky-600 text-white shadow-sm shadow-cyan-500/20 font-bold text-sm cursor-pointer"
                  >
                    Lưu Link
                  </button>
                </div>
                {logoMsg && <div className="text-xs font-medium text-emerald-700">{logoMsg}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
