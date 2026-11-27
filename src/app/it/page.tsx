"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND } from "@/lib/finance";
import { getStatusLabel, DEVICE_CATEGORY_LABELS } from "@/lib/labels";
import { Laptop, FolderKanban, CheckSquare, Plus, X } from "lucide-react";

export default function ITPage() {
  const [data, setData] = useState<{
    projects: { id: string; code: string; name: string; description?: string | null; budget: number; actualCost: number; progress: number; status: string; manager: { fullName: string } }[];
    tasks: { id: string; title: string; priority: string; status: string; assignee: { fullName: string }; project?: { name: string } }[];
    devices: { id: string; code: string; name: string; category: string; purchaseCost: number; status: string; assignedTo?: { fullName: string } }[];
    users?: { id: string; fullName: string; role: string; departmentId: string }[];
  }>({ projects: [], tasks: [], devices: [], users: [] });

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [projectForm, setProjectForm] = useState({
    name: "",
    managerId: "",
    budget: "",
    description: "",
  });

  async function loadData() {
    const res = await fetch("/api/departments/it");
    if (res.ok) {
      const d = await res.json();
      setData(d);
      if (d.users?.length && !projectForm.managerId) {
        const itLead = d.users.find((u: { role: string }) => u.role === "IT") || d.users[0];
        setProjectForm((f) => ({ ...f, managerId: itLead?.id || "" }));
      }
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/departments/it", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "PROJECT",
        name: projectForm.name,
        managerId: projectForm.managerId || undefined,
        budget: Number(projectForm.budget) || 0,
        description: projectForm.description,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setShowProjectModal(false);
      setProjectForm({ name: "", managerId: projectForm.managerId, budget: "", description: "" });
      setMsg(`Đã tạo dự án công nghệ "${d.project.name}" (${d.project.code}) thành công!`);
      await loadData();
    }
    setCreating(false);
  }

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Phòng IT — Dự án, Công việc & Thiết bị</h1>
            <p className="text-sm text-neutral-500">Quản lý tiến độ dự án công nghệ, công việc nhóm IT và tài sản thiết bị công ty</p>
          </div>
          <button
            onClick={() => setShowProjectModal(true)}
            className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Tạo dự án công nghệ mới
          </button>
        </div>

        {msg && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm">{msg}</div>
        )}

        {/* Projects */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-neutral-900">
              <FolderKanban className="w-5 h-5 text-amber-600" /> Dự án công nghệ ({data.projects.length})
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-neutral-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-mono text-amber-600 font-semibold">{p.code}</div>
                    <div className="font-semibold text-neutral-900">{p.name}</div>
                    {p.description && <div className="text-xs text-neutral-500 mt-0.5">{p.description}</div>}
                    <div className="text-xs text-neutral-500 mt-0.5">Phụ trách: {p.manager.fullName}</div>
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
                  <td className="px-4 py-3 text-xs">{DEVICE_CATEGORY_LABELS[d.category] || d.category}</td>
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
        {showProjectModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900">Tạo dự án công nghệ mới</h3>
                <button onClick={() => setShowProjectModal(false)} className="p-1 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Tên dự án *</label>
                  <input
                    required
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    placeholder="VD: Nâng cấp hệ thống CRM nội bộ..."
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Người phụ trách</label>
                  <select
                    value={projectForm.managerId}
                    onChange={(e) => setProjectForm({ ...projectForm, managerId: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {(data.users || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Ngân sách dự kiến (VNĐ)</label>
                  <input
                    type="number"
                    min={0}
                    value={projectForm.budget}
                    onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                    placeholder="VD: 15000000"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Mô tả / Mục tiêu dự án</label>
                  <textarea
                    rows={3}
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    placeholder="Mô tả ngắn gọn phạm vi, công nghệ hoặc mục tiêu..."
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProjectModal(false)}
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
