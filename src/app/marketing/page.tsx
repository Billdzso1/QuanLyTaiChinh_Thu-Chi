"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND } from "@/lib/finance";
import { getStatusLabel } from "@/lib/labels";
import { Megaphone, Users } from "lucide-react";

export default function MarketingPage() {
  const [data, setData] = useState<{
    campaigns: { id: string; code: string; name: string; channel: string; budget: number; spent: number; leadsCount: number; conversions: number; status: string; manager: { fullName: string } }[];
    leads: { id: string; fullName: string; phone: string; source: string; status: string; sales: { fullName: string } }[];
  }>({ campaigns: [], leads: [] });

  useEffect(() => {
    fetch("/api/departments/marketing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d));
  }, []);

  const totalSpent = data.campaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = data.campaigns.reduce((s, c) => s + c.leadsCount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Phòng Marketing — Chiến dịch & Quảng cáo</h1>
          <p className="text-sm text-neutral-500">Theo dõi ngân sách quảng cáo Facebook/TikTok/Google, số lượng Lead và tỷ lệ chuyển đổi</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-white to-amber-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Chiến dịch đang chạy</div>
            <div className="text-xl font-bold text-amber-700 mt-1">{data.campaigns.length} chiến dịch</div>
          </div>
          <div className="bg-gradient-to-br from-white to-rose-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-rose-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Tổng chi phí quảng cáo</div>
            <div className="text-xl font-bold text-rose-700 mt-1 tabular-nums">{formatVND(totalSpent)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-emerald-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600">Tổng khách hàng tiềm năng (Leads)</div>
            <div className="text-xl font-bold text-emerald-700 mt-1">{totalLeads} leads</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2 font-semibold text-neutral-900">
            <Megaphone className="w-5 h-5 text-amber-600" /> Hiệu quả chiến dịch
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3">Chiến dịch</th>
                <th className="px-4 py-3">Kênh</th>
                <th className="px-4 py-3 text-right">Ngân sách</th>
                <th className="px-4 py-3 text-right">Đã chi</th>
                <th className="px-4 py-3 text-center">Leads</th>
                <th className="px-4 py-3 text-center">Chốt HĐ</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{c.name}</div>
                    <div className="text-xs text-neutral-400">Phụ trách: {c.manager.fullName}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.channel}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatVND(c.budget)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-rose-600">{formatVND(c.spent)}</td>
                  <td className="px-4 py-3 text-center font-semibold">{c.leadsCount}</td>
                  <td className="px-4 py-3 text-center font-semibold text-emerald-600">{c.conversions}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">{getStatusLabel(c.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2 font-semibold text-neutral-900">
            <Users className="w-5 h-5 text-sky-600" /> Khách hàng tiềm năng từ Quảng cáo
          </div>
          <div className="divide-y divide-neutral-100">
            {data.leads.map((l) => (
              <div key={l.id} className="px-5 py-3 flex justify-between items-center text-sm">
                <div>
                  <span className="font-medium text-neutral-900">{l.fullName}</span> —{" "}
                  <span className="text-neutral-500">{l.phone}</span>
                </div>
                <div className="text-xs text-neutral-500">
                  Nguồn: <strong>{l.source}</strong> • Sales: {l.sales.fullName}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
