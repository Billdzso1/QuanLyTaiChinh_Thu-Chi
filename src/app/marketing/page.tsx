"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND } from "@/lib/finance";
import { getStatusLabel, CHANNEL_LABELS, SOURCE_LABELS } from "@/lib/labels";
import { Megaphone, Users, Plus, X } from "lucide-react";

export default function MarketingPage() {
  const [data, setData] = useState<{
    campaigns: { id: string; code: string; name: string; channel: string; budget: number; spent: number; leadsCount: number; conversions: number; status: string; manager: { fullName: string } }[];
    leads: { id: string; fullName: string; phone: string; source: string; status: string; sales: { fullName: string } }[];
    mktUsers?: { id: string; fullName: string }[];
  }>({ campaigns: [], leads: [], mktUsers: [] });

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    channel: "FACEBOOK_ADS",
    managerId: "",
    budget: "",
    note: "",
  });

  async function loadData() {
    const res = await fetch("/api/departments/marketing");
    if (res.ok) {
      const d = await res.json();
      setData(d);
      if (d.mktUsers?.length && !form.managerId) {
        setForm((f) => ({ ...f, managerId: d.mktUsers[0].id }));
      }
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/departments/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        channel: form.channel,
        managerId: form.managerId || undefined,
        budget: Number(form.budget) || 0,
        note: form.note,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setShowModal(false);
      setForm({ name: "", channel: "FACEBOOK_ADS", managerId: form.managerId, budget: "", note: "" });
      setMsg(`Đã tạo chiến dịch / dự án "${d.campaign.name}" (${d.campaign.code}) thành công!`);
      await loadData();
    }
    setCreating(false);
  }

  const totalSpent = data.campaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = data.campaigns.reduce((s, c) => s + c.leadsCount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Phòng Marketing — Chiến dịch & Quảng cáo</h1>
            <p className="text-sm text-neutral-500">Theo dõi ngân sách quảng cáo Facebook/TikTok/Google, số lượng Lead và tỷ lệ chuyển đổi</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Tạo dự án / chiến dịch mới
          </button>
        </div>

        {msg && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm">{msg}</div>
        )}

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
                  <td className="px-4 py-3 text-xs">{CHANNEL_LABELS[c.channel] || c.channel}</td>
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
                  Nguồn: <strong>{SOURCE_LABELS[l.source] || l.source}</strong> • Sales: {l.sales.fullName}
                </div>
              </div>
            ))}
          </div>
        </div>
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900">Tạo dự án / chiến dịch Marketing mới</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateCampaign} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Tên dự án / chiến dịch *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: Chiến dịch TikTok Ads Quý 4..."
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Kênh triển khai</label>
                    <select
                      value={form.channel}
                      onChange={(e) => setForm({ ...form, channel: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="FACEBOOK_ADS">Facebook Ads</option>
                      <option value="TIKTOK_ADS">TikTok Ads</option>
                      <option value="GOOGLE_ADS">Google Ads</option>
                      <option value="ZALO_OA">Zalo OA</option>
                      <option value="EVENT_OFFLINE">Sự kiện / Offline</option>
                      <option value="OTHER">Kênh khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Người phụ trách</label>
                    <select
                      value={form.managerId}
                      onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {(data.mktUsers || []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Ngân sách dự kiến (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="VD: 15000000"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Ghi chú / Mục tiêu</label>
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Mục tiêu leads, khu vực chạy quảng cáo..."
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-sm cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm font-medium cursor-pointer disabled:opacity-50"
                  >
                    {creating ? "Đang tạo..." : "Tạo dự án"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
