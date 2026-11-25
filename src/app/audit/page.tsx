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

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Nhật ký thao tác hệ thống (Audit Log)</h1>
          <p className="text-sm text-neutral-500">Ghi nhận mọi thao tác quan trọng về tài chính, lương, phê duyệt và phân quyền</p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-2 font-semibold text-neutral-900">
            <FileText className="w-5 h-5 text-amber-600" /> Lịch sử hoạt động gần nhất
          </div>
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
                <tr key={l.id}>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {new Date(l.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {l.user?.fullName || "Hệ thống"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-amber-700">{l.action}</td>
                  <td className="px-4 py-3 text-xs">{l.entity}</td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
