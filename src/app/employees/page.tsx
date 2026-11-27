"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND, formatDate } from "@/lib/finance";
import { ROLE_VI_LABELS } from "@/lib/labels";
import { Users, Shield, Plus, Clock, GraduationCap, Upload, X, Search, CheckCircle2, UserX } from "lucide-react";

interface Employee {
  id: string;
  employeeCode: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string | null;
  role: string;
  position: string;
  employmentType: string;
  university?: string | null;
  internshipStart?: string | null;
  internshipEnd?: string | null;
  mentorName?: string | null;
  isTeamLead: boolean;
  isActive: boolean;
  baseSalary: number;
  allowance: number;
  department: { id: string; code: string; name: string };
}

interface Dept {
  id: string;
  code: string;
  name: string;
  description?: string;
  _count: { users: number };
}

interface AttendanceDetail {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  workHours: number;
  overtimeHours: number;
  status: string;
  isConfirmed: boolean;
}

export default function EmployeesPage() {
  const [users, setUsers] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "FULL_TIME" | "INTERN" | "PENDING">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [detailUser, setDetailUser] = useState<Employee | null>(null);
  const [detailAttendances, setDetailAttendances] = useState<AttendanceDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [form, setForm] = useState({
    employeeCode: "NDA-017",
    email: "",
    fullName: "",
    phone: "",
    avatar: "",
    role: "SALES",
    position: "Nhân viên Sales",
    employmentType: "FULL_TIME",
    university: "",
    internshipStart: "",
    internshipEnd: "",
    mentorName: "",
    departmentId: "",
    baseSalary: "2000000",
    allowance: "500000",
    isTeamLead: false,
  });

  async function loadData() {
    const res = await fetch("/api/employees");
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users);
      setDepartments(d.departments);
      if (d.departments?.length && !form.departmentId) {
        setForm((f) => ({ ...f, departmentId: d.departments[0].id }));
      }
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadImage(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const d = await res.json();
    return d.url || null;
  }

  async function handleFormAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const url = await uploadImage(file);
    if (url) setForm((f) => ({ ...f, avatar: url }));
    setUploadingAvatar(false);
  }

  async function handleQuickAvatarUpdate(userId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, avatar: url }),
      });
      loadData();
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({
        ...form,
        employeeCode: `NDA-0${users.length + 2}`,
        email: "",
        fullName: "",
        phone: "",
        avatar: "",
        university: "",
        mentorName: "",
      });
      loadData();
    }
  }

  async function toggleTeamLead(u: Employee) {
    await fetch("/api/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, isTeamLead: !u.isTeamLead }),
    });
    loadData();
  }

  async function openAttendanceDetail(u: Employee) {
    setDetailUser(u);
    setDetailLoading(true);
    const res = await fetch(`/api/attendance?userId=${u.id}`);
    if (res.ok) {
      const d = await res.json();
      setDetailAttendances(d.attendances || []);
    }
    setDetailLoading(false);
  }

  async function handleApproveUser(userId: string) {
    const res = await fetch("/api/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, isActive: true }),
    });
    if (res.ok) {
      loadData();
    }
  }

  async function handleRejectUser(u: Employee) {
    if (!window.confirm(`Từ chối và xóa yêu cầu đăng ký của ${u.fullName} (${u.email})?`)) return;
    const res = await fetch(`/api/employees?id=${u.id}`, { method: "DELETE" });
    if (res.ok) {
      loadData();
    }
  }

  const pendingUsers = users.filter((u) => !u.isActive);
  const fullTimeCount = users.filter((u) => u.employmentType !== "INTERN").length;
  const internCount = users.filter((u) => u.employmentType === "INTERN").length;
  const filteredUsers = users.filter((u) => {
    if (typeFilter === "PENDING" && u.isActive) return false;
    if (typeFilter === "FULL_TIME" && u.employmentType === "INTERN") return false;
    if (typeFilter === "INTERN" && u.employmentType !== "INTERN") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.employeeCode.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalHours = detailAttendances.reduce((s, a) => s + a.workHours, 0);
  const lateDays = detailAttendances.filter((a) => a.status === "LATE").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Nhân sự, Thực tập sinh & Phân quyền</h1>
            <p className="text-sm text-neutral-500">
              {fullTimeCount} nhân viên chính thức • {internCount} thực tập sinh thuộc {departments.length} phòng ban
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm nhân sự / Thực tập sinh
          </button>
        </div>

        {/* Tài khoản mới đăng ký chờ Admin duyệt */}
        {pendingUsers.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-sm text-neutral-950 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                Tài khoản đăng ký mới đang chờ Admin duyệt ({pendingUsers.length})
              </div>
              <span className="text-xs text-amber-800">Chỉ sau khi duyệt, nhân sự mới có thể đăng nhập.</span>
            </div>
            <div className="divide-y divide-amber-200 bg-white rounded-lg border border-amber-200">
              {pendingUsers.map((pu) => (
                <div key={pu.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-neutral-900">
                      {pu.fullName}{" "}
                      <span className="text-xs font-mono text-amber-700">({pu.employeeCode})</span>
                    </div>
                    <div className="text-xs text-neutral-500">
                      {pu.email} {pu.phone ? `• ${pu.phone}` : ""} • {pu.department.name} •{" "}
                      {pu.employmentType === "INTERN" ? "Thực tập sinh" : "Chính thức"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveUser(pu.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt kích hoạt
                    </button>
                    <button
                      onClick={() => handleRejectUser(pu)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" /> Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Departments */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {departments.map((d) => (
            <div
              key={d.id}
              className="bg-white p-4 rounded-xl border border-neutral-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="text-xs font-medium text-neutral-500">{d.name}</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{d._count.users}</div>
              <div className="text-[11px] text-neutral-400">nhân sự</div>
            </div>
          ))}
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "ALL", label: `Tất cả (${users.length})` },
              { key: "FULL_TIME", label: `Nhân viên chính thức (${fullTimeCount})` },
              { key: "INTERN", label: `Thực tập sinh (${internCount})` },
              { key: "PENDING", label: `Chờ duyệt (${pendingUsers.length})` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key as typeof typeFilter)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  typeFilter === t.key
                    ? "bg-neutral-950 text-amber-400 border border-amber-500"
                    : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2" />
            <input
              placeholder="Tìm tên, mã NV, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white w-56"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2 font-semibold text-neutral-900">
            <Users className="w-5 h-5 text-amber-600" /> Danh sách nhân sự & thực tập sinh
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Ảnh / Mã NV</th>
                  <th className="px-4 py-3">Họ và tên / Thông tin</th>
                  <th className="px-4 py-3">Loại hình</th>
                  <th className="px-4 py-3">Phòng ban</th>
                  <th className="px-4 py-3">Nhóm quyền</th>
                  <th className="px-4 py-3 text-right">Lương / Trợ cấp</th>
                  <th className="px-4 py-3 text-right">Chi tiết chấm công</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <label className="cursor-pointer group relative" title="Bấm để đổi ảnh đại diện">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.fullName}
                              className="w-10 h-10 rounded-full object-cover border border-amber-500/60"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-neutral-950 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/40">
                              {u.fullName.split(" ").slice(-1)[0]?.[0] || "N"}
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleQuickAvatarUpdate(u.id, e)}
                            className="hidden"
                          />
                        </label>
                        <span className="font-mono text-xs font-semibold text-neutral-700">{u.employeeCode}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">{u.fullName}</div>
                      <div className="text-xs text-neutral-400">{u.email}</div>
                      {u.employmentType === "INTERN" && (u.university || u.mentorName) && (
                        <div className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {u.university || "Sinh viên thực tập"}
                          {u.mentorName ? ` • HD: ${u.mentorName}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.employmentType === "INTERN"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {u.employmentType === "INTERN" ? "Thực tập sinh" : "Chính thức"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{u.department.name}</div>
                      <div className="text-neutral-400">{u.position}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-medium">
                          <Shield className="w-3 h-3" /> {ROLE_VI_LABELS[u.role] || u.role}
                        </span>
                        <button
                          onClick={() => toggleTeamLead(u)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                            u.isTeamLead ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {u.isTeamLead ? "Phụ trách nhóm" : "Thành viên"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{formatVND(u.baseSalary)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openAttendanceDetail(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" /> Xem chấm công
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Thêm nhân sự / Thực tập sinh */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 my-8">
              <h3 className="text-lg font-bold">Thêm Nhân sự / Thực tập sinh</h3>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="flex items-center gap-4">
                  {form.avatar ? (
                    <img src={form.avatar} alt="Avatar" className="w-14 h-14 rounded-full object-cover border border-amber-500" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center text-xs text-neutral-500">
                      Ảnh
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-950 text-amber-400 text-xs font-medium cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingAvatar ? "Đang tải..." : "Tải ảnh nhân sự"}
                    <input type="file" accept="image/*" onChange={handleFormAvatarUpload} className="hidden" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Loại hình nhân sự</label>
                    <select
                      value={form.employmentType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          employmentType: e.target.value,
                          position: e.target.value === "INTERN" ? "Sinh viên thực tập" : "Nhân viên",
                        })
                      }
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="FULL_TIME">Nhân viên chính thức</option>
                      <option value="INTERN">Thực tập sinh (Sinh viên)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Mã nhân sự</label>
                    <input
                      required
                      placeholder="VD: NDA-017"
                      value={form.employeeCode}
                      onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    placeholder="Họ và tên"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email (@ndahome.vn)"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="SALES">Sales</option>
                    <option value="IT">IT</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="ACCOUNTANT">Kế toán</option>
                    <option value="ADMIN">Giám đốc</option>
                  </select>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder={form.employmentType === "INTERN" ? "Trợ cấp thực tập" : "Lương cơ bản"}
                    value={form.baseSalary}
                    onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Chức danh"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {form.employmentType === "INTERN" && (
                  <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-2.5">
                    <div className="text-xs font-semibold text-sky-900">Thông tin thực tập sinh</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Trường đang theo học"
                        value={form.university}
                        onChange={(e) => setForm({ ...form, university: e.target.value })}
                        className="border border-sky-200 bg-white rounded-lg px-3 py-1.5 text-xs"
                      />
                      <input
                        placeholder="Người hướng dẫn (Mentor)"
                        value={form.mentorName}
                        onChange={(e) => setForm({ ...form, mentorName: e.target.value })}
                        className="border border-sky-200 bg-white rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-sky-800 mb-0.5">Bắt đầu thực tập</label>
                        <input
                          type="date"
                          value={form.internshipStart}
                          onChange={(e) => setForm({ ...form, internshipStart: e.target.value })}
                          className="w-full border border-sky-200 bg-white rounded-lg px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-sky-800 mb-0.5">Kết thúc dự kiến</label>
                        <input
                          type="date"
                          value={form.internshipEnd}
                          onChange={(e) => setForm({ ...form, internshipEnd: e.target.value })}
                          className="w-full border border-sky-200 bg-white rounded-lg px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg border text-sm cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer"
                  >
                    Tạo tài khoản
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Chi tiết chấm công nhân sự */}
        {detailUser && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-3">
                  {detailUser.avatar ? (
                    <img src={detailUser.avatar} alt={detailUser.fullName} className="w-11 h-11 rounded-full object-cover border border-amber-500" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-neutral-950 text-amber-400 flex items-center justify-center font-bold">
                      {detailUser.fullName.split(" ").slice(-1)[0]?.[0] || "N"}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-neutral-950">Chi tiết chấm công — {detailUser.fullName}</h3>
                    <div className="text-xs text-neutral-500">
                      {detailUser.employeeCode} • {detailUser.department.name} •{" "}
                      {detailUser.employmentType === "INTERN" ? "Thực tập sinh" : "Nhân viên chính thức"}
                    </div>
                  </div>
                </div>
                <button onClick={() => setDetailUser(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-xs text-emerald-700">Số ngày công</div>
                  <div className="text-lg font-bold text-emerald-800">{detailAttendances.length} ngày</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-xs text-amber-700">Tổng giờ làm</div>
                  <div className="text-lg font-bold text-amber-800">{totalHours.toFixed(1)} giờ</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-xs text-rose-700">Số lần đi muộn</div>
                  <div className="text-lg font-bold text-rose-800">{lateDays} lần</div>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 border border-neutral-200 rounded-xl">
                {detailLoading ? (
                  <div className="p-6 text-center text-sm text-neutral-500">Đang tải chi tiết chấm công...</div>
                ) : detailAttendances.length === 0 ? (
                  <div className="p-6 text-center text-sm text-neutral-500">Chưa có dữ liệu chấm công.</div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-50 text-xs uppercase text-neutral-600 border-b border-neutral-200">
                      <tr>
                        <th className="px-4 py-2.5">Ngày</th>
                        <th className="px-4 py-2.5">Giờ vào</th>
                        <th className="px-4 py-2.5">Giờ ra</th>
                        <th className="px-4 py-2.5 text-right">Số giờ</th>
                        <th className="px-4 py-2.5">Trạng thái</th>
                        <th className="px-4 py-2.5">Kế toán</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {detailAttendances.map((a) => (
                        <tr key={a.id}>
                          <td className="px-4 py-2.5 font-medium">{formatDate(a.date)}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {a.checkIn ? new Date(a.checkIn).toLocaleTimeString("vi-VN") : "—"}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {a.checkOut ? new Date(a.checkOut).toLocaleTimeString("vi-VN") : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{a.workHours.toFixed(1)}h</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${
                                a.status === "LATE" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {a.status === "LATE" ? "Đi muộn" : "Đúng giờ"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {a.isConfirmed ? "Đã xác nhận" : "Chờ xác nhận"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
