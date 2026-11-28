"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FileText } from "lucide-react";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  details?: string;
  createdAt: string;
  user?: { fullName: string; role: string };
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.auditLogs && setLogs(d.auditLogs));
  }, []);

  const loginCount = logs.filter((l) => l.action === "LOGIN").length;
  const permCount = logs.filter((l) =>
    ["UPDATE_PERMISSIONS", "APPROVE_USER", "LOCK_USER", "UPDATE_USER", "CREATE_USER", "REJECT_USER"].includes(l.action)
  ).length;
  const businessCount = Math.max(0, logs.length - loginCount - permCount);

  function getActionBadgeClass(action: string) {
    if (action === "LOGIN") return "bg-sky-100 text-sky-800 border-sky-200";
    if (action.includes("LOCK") || action.includes("REJECT") || action.includes("CANCEL"))
      return "bg-rose-100 text-rose-700 border-rose-200";
    if (action.includes("PERMISSION") || action.includes("USER"))
      return "bg-violet-100 text-violet-700 border-violet-200";
    if (action.includes("APPROVE") || action.includes("PAY") || action.includes("CREATE"))
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    return "bg-amber-100 text-amber-800 border-amber-200";
  }

  function getActionLabel(action: string): string {
    const map: Record<string, string> = {
      LOGIN: "Đăng nhập hệ thống",
      SYSTEM_INIT: "Khởi tạo hệ thống",
      REGISTER_PENDING: "Đăng ký tài khoản (chờ duyệt)",
      CREATE_USER: "Thêm nhân sự mới",
      UPDATE_USER: "Cập nhật hồ sơ nhân sự",
      APPROVE_USER: "Duyệt kích hoạt tài khoản",
      LOCK_USER: "Khóa tài khoản nhân sự",
      REJECT_USER: "Từ chối / Xóa tài khoản chờ duyệt",
      UPDATE_PERMISSIONS: "Cập nhật phân quyền (RBAC)",
      CREATE_JOB_APPLICATION: "Thêm hồ sơ ứng viên",
      UPDATE_JOB_APPLICATION: "Cập nhật hồ sơ ứng viên",
      SCHEDULE_INTERVIEW: "Đặt lịch hẹn phỏng vấn",
      ONBOARD_APPLICANT: "Nhận ứng viên vào làm",
      DIRECTOR_UPDATE_SALARY: "Giám đốc điều chỉnh lương",
      CREATE_TRANSACTION: "Tạo phiếu Thu / Chi",
      UPDATE_TRANSACTION: "Cập nhật giao dịch Thu / Chi",
      UPLOAD_TRANSACTION_VOUCHER: "Đính kèm chứng từ giao dịch",
      CREATE_CONTRACT: "Tạo hợp đồng thuê phòng",
      SIGN_AND_RENT_CONTRACT: "Thanh toán đủ & Ký hợp đồng",
      CANCEL_DEPOSIT: "Hủy cọc & Chia 50/50",
      COLLECT_DEPOSIT: "Thu tiền cọc hợp đồng",
      PAY_LANDLORD: "Thanh toán tiền cho Chủ trọ",
      UPLOAD_CONTRACT_INVOICE: "Tải hóa đơn hợp đồng",
      GENERATE_PAYROLL: "Tổng hợp bảng lương tháng",
      APPROVE_PAYROLL: "Giám đốc duyệt bảng lương",
      UPLOAD_PAYROLL_DOC: "Tải bảng lương đã ký",
      UPLOAD_PAYROLL_ATTACHMENT: "Đính kèm chứng từ lương",
      CHECK_IN: "Chấm công vào ca",
      CHECK_OUT: "Chấm công tan ca",
      ADMIN_MARK_ATTENDANCE: "Giám đốc chấm công hộ",
      LOCK_ATTENDANCE: "Chốt bảng công tháng",
      CREATE_APPROVAL: "Tạo đề xuất phê duyệt",
      APPROVE_PROPOSAL: "Giám đốc duyệt đề xuất",
      ADD_PROJECT_EXPENSE: "Thêm minh chứng chi tiêu",
      CREATE_BUDGET_REQUEST: "Tạo đề xuất ngân sách",
      APPROVE_BUDGET: "Duyệt ngân sách phòng ban",
      UPDATE_BUDGET_REQUEST: "Cập nhật đề xuất ngân sách",
      DELETE_BUDGET_REQUEST: "Xóa đề xuất ngân sách",
      LANDLORD_CREATE_PROPERTY: "Chủ trọ thêm khu nhà",
      LANDLORD_CREATE_ROOM: "Chủ trọ thêm phòng",
      LANDLORD_UPDATE_PROPERTY: "Chủ trọ cập nhật khu nhà",
      LANDLORD_UPDATE_ROOM: "Chủ trọ cập nhật phòng",
    };
    return map[action] || action;
  }

  function getEntityLabel(entity: string): string {
    const map: Record<string, string> = {
      User: "Nhân sự / Tài khoản",
      Permissions: "Phân quyền hệ thống",
      JobApplication: "Hồ sơ ứng viên",
      Contract: "Hợp đồng",
      Deposit: "Phiếu cọc",
      Transaction: "Giao dịch Thu / Chi",
      Payroll: "Bảng lương",
      Attendance: "Chấm công",
      Approval: "Đề xuất & Phê duyệt",
      BudgetRequest: "Đề xuất ngân sách",
      Property: "Khu nhà trọ",
      Room: "Phòng trọ",
      Device: "Thiết bị IT",
      Project: "Dự án",
      System: "Hệ thống",
    };
    return map[entity] || entity;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Nhật ký thao tác hệ thống</h1>
          <p className="text-sm text-neutral-500">Ghi nhận mọi thao tác quan trọng về tài chính, lương, phê duyệt và phân quyền</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/80 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
            <div className="text-xs font-medium text-neutral-600">Tổng sự kiện ghi nhận</div>
            <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{logs.length}</div>
          </div>
          <div className="p-4 rounded-xl border border-neutral-200 border-l-4 border-l-sky-500 bg-gradient-to-br from-white to-sky-50/70 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
            <div className="text-xs font-medium text-neutral-600">Lượt đăng nhập</div>
            <div className="text-2xl font-bold text-sky-700 mt-1 tabular-nums">{loginCount}</div>
          </div>
          <div className="p-4 rounded-xl border border-neutral-200 border-l-4 border-l-violet-500 bg-gradient-to-br from-white to-violet-50/70 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
            <div className="text-xs font-medium text-neutral-600">Phân quyền &amp; Nhân sự</div>
            <div className="text-2xl font-bold text-violet-700 mt-1 tabular-nums">{permCount}</div>
          </div>
          <div className="p-4 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/70 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg">
            <div className="text-xs font-medium text-neutral-600">Nghiệp vụ Thu Chi / HĐ</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{businessCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2 font-semibold text-neutral-900 bg-neutral-50/70">
            <FileText className="w-5 h-5 text-amber-600" /> Lịch sử hoạt động gần nhất
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-600 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Người thực hiện</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {l.user?.fullName || "Hệ thống"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${getActionBadgeClass(
                          l.action
                        )}`}
                      >
                        {getActionLabel(l.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-neutral-700">{getEntityLabel(l.entity)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
