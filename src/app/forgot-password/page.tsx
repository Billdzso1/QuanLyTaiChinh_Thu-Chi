"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, KeyRound, Lock, Mail, User } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";

interface DeptOption {
  id: string;
  code: string;
  name: string;
}

export default function ForgotPasswordPage() {
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentCode, setDepartmentCode] = useState("SALES");

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [infoMsg, setInfoMsg] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/forgot-password")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.departments?.length) {
          setDepartments(d.departments);
          setDepartmentCode(d.departments[0].code);
        }
      });
  }, []);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REQUEST_OTP", fullName, email, departmentCode }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Không thể gửi mã OTP");
      } else {
        setInfoMsg(d.message || "");
        setDemoOtp(d.demoOtp || "");
        setStep(2);
      }
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_PASSWORD", email, otp, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Không thể đặt lại mật khẩu");
      } else {
        setInfoMsg(d.message || "Đổi mật khẩu thành công!");
        setStep(3);
      }
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-cyan-950 p-4 overflow-hidden">
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_25px_70px_-15px_rgba(79,70,229,0.4)] border border-indigo-200/80 p-8">
        <div className="flex items-center gap-3 mb-6">
          <CompanyLogo size={44} />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">QUÊN MẬT KHẨU</h1>
            <p className="text-xs text-slate-500">Xác minh thông tin &amp; nhận mã OTP qua Gmail</p>
          </div>
        </div>

        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-900 mb-1">Họ và tên đã đăng ký *</label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="VD: Nguyễn Anh Thư"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-900 mb-1">Email / Gmail đăng ký *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="ten@gmail.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-900 mb-1">Phòng ban đang làm *</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <select
                  value={departmentCode}
                  onChange={(e) => setDepartmentCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Đang kiểm tra & gửi OTP..." : "Gửi mã OTP về Gmail"}
            </button>

            <div className="text-center text-xs text-neutral-600 pt-1">
              <Link href="/login" className="inline-flex items-center gap-1 font-bold text-amber-700 hover:underline">
                <ArrowLeft className="w-3.5 h-3.5" /> Quay lại Đăng nhập
              </Link>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
              <div>{infoMsg}</div>
              {demoOtp && (
                <div className="text-lg font-mono font-extrabold tracking-widest text-neutral-950 pt-1">
                  {demoOtp}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-900 mb-1">Mã OTP (6 số) *</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="123456"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-900 mb-1">Mật khẩu mới *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-900 mb-1">Nhập lại mật khẩu mới *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Đang cập nhật..." : "Xác nhận đổi mật khẩu"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
              }}
              className="w-full text-center text-xs text-neutral-500 hover:underline cursor-pointer"
            >
              ← Nhập lại thông tin
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Đổi mật khẩu thành công!
              </div>
              <p className="text-xs">{infoMsg}</p>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Đăng nhập ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
