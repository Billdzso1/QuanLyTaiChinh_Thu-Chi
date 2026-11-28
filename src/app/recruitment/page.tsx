"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND, formatDate } from "@/lib/finance";
import { getStatusLabel } from "@/lib/labels";
import { exportToExcel } from "@/lib/export";
import {
  Briefcase,
  Users,
  Plus,
  Upload,
  FileText,
  Pencil,
  Trash2,
  X,
  GraduationCap,
  BadgeDollarSign,
  UserPlus,
  Search,
  Download,
} from "lucide-react";

interface JobApp {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email?: string | null;
  position: string;
  departmentCode: string;
  applicantType: string;
  university?: string | null;
  expectedSalary: number;
  cvUrl?: string | null;
  interviewDate?: string | null;
  status: string;
  note?: string | null;
  createdAt: string;
}

interface MemberPayroll {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  salesRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  allowance: number;
  bonus: number;
  overtimePay: number;
  deduction: number;
  netSalary: number;
  status: string;
}

interface Member {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  role: string;
  position: string;
  employmentType: string;
  university?: string | null;
  mentorName?: string | null;
  baseSalary: number;
  allowance: number;
  kpiTarget: number;
  department: { id: string; code: string; name: string };
  payrolls: MemberPayroll[];
  _count: { attendances: number };
}

const APP_STATUS_LABELS: Record<string, string> = {
  NEW: "Mới nộp",
  INTERVIEWING: "Đang phỏng vấn",
  PASSED: "Đạt phỏng vấn",
  REJECTED: "Không đạt",
  ONBOARDED: "Đã nhận việc",
};

export default function RecruitmentDirectorPage() {
  const [tab, setTab] = useState<"APPLICATIONS" | "MEMBERS_SALARY">("APPLICATIONS");
  const [applications, setApplications] = useState<JobApp[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "FULL_TIME" | "INTERN">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "INTERVIEWING" | "PASSED" | "REJECTED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [selectedApp, setSelectedApp] = useState<JobApp | null>(null);

  const [showAppModal, setShowAppModal] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [appForm, setAppForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    position: "Nhân viên Sales",
    departmentCode: "SALES",
    applicantType: "FULL_TIME",
    university: "",
    expectedSalary: "6000000",
    cvUrl: "",
    interviewDate: "",
    status: "NEW",
    note: "",
  });

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberForm, setMemberForm] = useState({
    baseSalary: "0",
    allowance: "0",
    kpiTarget: "0",
    employmentType: "FULL_TIME",
    university: "",
    mentorName: "",
    position: "",
  });

  async function loadData() {
    const res = await fetch("/api/recruitment");
    if (res.ok) {
      const d = await res.json();
      setApplications(d.applications || []);
      setMembers(d.members || []);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveApp(e: React.FormEvent) {
    e.preventDefault();
    const res = editingAppId
      ? await fetch("/api/recruitment", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingAppId, ...appForm }),
        })
      : await fetch("/api/recruitment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appForm),
        });
    if (res.ok) {
      setShowAppModal(false);
      setEditingAppId(null);
      setAppForm({
        fullName: "",
        phone: "",
        email: "",
        position: "Nhân viên Sales",
        departmentCode: "SALES",
        applicantType: "FULL_TIME",
        university: "",
        expectedSalary: "6000000",
        cvUrl: "",
        interviewDate: "",
        status: "NEW",
        note: "",
      });
      loadData();
    }
  }

  async function handleQuickAppStatus(id: string, status: string) {
    await fetch("/api/recruitment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadData();
  }

  async function handleDeleteApp(app: JobApp) {
    if (!window.confirm(`Xóa hồ sơ ứng viên ${app.fullName}?`)) return;
    await fetch(`/api/recruitment?id=${app.id}`, { method: "DELETE" });
    loadData();
  }

  async function handleOnboard(app: JobApp) {
    if (!window.confirm(`Chuyển ứng viên "${app.fullName}" thành nhân sự chính thức/thực tập sinh trong hệ thống?`)) {
      return;
    }
    const res = await fetch("/api/recruitment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "ONBOARD", id: app.id }),
    });
    const d = await res.json();
    if (res.ok) {
      setMsg(`Đã nhận ${app.fullName} vào làm thành công (Mã NV: ${d.employeeCode}, mật khẩu mặc định: 123456)!`);
      setSelectedApp(null);
      loadData();
    } else {
      setMsg(d.error || "Không thể nhận ứng viên vào làm");
    }
  }

  async function handleSaveMemberSalary(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) return;
    const res = await fetch("/api/recruitment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "MEMBER_SALARY", id: selectedMember.id, ...memberForm }),
    });
    if (res.ok) {
      setSelectedMember(null);
      loadData();
    }
  }

  const filteredApps = applications.filter((a) => {
    if (typeFilter === "FULL_TIME" && a.applicantType !== "FULL_TIME") return false;
    if (typeFilter === "INTERN" && a.applicantType !== "INTERN") return false;
    if (statusFilter === "INTERVIEWING" && a.status !== "NEW" && a.status !== "INTERVIEWING") return false;
    if (statusFilter === "PASSED" && a.status !== "PASSED" && a.status !== "ONBOARDED") return false;
    if (statusFilter === "REJECTED" && a.status !== "REJECTED") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        a.position.toLowerCase().includes(q) ||
        (a.university || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredMembers = members.filter((m) => {
    if (typeFilter === "FULL_TIME") return m.employmentType !== "INTERN";
    if (typeFilter === "INTERN") return m.employmentType === "INTERN";
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.employeeCode.toLowerCase().includes(q) ||
        m.department.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const internMembersCount = members.filter((m) => m.employmentType === "INTERN").length;
  const interviewingCount = applications.filter((a) => a.status === "INTERVIEWING" || a.status === "NEW").length;
  const passedCount = applications.filter((a) => a.status === "PASSED" || a.status === "ONBOARDED").length;
  const rejectedCount = applications.filter((a) => a.status === "REJECTED").length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Quản lý Hồ sơ Xin việc & Lương Thành viên</h1>
            <p className="text-sm text-neutral-500">
              Trang dành riêng cho Giám đốc: theo dõi CV ứng viên, lịch phỏng vấn và chế độ lương/trợ cấp của toàn bộ nhân viên chính thức & thực tập sinh
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                tab === "APPLICATIONS"
                  ? exportToExcel(
                      filteredApps.map((a) => ({
                        Ma: a.code,
                        HoTen: a.fullName,
                        SDT: a.phone,
                        Email: a.email || "",
                        ViTri: a.position,
                        LoaiHinh: a.applicantType === "INTERN" ? "Thực tập sinh" : "Chính thức",
                        Truong: a.university || "",
                        LuongMongMuon: a.expectedSalary,
                        TrangThai: APP_STATUS_LABELS[a.status] || a.status,
                      })),
                      "NDAHOME_HoSoUngVien"
                    )
                  : exportToExcel(
                      filteredMembers.map((m) => ({
                        MaNV: m.employeeCode,
                        HoTen: m.fullName,
                        PhongBan: m.department.name,
                        LoaiHinh: m.employmentType === "INTERN" ? "Thực tập sinh" : "Chính thức",
                        LuongCoBan: m.baseSalary,
                        PhuCap: m.allowance,
                      })),
                      "NDAHOME_LuongThanhVien"
                    )
              }
              className="px-3.5 py-2 rounded-lg bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Xuất Excel
            </button>
            <button
              onClick={() => {
                setEditingAppId(null);
                setShowAppModal(true);
              }}
              className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm hồ sơ xin việc
            </button>
          </div>
        </div>

        {msg && <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm font-medium">{msg}</div>}

        {/* 4 Summary Cards (Click để lọc & xem ngay) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => {
              setTab("APPLICATIONS");
              setStatusFilter("ALL");
            }}
            className={`text-left bg-gradient-to-br from-white to-amber-50/70 p-5 rounded-xl border border-l-4 border-l-amber-500 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg cursor-pointer ${
              tab === "APPLICATIONS" && statusFilter === "ALL" ? "border-amber-500 ring-2 ring-amber-400/40" : "border-neutral-200"
            }`}
          >
            <div className="text-xs text-neutral-600 font-medium">Tổng hồ sơ xin việc</div>
            <div className="text-xl font-bold text-amber-700 mt-1">{applications.length} hồ sơ</div>
            <div className="text-[11px] text-neutral-400 mt-1">Bấm để xem tất cả →</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("APPLICATIONS");
              setStatusFilter("INTERVIEWING");
            }}
            className={`text-left bg-gradient-to-br from-white to-sky-50/70 p-5 rounded-xl border border-l-4 border-l-sky-500 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg cursor-pointer ${
              tab === "APPLICATIONS" && statusFilter === "INTERVIEWING" ? "border-sky-500 ring-2 ring-sky-400/40" : "border-neutral-200"
            }`}
          >
            <div className="text-xs text-neutral-600 font-medium">Mới nộp / Đang phỏng vấn</div>
            <div className="text-xl font-bold text-sky-700 mt-1">{interviewingCount} ứng viên</div>
            <div className="text-[11px] text-neutral-400 mt-1">Bấm để lọc ứng viên PV →</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("APPLICATIONS");
              setStatusFilter(statusFilter === "PASSED" ? "REJECTED" : "PASSED");
            }}
            className={`text-left bg-gradient-to-br from-white to-emerald-50/70 p-5 rounded-xl border border-l-4 border-l-emerald-500 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg cursor-pointer ${
              tab === "APPLICATIONS" && (statusFilter === "PASSED" || statusFilter === "REJECTED")
                ? "border-emerald-500 ring-2 ring-emerald-400/40"
                : "border-neutral-200"
            }`}
          >
            <div className="text-xs text-neutral-600 font-medium">Đạt / Không đạt</div>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {passedCount} Đạt / <span className="text-rose-600">{rejectedCount} Rớt</span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Bấm để lọc Đạt / Không đạt →</div>
          </button>

          <button
            type="button"
            onClick={() => setTab("MEMBERS_SALARY")}
            className={`text-left bg-gradient-to-br from-white to-violet-50/70 p-5 rounded-xl border border-l-4 border-l-violet-500 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg cursor-pointer ${
              tab === "MEMBERS_SALARY" ? "border-violet-500 ring-2 ring-violet-400/40" : "border-neutral-200"
            }`}
          >
            <div className="text-xs text-neutral-600 font-medium">Thành viên (Chính thức / TTS)</div>
            <div className="text-xl font-bold text-violet-700 mt-1">
              {members.length - internMembersCount} CT / {internMembersCount} TTS
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Bấm để xem lương thành viên →</div>
          </button>
        </div>

        {/* Tabs & Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTab("APPLICATIONS")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                tab === "APPLICATIONS"
                  ? "bg-neutral-950 text-amber-400 border border-amber-500"
                  : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <Briefcase className="w-4 h-4" /> Hồ sơ xin việc ({applications.length})
            </button>
            <button
              onClick={() => setTab("MEMBERS_SALARY")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                tab === "MEMBERS_SALARY"
                  ? "bg-neutral-950 text-amber-400 border border-amber-500"
                  : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <BadgeDollarSign className="w-4 h-4" /> Lương & Chế độ Thành viên ({members.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-2.5 top-2" />
              <input
                placeholder="Tìm tên, SĐT, trường..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white w-48"
              />
            </div>
            <div className="flex gap-1.5">
            {[
              { key: "ALL", label: "Tất cả" },
              { key: "FULL_TIME", label: "Chính thức" },
              { key: "INTERN", label: "Thực tập sinh" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key as typeof typeFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  typeFilter === f.key
                    ? "bg-amber-500 text-neutral-950 font-bold"
                    : "bg-white border border-neutral-200 text-neutral-600"
                }`}
              >
                {f.label}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Lịch hẹn phỏng vấn ứng viên */}
        {applications.some((a) => a.interviewDate || a.status === "INTERVIEWING") && (
          <div className="bg-gradient-to-r from-sky-50 via-white to-amber-50/70 border border-sky-200 border-l-4 border-l-sky-500 rounded-xl p-4 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-sm text-neutral-950">
                📅 Lịch hẹn phỏng vấn ứng viên (
                {applications.filter((a) => a.interviewDate || a.status === "INTERVIEWING").length})
              </div>
              <span className="text-[11px] text-sky-800 font-medium">Bấm vào thẻ để xem chi tiết hồ sơ</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {applications
                .filter((a) => a.interviewDate || a.status === "INTERVIEWING")
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedApp(a)}
                    className="text-left p-3 rounded-lg bg-white border border-sky-100 hover:border-sky-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-neutral-900 truncate">{a.fullName}</span>
                      <span className="font-mono text-[10px] font-bold text-amber-700">{a.code}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                      {a.position} • {a.departmentCode}
                    </div>
                    <div className="text-[11px] font-semibold text-sky-700 mt-1">
                      {a.interviewDate ? `🕒 Hẹn PV: ${formatDate(a.interviewDate)}` : "⏳ Đang chờ xếp lịch PV"}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {tab === "APPLICATIONS" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "ALL", label: `Tất cả trạng thái (${applications.length})` },
                { key: "INTERVIEWING", label: `Mới nộp / Đang PV (${interviewingCount})` },
                { key: "PASSED", label: `Đạt / Nhận việc (${passedCount})` },
                { key: "REJECTED", label: `Không đạt (${rejectedCount})` },
              ].map((sf) => (
                <button
                  key={sf.key}
                  onClick={() => setStatusFilter(sf.key as typeof statusFilter)}
                  className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${
                    statusFilter === sf.key
                      ? "bg-neutral-950 text-amber-400"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {sf.label}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3">Mã / Ứng viên</th>
                    <th className="px-4 py-3">Vị trí / Loại hình</th>
                    <th className="px-4 py-3 text-right">Lương / Trợ cấp mong muốn</th>
                    <th className="px-4 py-3">Ngày PV / CV</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-500">
                        Chưa có hồ sơ xin việc nào. Bấm <strong>+ Thêm hồ sơ xin việc</strong> để thêm ứng viên.
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedApp(a)}
                        className="hover:bg-amber-50/40 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold text-amber-700">{a.code}</div>
                          <div className="font-medium text-neutral-900">{a.fullName}</div>
                          <div className="text-xs text-neutral-500">
                            {a.phone} {a.email ? `• ${a.email}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-neutral-900">{a.position}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                a.applicantType === "INTERN"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {a.applicantType === "INTERN" ? "Thực tập sinh" : "Chính thức"}
                            </span>
                            <span className="text-xs text-neutral-500">{a.departmentCode}</span>
                          </div>
                          {a.university && (
                            <div className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" /> {a.university}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatVND(a.expectedSalary)}
                        </td>
                        <td className="px-4 py-3 text-xs space-y-1">
                          <div>{a.interviewDate ? formatDate(a.interviewDate) : "Chưa hẹn PV"}</div>
                          {a.cvUrl && (
                            <a
                              href={a.cvUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-amber-700 hover:underline font-medium"
                            >
                              <FileText className="w-3.5 h-3.5" /> Xem CV
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={a.status}
                            onChange={(e) => handleQuickAppStatus(a.id, e.target.value)}
                            className="border border-neutral-300 rounded-lg px-2 py-1 text-xs bg-white"
                          >
                            {Object.entries(APP_STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                          {a.status !== "ONBOARDED" && a.status !== "REJECTED" && (
                            <button
                              onClick={() => handleOnboard(a)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                              title="Chuyển thành nhân viên/thực tập sinh"
                            >
                              <UserPlus className="w-3.5 h-3.5" /> Nhận làm
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingAppId(a.id);
                              setAppForm({
                                fullName: a.fullName,
                                phone: a.phone,
                                email: a.email || "",
                                position: a.position,
                                departmentCode: a.departmentCode,
                                applicantType: a.applicantType,
                                university: a.university || "",
                                expectedSalary: String(a.expectedSalary),
                                cvUrl: a.cvUrl || "",
                                interviewDate: a.interviewDate || "",
                                status: a.status,
                                note: a.note || "",
                              });
                              setShowAppModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-100 hover:bg-amber-100 text-neutral-800 text-xs cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteApp(a)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {tab === "MEMBERS_SALARY" && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3">Thành viên</th>
                    <th className="px-4 py-3">Loại hình / Phòng ban</th>
                    <th className="px-4 py-3 text-right">Lương CB / Trợ cấp</th>
                    <th className="px-4 py-3 text-right">Phụ cấp</th>
                    <th className="px-4 py-3 text-right">Lương tháng gần nhất</th>
                    <th className="px-4 py-3 text-center">Ngày công</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredMembers.map((m) => {
                    const latestPayroll = m.payrolls[0];
                    return (
                      <tr key={m.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {m.avatar ? (
                              <img src={m.avatar} alt={m.fullName} className="w-9 h-9 rounded-full object-cover border border-amber-500/60" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-neutral-950 text-amber-400 flex items-center justify-center font-bold text-xs">
                                {m.fullName.split(" ").slice(-1)[0]?.[0] || "N"}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-neutral-900">{m.fullName}</div>
                              <div className="text-xs text-neutral-400">
                                {m.employeeCode} • {m.position}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-full font-medium ${
                              m.employmentType === "INTERN"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {m.employmentType === "INTERN" ? "Thực tập sinh" : "Chính thức"}
                          </span>
                          <div className="text-neutral-500 mt-1">{m.department.name}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatVND(m.baseSalary)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatVND(m.allowance)}</td>
                        <td className="px-4 py-3 text-right">
                          {latestPayroll ? (
                            <div>
                              <div className="font-bold text-emerald-700 tabular-nums">{formatVND(latestPayroll.netSalary)}</div>
                              <div className="text-[11px] text-neutral-400">
                                T{latestPayroll.month}/{latestPayroll.year} • {getStatusLabel(latestPayroll.status)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">Chưa có</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-medium">{m._count.attendances} buổi</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedMember(m);
                              setMemberForm({
                                baseSalary: String(m.baseSalary),
                                allowance: String(m.allowance),
                                kpiTarget: String(m.kpiTarget || 0),
                                employmentType: m.employmentType || "FULL_TIME",
                                university: m.university || "",
                                mentorName: m.mentorName || "",
                                position: m.position,
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" /> Chi tiết & Chỉnh lương
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Thêm / Sửa hồ sơ xin việc */}
        {showAppModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 my-8">
              <h3 className="text-lg font-bold text-neutral-900">
                {editingAppId ? "Cập nhật hồ sơ xin việc" : "Thêm hồ sơ xin việc mới"}
              </h3>
              <form onSubmit={handleSaveApp} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Họ và tên ứng viên</label>
                    <input
                      required
                      value={appForm.fullName}
                      onChange={(e) => setAppForm({ ...appForm, fullName: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Số điện thoại</label>
                    <input
                      required
                      value={appForm.phone}
                      onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Loại hình ứng tuyển</label>
                    <select
                      value={appForm.applicantType}
                      onChange={(e) => setAppForm({ ...appForm, applicantType: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="FULL_TIME">Nhân viên chính thức</option>
                      <option value="INTERN">Sinh viên thực tập</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Phòng ban</label>
                    <select
                      value={appForm.departmentCode}
                      onChange={(e) => setAppForm({ ...appForm, departmentCode: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="SALES">Phòng Sales</option>
                      <option value="IT">Phòng IT</option>
                      <option value="MARKETING">Phòng Marketing</option>
                      <option value="ACCOUNTING">Phòng Kế toán</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Vị trí ứng tuyển</label>
                    <input
                      required
                      value={appForm.position}
                      onChange={(e) => setAppForm({ ...appForm, position: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Lương / Trợ cấp mong muốn</label>
                    <input
                      type="number"
                      value={appForm.expectedSalary}
                      onChange={(e) => setAppForm({ ...appForm, expectedSalary: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {appForm.applicantType === "INTERN" && (
                  <div>
                    <label className="block text-xs font-medium mb-1">Trường đang theo học</label>
                    <input
                      value={appForm.university}
                      onChange={(e) => setAppForm({ ...appForm, university: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="VD: ĐH Kinh tế TP.HCM..."
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Ngày phỏng vấn</label>
                    <input
                      type="date"
                      value={appForm.interviewDate}
                      onChange={(e) => setAppForm({ ...appForm, interviewDate: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={appForm.email}
                      onChange={(e) => setAppForm({ ...appForm, email: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 text-amber-400 text-xs font-medium cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingCv ? "Đang tải..." : "Tải tệp CV (Ảnh / PDF)"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingCv(true);
                        const fd = new FormData();
                        fd.append("file", file);
                        const up = await fetch("/api/upload", { method: "POST", body: fd });
                        if (up.ok) {
                          const { url } = await up.json();
                          setAppForm((f) => ({ ...f, cvUrl: url }));
                        }
                        setUploadingCv(false);
                      }}
                      className="hidden"
                    />
                  </label>
                  {appForm.cvUrl && <span className="text-xs text-emerald-700 font-medium">Đã đính kèm CV</span>}
                </div>

                <textarea
                  placeholder="Ghi chú đánh giá ứng viên..."
                  value={appForm.note}
                  onChange={(e) => setAppForm({ ...appForm, note: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowAppModal(false)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    {editingAppId ? "Lưu thay đổi" : "Lưu hồ sơ"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Chi tiết & Chỉnh lương thành viên (Chính thức & Thực tập sinh) */}
        {selectedMember && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedMember(null)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[88vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-neutral-950">
                    Hồ sơ & Chế độ lương — {selectedMember.fullName}
                  </h3>
                  <div className="text-xs text-neutral-500">
                    {selectedMember.employeeCode} • {selectedMember.department.name}
                  </div>
                </div>
                <button onClick={() => setSelectedMember(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMemberSalary} className="p-4 rounded-xl bg-amber-50/40 border border-amber-200 space-y-3">
                <div className="font-bold text-xs text-neutral-900">Điều chỉnh lương / trợ cấp & loại hình nhân sự</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-neutral-600 mb-0.5">Loại hình</label>
                    <select
                      value={memberForm.employmentType}
                      onChange={(e) => setMemberForm({ ...memberForm, employmentType: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    >
                      <option value="FULL_TIME">Nhân viên chính thức</option>
                      <option value="INTERN">Thực tập sinh</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-600 mb-0.5">Chức danh</label>
                    <input
                      value={memberForm.position}
                      onChange={(e) => setMemberForm({ ...memberForm, position: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-600 mb-0.5">
                      {memberForm.employmentType === "INTERN" ? "Trợ cấp thực tập" : "Lương cơ bản"}
                    </label>
                    <input
                      type="number"
                      value={memberForm.baseSalary}
                      onChange={(e) => setMemberForm({ ...memberForm, baseSalary: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-600 mb-0.5">Phụ cấp</label>
                    <input
                      type="number"
                      value={memberForm.allowance}
                      onChange={(e) => setMemberForm({ ...memberForm, allowance: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-600 mb-0.5">KPI mục tiêu (Sales)</label>
                    <input
                      type="number"
                      value={memberForm.kpiTarget}
                      onChange={(e) => setMemberForm({ ...memberForm, kpiTarget: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                  {memberForm.employmentType === "INTERN" && (
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-0.5">Trường / Mentor</label>
                      <input
                        value={memberForm.university}
                        onChange={(e) => setMemberForm({ ...memberForm, university: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                        placeholder="Trường đang học"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-xs font-bold cursor-pointer">
                    Lưu chế độ lương
                  </button>
                </div>
              </form>

              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-xs font-bold text-neutral-700">
                  Lịch sử bảng lương các tháng
                </div>
                {selectedMember.payrolls.length === 0 ? (
                  <div className="p-4 text-xs text-neutral-500 text-center">Chưa có bảng lương nào.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 text-neutral-600 uppercase border-b border-neutral-200">
                      <tr>
                        <th className="px-3 py-2">Tháng</th>
                        <th className="px-3 py-2 text-right">Lương CB</th>
                        <th className="px-3 py-2 text-right">Hoa hồng</th>
                        <th className="px-3 py-2 text-right">Phụ cấp & Thưởng</th>
                        <th className="px-3 py-2 text-right">Thực nhận</th>
                        <th className="px-3 py-2">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {selectedMember.payrolls.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-medium">
                            T{p.month}/{p.year}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatVND(p.baseSalary)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-amber-700">{formatVND(p.commissionAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatVND(p.allowance + p.bonus + p.overtimePay - p.deduction)}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700 tabular-nums">{formatVND(p.netSalary)}</td>
                          <td className="px-3 py-2">{getStatusLabel(p.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Modal Chi tiết Hồ sơ Ứng viên */}
        {selectedApp && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedApp(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
                <div>
                  <div className="font-mono text-xs font-bold text-amber-700">{selectedApp.code}</div>
                  <h3 className="text-lg font-bold text-neutral-950">{selectedApp.fullName}</h3>
                  <div className="text-xs text-neutral-500">
                    {selectedApp.position} • {selectedApp.departmentCode} •{" "}
                    {selectedApp.applicantType === "INTERN" ? "Sinh viên thực tập" : "Nhân viên chính thức"}
                  </div>
                </div>
                <button onClick={() => setSelectedApp(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div>
                  <span className="text-neutral-500">Số điện thoại:</span>{" "}
                  <strong className="text-neutral-900">{selectedApp.phone}</strong>
                </div>
                <div>
                  <span className="text-neutral-500">Email:</span>{" "}
                  <strong className="text-neutral-900">{selectedApp.email || "—"}</strong>
                </div>
                <div>
                  <span className="text-neutral-500">Lương / Trợ cấp:</span>{" "}
                  <strong className="text-emerald-700">{formatVND(selectedApp.expectedSalary)}</strong>
                </div>
                <div>
                  <span className="text-neutral-500">Ngày phỏng vấn:</span>{" "}
                  <strong className="text-neutral-900">
                    {selectedApp.interviewDate ? formatDate(selectedApp.interviewDate) : "Chưa hẹn"}
                  </strong>
                </div>
                {selectedApp.university && (
                  <div className="col-span-2">
                    <span className="text-neutral-500">Trường học:</span>{" "}
                    <strong className="text-amber-700">{selectedApp.university}</strong>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-neutral-500">Trạng thái:</span>{" "}
                  <strong className="text-neutral-900">{APP_STATUS_LABELS[selectedApp.status] || selectedApp.status}</strong>
                </div>
                {selectedApp.note && (
                  <div className="col-span-2">
                    <span className="text-neutral-500">Ghi chú đánh giá:</span>{" "}
                    <span className="text-neutral-800">{selectedApp.note}</span>
                  </div>
                )}
              </div>

              {selectedApp.cvUrl && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-xs font-medium text-amber-900">Tệp CV đính kèm của ứng viên</span>
                  <a
                    href={selectedApp.cvUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-neutral-950 text-amber-400 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" /> Mở xem CV
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
