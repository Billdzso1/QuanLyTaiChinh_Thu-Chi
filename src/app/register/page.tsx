"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User, Mail, Phone, Lock, Building2, CheckCircle2, ArrowLeft } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { HumanVerifyWidget } from "@/components/HumanVerifyWidget";

interface DeptOption {
  id: string;
  code: string;
  name: string;
}

export default function RegisterPage() {
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    departmentCode: "SALES",
    employmentType: "FULL_TIME",
    university: "",
    password: "",
    confirmPassword: "",
  });
  const [humanToken, setHumanToken] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/register")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.departments?.length) {
          setDepartments(d.departments);
          setForm((f) => ({ ...f, departmentCode: d.departments[0].code }));
        }
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    if (!humanToken) {
      setError("Vui lòng xác nhận 'Tôi không phải là người máy' trước khi đăng ký.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, humanToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đăng ký thất bại");
      } else {
        setSuccessMsg(
          data.message ||
            "Đăng ký thành công! Tài khoản của bạn đang chờ Admin phê duyệt trước khi đăng nhập."
        );
      }
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#09090b] p-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 15%, rgba(251,191,36,0.35), transparent 50%), radial-gradient(circle at 20% 85%, rgba(56,189,248,0.18), transparent 45%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 38px 38px, 38px 38px",
        }}
      />
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_25px_70px_-15px_rgba(251,191,36,0.3)] border-2 border-amber-400/80 p-8 nda-page-enter">
        <div className="flex items-center gap-3 mb-6">
          <CompanyLogo size={44} />
          <div>
            <h1 className="text-xl font-bold text-neutral-950">ĐĂNG KÝ TÀI KHOẢN</h1>
            <p className="text-xs text-neutral-600">NDAHOME Management • Chờ Admin phê duyệt</p>
          </div>
        </div>

        {successMsg ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                Đăng ký thành công!
              </div>
              <p className="text-xs leading-relaxed">{successMsg}</p>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại Đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-neutral-900 mb-1">Họ và tên *</label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Nguyễn Văn A"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="ten@ndahome.vn"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Số điện thoại</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="090xxxxxxx"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Phòng ban</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <select
                    value={form.departmentCode}
                    onChange={(e) => setForm({ ...form, departmentCode: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {departments.length > 0 ? (
                      <>
                        {departments.map((d) => (
                          <option key={d.id} value={d.code}>
                            {d.name}
                          </option>
                        ))}
                        <option value="LANDLORD">Chủ trọ / Đối tác (Quản lý phòng)</option>
                      </>
                    ) : (
                      <>
                        <option value="SALES">Phòng Sales</option>
                        <option value="MARKETING">Phòng Marketing</option>
                        <option value="IT">Phòng IT</option>
                        <option value="ACCOUNTING">Phòng Kế toán</option>
                        <option value="LANDLORD">Chủ trọ / Đối tác (Quản lý phòng)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Loại hình</label>
                <select
                  value={form.employmentType}
                  onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="FULL_TIME">Nhân viên chính thức</option>
                  <option value="INTERN">Thực tập sinh</option>
                </select>
              </div>
            </div>

            {form.employmentType === "INTERN" && (
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Trường học</label>
                <input
                  value={form.university}
                  onChange={(e) => setForm({ ...form, university: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="VD: Đại học Kinh tế Luật TP.HCM"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Mật khẩu *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Tối thiểu 6 ký tự"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">Nhập lại mật khẩu *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>

            <HumanVerifyWidget verifiedToken={humanToken} onVerified={setHumanToken} />

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Đang gửi đăng ký..." : "Đăng ký tài khoản"}
            </button>

            <div className="text-center text-xs text-neutral-600 pt-2">
              Đã có tài khoản?{" "}
              <Link href="/login" className="font-bold text-amber-700 hover:underline">
                Đăng nhập ngay
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
