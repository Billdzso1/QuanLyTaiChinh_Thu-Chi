"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";

const DEMO_ACCOUNTS = [
  { label: "Giám đốc (Admin)", email: "giamdoc@ndahome.vn" },
  { label: "Kế toán", email: "ketoan@ndahome.vn" },
  { label: "Sales (Phụ trách nhóm)", email: "sales1@ndahome.vn" },
  { label: "IT (Phụ trách nhóm)", email: "it1@ndahome.vn" },
  { label: "Marketing (Phụ trách nhóm)", email: "mkt1@ndahome.vn" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("giamdoc@ndahome.vn");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Đăng nhập thất bại");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-amber-500 p-8">
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
          </div>

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
