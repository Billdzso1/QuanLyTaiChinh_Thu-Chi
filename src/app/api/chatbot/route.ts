import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/permissionsServer";
import { formatVND } from "@/lib/finance";

async function readJsonSafe<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", fileName), "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const question = String(body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "Vui lòng nhập câu hỏi" }, { status: 400 });
  }

  const q = norm(question);
  const perms = await getEffectivePermissions(user.id, user.role, user.employmentType);
  const canSeeFinance = (user.role === "ADMIN" || user.role === "ACCOUNTANT") && perms.finance?.view;
  const isSales = user.role === "SALES";

  const replies: string[] = [];
  const links: { label: string; href: string }[] = [];

  // 1. Phòng trọ / Phòng trống / Giá phòng
  if (q.includes("phong") || q.includes("tro") || q.includes("trong") || q.includes("nha")) {
    const rooms = await prisma.room.findMany({
      include: { property: true },
      orderBy: [{ status: "asc" }, { price: "asc" }],
    });
    const available = rooms.filter((r) => r.status === "AVAILABLE");
    const reserved = rooms.filter((r) => r.status === "RESERVED");
    const rented = rooms.filter((r) => r.status === "RENTED");

    const sampleList = available
      .slice(0, 6)
      .map((r) => `• **${r.property.name} — ${r.roomNumber}** (${r.property.district}): ${formatVND(r.price)}/tháng`)
      .join("\n");

    replies.push(
      `📊 **Tình hình quỹ phòng hiện tại (${rooms.length} phòng):**\n` +
        `- Còn trống: **${available.length}** phòng\n` +
        `- Đã đặt cọc: **${reserved.length}** phòng\n` +
        `- Đang thuê: **${rented.length}** phòng` +
        (sampleList ? `\n\n🏠 **Danh sách phòng đang trống:**\n${sampleList}` : "")
    );
    if (perms.sales?.view || perms.rooms?.view) links.push({ label: "Mở Sales & Phòng trọ", href: "/sales" });
    if (perms.landlord?.view) links.push({ label: "Mở Cổng Chủ trọ", href: "/landlord" });
  }

  // 2. Doanh thu / Thu chi / Tài chính / Lợi nhuận / Công nợ
  if (
    q.includes("doanh thu") ||
    q.includes("thu chi") ||
    q.includes("loi nhuan") ||
    q.includes("cong no") ||
    q.includes("tai chinh") ||
    q.includes("tien")
  ) {
    if (!canSeeFinance || isSales) {
      replies.push(
        "🔒 **Thông tin doanh thu & tài chính toàn công ty** được bảo mật — chỉ Giám đốc và Kế toán có quyền xem."
      );
    } else {
      const txs = await prisma.transaction.findMany({ where: { approvalStatus: "APPROVED" } });
      const totalIncome = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
      const totalExpense = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
      const unpaidDebt = txs
        .filter((t) => t.type === "EXPENSE" && t.paymentStatus === "UNPAID")
        .reduce((s, t) => s + t.amount, 0);
      replies.push(
        `💰 **Tổng quan Tài chính (đã duyệt):**\n` +
          `- Tổng Thu: **${formatVND(totalIncome)}**\n` +
          `- Tổng Chi: **${formatVND(totalExpense)}**\n` +
          `- Lợi nhuận: **${formatVND(totalIncome - totalExpense)}**\n` +
          `- Công nợ chi chưa thanh toán: **${formatVND(unpaidDebt)}**`
      );
      links.push({ label: "Xem sổ Thu Chi", href: "/finance" });
    }
  }

  // 3. Lương / Hoa hồng cá nhân hoặc bảng lương
  if (q.includes("luong") || q.includes("hoa hong") || q.includes("thu nhap") || q.includes("kpi")) {
    const myPayrolls = await prisma.payroll.findMany({
      where: { userId: user.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 2,
    });
    if (myPayrolls.length > 0) {
      const p = myPayrolls[0];
      replies.push(
        `💵 **Phiếu lương gần nhất của bạn (Tháng ${p.month}/${p.year}):**\n` +
          `- Lương cơ bản: **${formatVND(p.baseSalary)}**\n` +
          `- Hoa hồng (${(p.commissionRate * 100).toFixed(0)}%): **${formatVND(p.commissionAmount)}**\n` +
          `- Phụ cấp & Thưởng: **${formatVND(p.allowance + p.bonus)}**\n` +
          `- Thực nhận: **${formatVND(p.netSalary)}** (${p.status})`
      );
    } else {
      replies.push(
        `💵 Lương cơ bản hiện tại trên hồ sơ của bạn là **${formatVND(user.baseSalary)}**, phụ cấp **${formatVND(user.allowance)}**.`
      );
    }
    links.push({ label: "Xem Hồ sơ & Lương cá nhân", href: "/profile" });
  }

  // 4. Nhân sự / Thực tập sinh / Phỏng vấn / Ứng viên
  if (
    q.includes("nhan su") ||
    q.includes("nhan vien") ||
    q.includes("thuc tap") ||
    q.includes("phong van") ||
    q.includes("ung vien")
  ) {
    if (perms.employees?.view || user.role === "ADMIN") {
      const [allUsers, apps, extraProfiles] = await Promise.all([
        prisma.user.findMany({ include: { department: true } }),
        prisma.jobApplication.findMany({ orderBy: { createdAt: "desc" } }),
        readJsonSafe<Record<string, { interviewAt?: string; recruitmentStatus?: string }>>(
          "employee-profiles.json",
          {}
        ),
      ]);
      const activeCount = allUsers.filter((u) => u.isActive).length;
      const internCount = allUsers.filter((u) => u.employmentType === "INTERN").length;
      const pendingCount = allUsers.filter((u) => !u.isActive).length;
      const interviewUsers = allUsers.filter((u) => extraProfiles[u.id]?.interviewAt);
      const interviewApps = apps.filter((a) => a.interviewDate);

      replies.push(
        `👥 **Thống kê Nhân sự & Tuyển dụng:**\n` +
          `- Tổng tài khoản: **${allUsers.length}** (Đang hoạt động: ${activeCount}, Thực tập sinh: ${internCount}, Chờ duyệt/Khóa: ${pendingCount})\n` +
          `- Hồ sơ ứng viên: **${apps.length}**\n` +
          `- Lịch hẹn phỏng vấn đang có: **${interviewUsers.length + interviewApps.length}** lịch`
      );
      links.push({ label: "Mở Nhân sự & Phân quyền", href: "/employees" });
    } else {
      const deptUsers = await prisma.user.count({
        where: { departmentId: user.departmentId, isActive: true },
      });
      replies.push(
        `👥 Phòng **${user.department.name}** hiện có **${deptUsers}** thành viên đang hoạt động.`
      );
    }
  }

  // 5. Chấm công / Nghỉ phép / Đề xuất / Phê duyệt
  if (q.includes("cham cong") || q.includes("nghi phep") || q.includes("phe duyet") || q.includes("de xuat")) {
    const [myAtt, pendingApprovals] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 5,
      }),
      prisma.approval.count({
        where:
          user.role === "ADMIN" || user.role === "ACCOUNTANT"
            ? { status: { in: ["PENDING", "ACCOUNTANT_CHECKED"] } }
            : { createdById: user.id, status: { in: ["PENDING", "ACCOUNTANT_CHECKED"] } },
      }),
    ]);
    const latestAtt = myAtt[0];
    replies.push(
      `🕒 **Chấm công & Đề xuất:**\n` +
        `- Số buổi công ghi nhận gần đây: **${myAtt.length}** buổi${
          latestAtt ? ` (gần nhất ngày ${latestAtt.date}: ${latestAtt.workHours}h)` : ""
        }\n` +
        `- Đề xuất đang chờ xử lý: **${pendingApprovals}**`
    );
    if (perms.attendance?.view) links.push({ label: "Chấm công", href: "/attendance" });
    if (perms.approvals?.view) links.push({ label: "Ngân sách & Phê duyệt", href: "/approvals" });
  }

  // 6. IT / Dự án / Thiết bị / Marketing
  if (q.includes("du an") || q.includes("cong viec") || q.includes("thiet bi") || q.includes("it")) {
    if (perms.it?.view) {
      const [prjCount, todoCount, devCount] = await Promise.all([
        prisma.project.count(),
        prisma.task.count({ where: { status: { not: "DONE" } } }),
        prisma.device.count(),
      ]);
      replies.push(
        `💻 **Phòng IT & Dự án:**\n` +
          `- Dự án: **${prjCount}**\n` +
          `- Công việc chưa hoàn thành: **${todoCount}**\n` +
          `- Thiết bị IT đang quản lý: **${devCount}**`
      );
      links.push({ label: "Mở Phòng IT", href: "/it" });
    }
  }

  if (q.includes("marketing") || q.includes("chien dich") || q.includes("quang cao") || q.includes("lead")) {
    if (perms.marketing?.view) {
      const campaigns = await prisma.marketingCampaign.findMany();
      const totalLeads = campaigns.reduce((s, c) => s + c.leadsCount, 0);
      replies.push(
        `📣 **Phòng Marketing:**\n` +
          `- Số chiến dịch: **${campaigns.length}**\n` +
          `- Tổng số Leads mang về: **${totalLeads}**`
      );
      links.push({ label: "Mở Phòng Marketing", href: "/marketing" });
    }
  }

  // Fallback chào hỏi / gợi ý
  if (replies.length === 0) {
    replies.push(
      `Xin chào **${user.fullName}** (${user.department.name})! Tôi là trợ lý dữ liệu nội bộ NDAHOME.\n\n` +
        `Bạn có thể hỏi tôi theo dữ liệu thực tế trên hệ thống, ví dụ:\n` +
        `• *"Hiện có bao nhiêu phòng trống và giá bao nhiêu?"*\n` +
        `• *"Lương tháng này của tôi là bao nhiêu?"*\n` +
        `• *"Tình hình chấm công và đề xuất của tôi?"*\n` +
        `• *"Thống kê nhân sự và lịch phỏng vấn?"*\n` +
        (canSeeFinance ? `• *"Tổng doanh thu, chi phí và công nợ hiện tại?"*\n` : "") +
        `• *"Dự án IT / Chiến dịch Marketing hiện có?"*`
    );
  }

  return NextResponse.json({
    answer: replies.join("\n\n"),
    links,
  });
}
