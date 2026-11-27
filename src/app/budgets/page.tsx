"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export default function BudgetsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/approvals?tab=budgets");
  }, [router]);

  return (
    <AppShell>
      <div className="p-10 text-center text-sm text-neutral-500">
        Đang chuyển sang trang Ngân sách &amp; Phê duyệt...
      </div>
    </AppShell>
  );
}
