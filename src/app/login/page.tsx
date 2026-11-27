"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { HumanVerifyWidget } from "@/components/HumanVerifyWidget";

const DEMO_ACCOUNTS = [
  { label: "Giám đốc (Admin)", email: "giamdoc@ndahome.vn" },
  { label: "Kế toán", email: "ketoan@ndahome.vn" },
  { label: "Sales (Phụ trách nhóm)", email: "sales1@ndahome.vn" },
  { label: "IT (Phụ trách nhóm)", email: "it1@ndahome.vn" },
  { label: "Marketing (Phụ trách nhóm)", email: "mkt1@ndahome.vn" },
  { label: "Chủ trọ / Đối tác", email: "chutro@ndahome.vn" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("giamdoc@ndahome.vn");
  const [password, setPassword] = useState("123456");
  const [humanToken, setHumanToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!humanToken) {
      setError("Vui lòng xác nhận 'Tôi không phải là người máy' trước khi đăng nhập.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, humanToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đăng nhập thất bại");
      } else {
        if (data.token) {
          sessionStorage.setItem("ndahome_tab_token", data.token);
        }
        router.push(data.user?.role === "LANDLORD" ? "/landlord" : "/");
        router.refresh();
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
            "radial-gradient(circle at 50% 15%, rgba(251,191,36,0.35), transparent 50%), radial-gradient(circle at 80% 85%, rgba(16,185,129,0.18), transparent 45%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 38px 38px, 38px 38px",
        }}
      />
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_25px_70px_-15px_rgba(251,191,36,0.3)] border-2 border-amber-400/80 p-8 nda-page-enter">
        <div className="flex items-center gap-3 mb-6">
          <CompanyLogo size={44} />
          <div>
            <h1 className="text-xl font-bold text-neutral-950">NDAHOME MANAGEMENT</h1>
            <p className="text-xs text-neutral-600">Hệ thống quản lý tài chính & hoạt động nội bộ</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-neutral-900 mb-1">Email công ty</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="ten@ndahome.vn"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-900 mb-1">Mật khẩu</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="••••••"
              />
            </div>
            <div className="flex justify-end mt-1.5">
              <Link href="/forgot-password" className="text-xs font-semibold text-amber-700 hover:underline">
                Quên mật khẩu?
              </Link>
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
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <div className="text-center text-xs text-neutral-600 pt-1">
            Nhân sự mới chưa có tài khoản?{" "}
            <Link href="/register" className="font-bold text-amber-700 hover:underline">
              Đăng ký tài khoản
            </Link>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-neutral-200">
          <div className="text-xs font-medium text-neutral-600 mb-2.5">
            Chọn nhanh tài khoản demo (mật khẩu: <code className="text-neutral-950 font-bold">123456</code>):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("123456");
                }}
                className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-500 hover:text-neutral-950 text-xs text-neutral-900 border border-amber-300 font-medium transition-colors cursor-pointer"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
