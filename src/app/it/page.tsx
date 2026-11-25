"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND } from "@/lib/finance";
import { getStatusLabel } from "@/lib/labels";
import { Laptop, FolderKanban, CheckSquare } from "lucide-react";

export default function ITPage() {
  const [data, setData] = useState<{
    projects: { id: string; code: string; name: string; budget: number; actualCost: number; progress: number; status: string; manager: { fullName: string } }[];
    tasks: { id: string; title: string; priority: string; status: string; assignee: { fullName: string }; project?: { name: string } }[];
    devices: { id: string; code: string; name: string; category: string; purchaseCost: number; status: string; assignedTo?: { fullName: string } }[];
  }>({ projects: [], tasks: [], devices: [] });

  async function loadData() {
    const res = await fetch("/api/departments/it");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateTaskStatus(id: string, status: string) {
    await fetch("/api/departments/it", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "TASK", id, status }),
    });
    loadData();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Phòng IT — Dự án, Công việc & Thiết bị</h1>
          <p className="text-sm text-neutral-500">Quản lý tiến độ dự án công nghệ, công việc nhóm IT và tài sản thiết bị công ty</p>
        </div>

        {/* Projects */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <FolderKanban className="w-5 h-5 text-amber-600" /> Dự án công nghệ
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-neutral-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-mono text-amber-600 font-semibold">{p.code}</div>
                    <div className="font-semibold text-neutral-900">{p.name}</div>
                    <div className="text-xs text-neutral-500">Phụ trách: {p.manager.fullName}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    {getStatusLabel(p.status)}
                  </span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${p.progress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Tiến độ: {p.progress}%</span>
                  <span>Chi phí: {formatVND(p.actualCost)} / {formatVND(p.budget)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2 font-semibold text-neutral-900">
            <CheckSquare className="w-5 h-5 text-emerald-600" /> Công việc được giao
          </div>
          <div className="divide-y divide-neutral-100">
            {data.tasks.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm text-neutral-900">{t.title}</div>
                  <div className="text-xs text-neutral-500">
                    Người thực hiện: {t.assignee.fullName} {t.project ? `• ${t.project.name}` : ""}
                  </div>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => updateTaskStatus(t.id, e.target.value)}
                  className="border border-neutral-300 rounded-lg px-2.5 py-1 text-xs bg-white"
                >
                  <option value="TODO">Chưa làm</option>
                  <option value="IN_PROGRESS">Đang làm</option>
                  <option value="REVIEW">Chờ duyệt</option>
                  <option value="DONE">Hoàn thành</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Devices */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2 font-semibold text-neutral-900">
            <Laptop className="w-5 h-5 text-sky-600" /> Danh sách thiết bị IT
          </div>
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Tên thiết bị</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Người sử dụng</th>
                <th className="px-4 py-3 text-right">Giá trị</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.devices.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-mono text-xs">{d.code}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{d.name}</td>
                  <td className="px-4 py-3 text-xs">{d.category}</td>
                  <td className="px-4 py-3 text-xs">{d.assignedTo?.fullName || "Kho IT"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatVND(d.purchaseCost)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">{getStatusLabel(d.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
