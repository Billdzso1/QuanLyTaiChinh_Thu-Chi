"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND, formatDate } from "@/lib/finance";
import { ROLE_VI_LABELS } from "@/lib/labels";
import {
  Users,
  Shield,
  Plus,
  Clock,
  GraduationCap,
  Upload,
  X,
  Search,
  CheckCircle2,
  UserX,
  Lock,
  Unlock,
  RotateCcw,
  Save,
  KeyRound,
  FileText,
  ExternalLink,
} from "lucide-react";
import {
  PERMISSION_MODULES,
  PERMISSION_ROLES,
  PermissionAction,
  PermissionSet,
  RoleKey,
  ModuleKey,
  RolePermissionMatrix,
  getDefaultPermissionMatrix,
} from "@/lib/permissions";

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
  cvUrl?: string | null;
  recruitmentStatus?: string | null;
  statusNote?: string | null;
  interviewAt?: string | null;
  department: { id: string; code: string; name: string };
}

const RECRUITMENT_STATUS_OPTIONS = [
  { value: "CHO_PHONG_VAN", label: "Chờ phỏng vấn", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "DANG_PHONG_VAN", label: "Đang phỏng vấn", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  { value: "CHO_KET_QUA", label: "Chờ kết quả", cls: "bg-violet-100 text-violet-800 border-violet-200" },
  { value: "DAT", label: "Đạt", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "KHONG_DAT", label: "Không đạt", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "THUC_TAP", label: "Đang thực tập", cls: "bg-sky-100 text-sky-800 border-sky-200" },
  { value: "CHINH_THUC", label: "Nhân viên chính thức", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
] as const;

function getNextEmployeeCode(list: Employee[]): string {
  let maxNum = 16;
  for (const u of list) {
    const m = u.employeeCode.match(/NDA-(\d+)/);
    if (m) maxNum = Math.max(maxNum, Number(m[1]));
  }
  return `NDA-${String(maxNum + 1).padStart(3, "0")}`;
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

  const [mainTab, setMainTab] = useState<"EMPLOYEES" | "PERMISSIONS">("EMPLOYEES");
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [permMatrix, setPermMatrix] = useState<RolePermissionMatrix>(() => getDefaultPermissionMatrix());
  const [userOverrides, setUserOverrides] = useState<
    Record<string, Partial<Record<ModuleKey, PermissionSet>>>
  >({});
  const [savingPerms, setSavingPerms] = useState(false);
  const [permMessage, setPermMessage] = useState("");
  const [permUserModal, setPermUserModal] = useState<Employee | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvFileName, setCvFileName] = useState("");

  const [form, setForm] = useState({
    employeeCode: "NDA-020",
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
    cvUrl: "",
    recruitmentStatus: "CHINH_THUC",
    statusNote: "",
    interviewAt: "",
  });

  function mapRoleToDeptCode(role: string): string {
    if (role === "ACCOUNTANT") return "ACCOUNTING";
    if (role === "ADMIN" || role === "LANDLORD") return "DIRECTOR";
    return role;
  }

  function suggestPosition(role: string, employmentType: string): string {
    const isIntern = employmentType === "INTERN";
    const map: Record<string, string> = {
      SALES: isIntern ? "Thực tập sinh Sales" : "Nhân viên Sales",
      IT: isIntern ? "Thực tập sinh IT" : "Nhân viên IT",
      MARKETING: isIntern ? "Thực tập sinh Marketing" : "Nhân viên Marketing",
      ACCOUNTANT: isIntern ? "Thực tập sinh Kế toán" : "Nhân viên Kế toán",
      ADMIN: "Giám đốc",
      LANDLORD: "Chủ trọ / Đối tác",
    };
    return map[role] || (isIntern ? "Thực tập sinh" : "Nhân viên");
  }

  function handleRoleDeptSelect(nextRole: string, deptList = departments, empType = form.employmentType) {
    const targetCode = mapRoleToDeptCode(nextRole);
    const matchedDept = deptList.find((d) => d.code === targetCode) || deptList[0];
    setForm((f) => ({
      ...f,
      role: nextRole,
      departmentId: matchedDept?.id || f.departmentId,
      position: suggestPosition(nextRole, empType),
    }));
  }

  async function loadData() {
    const [empRes, meRes, permRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/auth/me"),
      fetch("/api/permissions"),
    ]);
    if (empRes.ok) {
      const d = await empRes.json();
      setUsers(d.users);
      setDepartments(d.departments);
      const nextCode = getNextEmployeeCode(d.users || []);
      const salesDept = (d.departments || []).find((dep: Dept) => dep.code === "SALES") || d.departments?.[0];
      setForm((f) => ({
        ...f,
        employeeCode: nextCode,
        departmentId: f.departmentId || salesDept?.id || "",
      }));
    }
    if (meRes.ok) {
      const m = await meRes.json();
      if (m.user) setCurrentUser({ id: m.user.id, role: m.user.role });
    }
    if (permRes.ok) {
      const p = await permRes.json();
      if (p.matrix) setPermMatrix(p.matrix);
      if (p.userOverrides) setUserOverrides(p.userOverrides);
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

  async function handleFormCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    const url = await uploadImage(file);
    if (url) {
      setForm((f) => ({ ...f, cvUrl: url }));
      setCvFileName(file.name);
    }
    setUploadingCv(false);
  }

  async function handleQuickCvUpload(userId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, cvUrl: url }),
      });
      loadData();
    }
  }

  async function handleQuickStatusChange(userId: string, recruitmentStatus: string) {
    await fetch("/api/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, recruitmentStatus }),
    });
    loadData();
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
      setCvFileName("");
      setForm({
        ...form,
        employeeCode: getNextEmployeeCode(users),
        email: "",
        fullName: "",
        phone: "",
        avatar: "",
        university: "",
        mentorName: "",
        cvUrl: "",
        statusNote: "",
        interviewAt: "",
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

  async function handleToggleLock(u: Employee) {
    const nextActive = !u.isActive;
    const actionLabel = nextActive ? "mở khóa" : "khóa";
    if (!window.confirm(`Xác nhận ${actionLabel} tài khoản của ${u.fullName} (${u.email})?`)) return;
    const res = await fetch("/api/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, isActive: nextActive }),
    });
    if (res.ok) {
      loadData();
    }
  }

  function toggleRolePerm(role: RoleKey, mod: ModuleKey, action: PermissionAction) {
    setPermMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [mod]: {
          ...prev[role][mod],
          [action]: !prev[role][mod][action],
        },
      },
    }));
  }

  function toggleRoleAllForModule(role: RoleKey, mod: ModuleKey) {
    setPermMatrix((prev) => {
      const cur = prev[role][mod];
      const allOn = cur.view && cur.create && cur.edit && cur.delete;
      const nextVal = !allOn;
      return {
        ...prev,
        [role]: {
          ...prev[role],
          [mod]: { view: nextVal, create: nextVal, edit: nextVal, delete: nextVal },
        },
      };
    });
  }

  function toggleUserOverridePerm(userId: string, role: RoleKey, mod: ModuleKey, action: PermissionAction) {
    setUserOverrides((prev) => {
      const userMap = prev[userId] || {};
      const base = userMap[mod] || permMatrix[role]?.[mod] || { view: false, create: false, edit: false, delete: false };
      return {
        ...prev,
        [userId]: {
          ...userMap,
          [mod]: {
            ...base,
            [action]: !base[action],
          },
        },
      };
    });
  }

  async function savePermissions(targetUserId?: string) {
    setSavingPerms(true);
    setPermMessage("");
    const res = await fetch("/api/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matrix: permMatrix,
        userOverrides,
        userId: targetUserId,
      }),
    });
    setSavingPerms(false);
    if (res.ok) {
      setPermMessage("Đã lưu cấu hình phân quyền thành công!");
      setTimeout(() => setPermMessage(""), 3000);
    } else {
      const d = await res.json();
      setPermMessage(d.error || "Không thể lưu phân quyền");
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
          <div className="flex flex-wrap items-center gap-2">
            {currentUser?.role === "ADMIN" && (
              <div className="inline-flex rounded-xl bg-neutral-100 p-1 border border-neutral-200">
                <button
                  onClick={() => setMainTab("EMPLOYEES")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 ${
                    mainTab === "EMPLOYEES"
                      ? "bg-indigo-600 text-white shadow-sm shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Nhân sự &amp; Khóa TK
                </button>
                <button
                  onClick={() => setMainTab("PERMISSIONS")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 ${
                    mainTab === "PERMISSIONS"
                      ? "bg-indigo-600 text-white shadow-sm shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" /> Ma trận Phân quyền
                </button>
              </div>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm nhân sự / Thực tập sinh
            </button>
          </div>
        </div>

        {mainTab === "PERMISSIONS" && currentUser?.role === "ADMIN" ? (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50/70 to-white">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900">Ma trận Phân quyền (Permission Matrix)</h2>
                  <p className="text-xs text-neutral-500">
                    Bật/tắt 4 mức quyền (Xem • Thêm • Sửa • Xóa) cho từng vai trò / phòng ban.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {permMessage && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    {permMessage}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPermMatrix(getDefaultPermissionMatrix())}
                  className="px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-xs font-medium text-neutral-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Mặc định
                </button>
                <button
                  type="button"
                  disabled={savingPerms}
                  onClick={() => savePermissions()}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-600 hover:to-sky-600 text-white shadow-sm shadow-cyan-500/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {savingPerms ? "Đang lưu..." : "Lưu cấu hình phân quyền"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="px-4 py-3 text-xs font-bold uppercase text-neutral-500 min-w-[210px]">
                      Phân hệ &amp; Chức năng
                    </th>
                    {PERMISSION_ROLES.map((r) => (
                      <th key={r.key} className="px-3 py-3 text-center min-w-[155px]">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${r.badgeClass}`}
                        >
                          {r.label}
                        </span>
                        <div className="text-[10px] font-normal text-neutral-500 mt-1">{r.desc}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {PERMISSION_MODULES.map((m) => (
                    <tr key={m.key} className="hover:bg-amber-50/20">
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-sm text-neutral-900">{m.label}</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">{m.desc}</div>
                      </td>
                      {PERMISSION_ROLES.map((r) => {
                        const cell = permMatrix[r.key]?.[m.key] || {
                          view: false,
                          create: false,
                          edit: false,
                          delete: false,
                        };
                        const allOn = cell.view && cell.create && cell.edit && cell.delete;
                        return (
                          <td key={r.key} className="px-2.5 py-3 align-top">
                            <div className="grid grid-cols-2 gap-1.5 max-w-[140px] mx-auto">
                              {(
                                [
                                  { k: "view", label: "Xem", on: "bg-emerald-50 text-emerald-700 border-emerald-300" },
                                  { k: "create", label: "Thêm", on: "bg-amber-50 text-amber-800 border-amber-300" },
                                  { k: "edit", label: "Sửa", on: "bg-sky-50 text-sky-700 border-sky-300" },
                                  { k: "delete", label: "Xóa", on: "bg-rose-50 text-rose-700 border-rose-300" },
                                ] as const
                              ).map((btn) => {
                                const active = cell[btn.k];
                                return (
                                  <button
                                    key={btn.k}
                                    type="button"
                                    onClick={() => toggleRolePerm(r.key, m.key, btn.k)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                                      active
                                        ? btn.on
                                        : "bg-white text-neutral-400 border-neutral-200 hover:bg-neutral-50"
                                    }`}
                                  >
                                    {active ? "✓ " : ""}
                                    {btn.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="text-center mt-1.5">
                              <button
                                type="button"
                                onClick={() => toggleRoleAllForModule(r.key, m.key)}
                                className="text-[10px] font-medium text-neutral-500 hover:text-amber-700 cursor-pointer"
                              >
                                {allOn ? "Tắt hết" : "Bật toàn quyền"}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>

        {/* Lịch hẹn phỏng vấn sắp tới */}
        {users.some((u) => u.interviewAt || u.recruitmentStatus === "CHO_PHONG_VAN" || u.recruitmentStatus === "DANG_PHONG_VAN") && (
          <div className="bg-gradient-to-r from-sky-50 via-white to-amber-50/70 border border-sky-200 border-l-4 border-l-sky-500 rounded-xl p-4 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-sm text-neutral-950 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-600" />
                Lịch hẹn phỏng vấn ({users.filter((u) => u.interviewAt || u.recruitmentStatus === "CHO_PHONG_VAN" || u.recruitmentStatus === "DANG_PHONG_VAN").length})
              </div>
              <span className="text-[11px] text-sky-800 font-medium">Hiển thị các hồ sơ có lịch hẹn / đang chờ phỏng vấn</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {users
                .filter((u) => u.interviewAt || u.recruitmentStatus === "CHO_PHONG_VAN" || u.recruitmentStatus === "DANG_PHONG_VAN")
                .map((u) => {
                  const st = RECRUITMENT_STATUS_OPTIONS.find((o) => o.value === u.recruitmentStatus);
                  return (
                    <div
                      key={u.id}
                      className="p-3 rounded-lg bg-white border border-sky-100 hover:border-sky-300 transition-all flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-neutral-900 truncate">
                          {u.fullName} <span className="font-mono text-amber-700">({u.employeeCode})</span>
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">
                          {u.department.name} • {u.position}
                        </div>
                        <div className="text-[11px] font-semibold text-sky-700 mt-1">
                          {u.interviewAt
                            ? `📅 ${new Date(u.interviewAt).toLocaleString("vi-VN")}`
                            : "⏳ Chưa ấn định giờ PV"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {st && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${st.cls}`}>
                            {st.label}
                          </span>
                        )}
                        {u.cvUrl && (
                          <a
                            href={u.cvUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-semibold text-rose-700 hover:underline"
                          >
                            Xem CV
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

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
          {departments.map((d, idx) => {
            const deptThemes: Record<string, { card: string; num: string; badge: string }> = {
              ACCOUNTING: {
                card: "border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/70",
                num: "text-emerald-700",
                badge: "bg-emerald-100 text-emerald-700",
              },
              DIRECTOR: {
                card: "border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/80",
                num: "text-amber-700",
                badge: "bg-amber-100 text-amber-800",
              },
              IT: {
                card: "border-l-4 border-l-violet-500 bg-gradient-to-br from-white to-violet-50/70",
                num: "text-violet-700",
                badge: "bg-violet-100 text-violet-700",
              },
              MARKETING: {
                card: "border-l-4 border-l-rose-500 bg-gradient-to-br from-white to-rose-50/70",
                num: "text-rose-700",
                badge: "bg-rose-100 text-rose-700",
              },
              SALES: {
                card: "border-l-4 border-l-sky-500 bg-gradient-to-br from-white to-sky-50/70",
                num: "text-sky-700",
                badge: "bg-sky-100 text-sky-700",
              },
            };
            const fallbackThemes = Object.values(deptThemes);
            const theme = deptThemes[d.code] || fallbackThemes[idx % fallbackThemes.length];
            return (
              <div
                key={d.id}
                className={`p-4 rounded-xl border border-neutral-200 ${theme.card} transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-neutral-600">{d.name}</div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${theme.badge}`}>{d.code}</span>
                </div>
                <div className={`text-2xl font-bold mt-1.5 tabular-nums ${theme.num}`}>{d._count.users}</div>
                <div className="text-[11px] text-neutral-500">nhân sự</div>
              </div>
            );
          })}
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
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20"
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
                  <th className="px-4 py-3">Nhóm quyền / Trạng thái</th>
                  <th className="px-4 py-3 text-right">Lương / Trợ cấp</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className={`hover:bg-neutral-50 ${!u.isActive ? "bg-rose-50/40" : ""}`}>
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
                            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white shadow-sm flex items-center justify-center font-bold text-xs border border-amber-500/40">
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
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {currentUser?.role === "ADMIN" ? (
                          <select
                            value={
                              u.recruitmentStatus ||
                              (u.employmentType === "INTERN" ? "THUC_TAP" : "CHINH_THUC")
                            }
                            onChange={(e) => handleQuickStatusChange(u.id, e.target.value)}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer ${
                              RECRUITMENT_STATUS_OPTIONS.find(
                                (o) =>
                                  o.value ===
                                  (u.recruitmentStatus ||
                                    (u.employmentType === "INTERN" ? "THUC_TAP" : "CHINH_THUC"))
                              )?.cls || "bg-neutral-100 text-neutral-700 border-neutral-200"
                            }`}
                          >
                            {RECRUITMENT_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value} className="bg-white text-neutral-900">
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          u.recruitmentStatus && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                RECRUITMENT_STATUS_OPTIONS.find((o) => o.value === u.recruitmentStatus)?.cls ||
                                "bg-neutral-100 text-neutral-700 border-neutral-200"
                              }`}
                            >
                              {RECRUITMENT_STATUS_OPTIONS.find((o) => o.value === u.recruitmentStatus)?.label ||
                                u.recruitmentStatus}
                            </span>
                          )
                        )}
                        {u.cvUrl ? (
                          <a
                            href={u.cvUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold"
                          >
                            <FileText className="w-3 h-3" /> Xem CV (PDF) <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          currentUser?.role === "ADMIN" && (
                            <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-medium cursor-pointer">
                              <Upload className="w-3 h-3" /> Nộp CV PDF
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => handleQuickCvUpload(u.id, e)}
                                className="hidden"
                              />
                            </label>
                          )
                        )}
                      </div>
                      {u.interviewAt && (
                        <div className="text-[11px] text-sky-700 mt-0.5 font-medium">
                          📅 Phỏng vấn dự kiến: {new Date(u.interviewAt).toLocaleString("vi-VN")}
                        </div>
                      )}
                      {u.statusNote && (
                        <div className="text-[11px] text-neutral-500 mt-0.5 italic">
                          Ghi chú: {u.statusNote}
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
                      <div className="flex flex-col gap-1.5 items-start">
                        {(() => {
                          const roleClsMap: Record<string, string> = {
                            ADMIN: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-2xs",
                            ACCOUNTANT: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-2xs",
                            SALES: "bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-2xs",
                            IT: "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-2xs",
                            MARKETING: "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-2xs",
                            LANDLORD: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs",
                          };
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-transform duration-200 hover:scale-105 ${
                                roleClsMap[u.role] || "bg-slate-700 text-white"
                              }`}
                            >
                              <Shield className="w-3 h-3" /> {ROLE_VI_LABELS[u.role] || u.role}
                            </span>
                          );
                        })()}
                        <button
                          onClick={() => toggleTeamLead(u)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all hover:scale-105 cursor-pointer ${
                            u.isTeamLead
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {u.isTeamLead ? "★ Phụ trách nhóm" : "Thành viên"}
                        </button>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                            }`}
                          />
                          {u.isActive ? "Đang hoạt động" : "Đã khóa / Chờ duyệt"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{formatVND(u.baseSalary)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        {currentUser?.role === "ADMIN" && (
                          <>
                            <button
                              onClick={() => setPermUserModal(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium cursor-pointer"
                              title="Cấp quyền riêng (Xem/Thêm/Sửa/Xóa) cho nhân viên này"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Cấp quyền
                            </button>
                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => handleToggleLock(u)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                  u.isActive
                                    ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {u.isActive ? (
                                  <>
                                    <Lock className="w-3.5 h-3.5" /> Khóa TK
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" /> Mở khóa
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => openAttendanceDetail(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" /> Chấm công
                        </button>
                      </div>
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
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white shadow-sm text-xs font-medium cursor-pointer">
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
                      onChange={(e) => {
                        const empType = e.target.value;
                        setForm((f) => ({
                          ...f,
                          employmentType: empType,
                          recruitmentStatus: empType === "INTERN" ? "THUC_TAP" : "CHINH_THUC",
                          position: suggestPosition(f.role, empType),
                        }));
                      }}
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
                      placeholder="VD: NDA-020"
                      value={form.employeeCode}
                      onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Họ và tên</label>
                    <input
                      required
                      placeholder="Nhập họ và tên"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email đăng nhập</label>
                    <input
                      type="email"
                      required
                      placeholder="ten@ndahome.vn"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Phòng ban &amp; Quyền hạn</label>
                    <select
                      value={form.role}
                      onChange={(e) => handleRoleDeptSelect(e.target.value)}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="SALES">Phòng Sales</option>
                      <option value="IT">Phòng IT</option>
                      <option value="MARKETING">Phòng Marketing</option>
                      <option value="ACCOUNTANT">Phòng Kế toán</option>
                      <option value="ADMIN">Ban Giám đốc (Admin)</option>
                      <option value="LANDLORD">Chủ trọ / Đối tác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Vị trí / Chức danh</label>
                    <input
                      placeholder="VD: Chuyên viên Sales"
                      value={form.position}
                      onChange={(e) => setForm({ ...form, position: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    {form.employmentType === "INTERN" ? "Trợ cấp thực tập (VNĐ)" : "Lương cơ bản (VNĐ)"}
                  </label>
                  <input
                    type="number"
                    placeholder="2000000"
                    value={form.baseSalary}
                    onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
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

                {/* Nộp CV PDF & Trạng thái hồ sơ */}
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                  <div className="text-xs font-semibold text-neutral-900">Hồ sơ CV (PDF) &amp; Trạng thái xét duyệt</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">Trạng thái</label>
                      <select
                        value={form.recruitmentStatus}
                        onChange={(e) => setForm({ ...form, recruitmentStatus: e.target.value })}
                        className="w-full border border-neutral-300 bg-white rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        {RECRUITMENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">Thời gian phỏng vấn dự kiến</label>
                      <input
                        type="datetime-local"
                        value={form.interviewAt}
                        onChange={(e) => setForm({ ...form, interviewAt: e.target.value })}
                        className="w-full border border-neutral-300 bg-white rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-50 border border-neutral-300 text-xs font-medium text-neutral-800 cursor-pointer">
                      <FileText className="w-3.5 h-3.5 text-rose-600" />
                      {uploadingCv ? "Đang tải..." : form.cvUrl ? "Đổi CV (PDF)" : "Nộp file CV (PDF)"}
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFormCvUpload}
                        className="hidden"
                      />
                    </label>
                    {form.cvUrl && (
                      <a
                        href={form.cvUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-rose-700 hover:underline truncate max-w-[200px]"
                        title={cvFileName || "Xem CV PDF"}
                      >
                        {cvFileName || "Xem CV đã tải"}
                      </a>
                    )}
                  </div>
                  <input
                    placeholder="Ghi chú trạng thái (VD: Hẹn phỏng vấn 14h thứ 5, Chờ kết quả vòng 2...)"
                    value={form.statusNote}
                    onChange={(e) => setForm({ ...form, statusNote: e.target.value })}
                    className="w-full border border-neutral-300 bg-white rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>

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
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-sm cursor-pointer"
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
                    <div className="w-11 h-11 rounded-full bg-indigo-600 text-white shadow-sm flex items-center justify-center font-bold">
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
        {/* Modal Cấp quyền riêng theo nhân sự */}
        {permUserModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-6 sm:pt-10 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-[0_25px_70px_-15px_rgba(0,0,0,0.45)] border border-amber-400/50">
              {/* Luxury Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 text-white border-b border-amber-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/50 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-amber-400 truncate">
                        Cấp quyền riêng: {permUserModal.fullName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 font-mono text-[11px] text-amber-200">
                        {permUserModal.employeeCode}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-0.5">
                      Phòng ban: <span className="text-white font-medium">{permUserModal.department.name}</span> • Vai trò gốc:{" "}
                      <span className="text-amber-300 font-medium">
                        {ROLE_VI_LABELS[permUserModal.role] || permUserModal.role}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPermUserModal(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Actions Bar */}
              <div className="px-6 py-2.5 bg-amber-50/70 border-b border-amber-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-neutral-700 font-medium">
                  Chọn nhanh quyền <strong>Xem • Thêm • Sửa • Xóa</strong> cho từng phân hệ
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allFull: Partial<Record<ModuleKey, PermissionSet>> = {};
                      for (const m of PERMISSION_MODULES) {
                        allFull[m.key] = { view: true, create: true, edit: true, delete: true };
                      }
                      setUserOverrides((prev) => ({ ...prev, [permUserModal.id]: allFull }));
                    }}
                    className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer transition-colors"
                  >
                    ✓ Bật toàn quyền
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allNone: Partial<Record<ModuleKey, PermissionSet>> = {};
                      for (const m of PERMISSION_MODULES) {
                        allNone[m.key] = { view: false, create: false, edit: false, delete: false };
                      }
                      setUserOverrides((prev) => ({ ...prev, [permUserModal.id]: allNone }));
                    }}
                    className="px-2.5 py-1 rounded-md bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px] cursor-pointer transition-colors"
                  >
                    Tắt tất cả
                  </button>
                </div>
              </div>

              {/* Module List */}
              <div className="p-4 sm:p-5 max-h-[58vh] overflow-y-auto space-y-2.5 bg-neutral-50/50">
                {PERMISSION_MODULES.map((m) => {
                  const roleKey = (
                    permUserModal.employmentType === "INTERN" ? "INTERN" : permUserModal.role || "SALES"
                  ) as RoleKey;
                  const cell =
                    userOverrides[permUserModal.id]?.[m.key] ||
                    permMatrix[roleKey]?.[m.key] || { view: false, create: false, edit: false, delete: false };
                  const allOn = cell.view && cell.create && cell.edit && cell.delete;
                  return (
                    <div
                      key={m.key}
                      className="p-3.5 rounded-xl bg-white border border-neutral-200/90 hover:border-amber-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-neutral-900">{m.label}</span>
                          {allOn && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                              Toàn quyền
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">{m.desc}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {(
                          [
                            {
                              k: "view",
                              label: "Xem",
                              on: "bg-emerald-50 text-emerald-700 border-emerald-400 shadow-2xs",
                            },
                            {
                              k: "create",
                              label: "Thêm",
                              on: "bg-amber-50 text-amber-800 border-amber-400 shadow-2xs",
                            },
                            {
                              k: "edit",
                              label: "Sửa",
                              on: "bg-sky-50 text-sky-700 border-sky-400 shadow-2xs",
                            },
                            {
                              k: "delete",
                              label: "Xóa",
                              on: "bg-rose-50 text-rose-700 border-rose-400 shadow-2xs",
                            },
                          ] as const
                        ).map((btn) => {
                          const active = cell[btn.k];
                          return (
                            <button
                              key={btn.k}
                              type="button"
                              onClick={() => toggleUserOverridePerm(permUserModal.id, roleKey, m.key, btn.k)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                active
                                  ? btn.on
                                  : "bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-600"
                              }`}
                            >
                              {active ? "✓ " : ""}
                              {btn.label}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !allOn;
                            setUserOverrides((prev) => ({
                              ...prev,
                              [permUserModal.id]: {
                                ...(prev[permUserModal.id] || {}),
                                [m.key]: { view: nextVal, create: nextVal, edit: nextVal, delete: nextVal },
                              },
                            }));
                          }}
                          className="ml-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-neutral-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                          title={allOn ? "Tắt hết mục này" : "Bật hết mục này"}
                        >
                          {allOn ? "Tắt" : "Hết"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-white border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserOverrides((prev) => {
                      const copy = { ...prev };
                      delete copy[permUserModal.id];
                      return copy;
                    });
                  }}
                  className="px-3.5 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Đặt lại theo vai trò
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPermUserModal(null)}
                    className="px-4 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={savingPerms}
                    onClick={async () => {
                      await savePermissions(permUserModal.id);
                      setPermUserModal(null);
                    }}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> {savingPerms ? "Đang lưu..." : "Lưu quyền nhân sự"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </AppShell>
  );
}
