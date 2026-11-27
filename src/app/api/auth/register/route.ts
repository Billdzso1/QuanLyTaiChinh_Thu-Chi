import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyHumanToken } from "@/lib/humanGuard";
import { logAudit } from "@/lib/audit";

const DEPT_ROLE_MAP: Record<string, { role: string; defaultPosition: string }> = {
  SALES: { role: "SALES", defaultPosition: "Nhân viên Sales" },
  MARKETING: { role: "MARKETING", defaultPosition: "Nhân viên Marketing" },
  MKT: { role: "MARKETING", defaultPosition: "Nhân viên Marketing" },
  IT: { role: "IT", defaultPosition: "Nhân viên IT" },
  ACCOUNTING: { role: "ACCOUNTANT", defaultPosition: "Nhân viên Kế toán" },
  ACC: { role: "ACCOUNTANT", defaultPosition: "Nhân viên Kế toán" },
  DIRECTOR: { role: "ACCOUNTANT", defaultPosition: "Trợ lý Ban Giám đốc" },
  LANDLORD: { role: "LANDLORD", defaultPosition: "Chủ trọ / Đối tác" },
};

export async function GET() {
  const departments = await prisma.department.findMany({
    where: { code: { in: ["SALES", "MARKETING", "IT", "ACCOUNTING"] } },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ departments });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isHuman = await verifyHumanToken(body.humanToken);
    if (!isHuman) {
      return NextResponse.json(
        { error: "Vui lòng xác nhận 'Tôi không phải là người máy' trước khi đăng ký." },
        { status: 400 }
      );
    }
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const phone = String(body.phone || "").trim();
    const deptCode = String(body.departmentCode || "SALES").trim().toUpperCase();
    const employmentType = body.employmentType === "INTERN" ? "INTERN" : "FULL_TIME";
    const university = String(body.university || "").trim();

    if (!fullName || !email || password.length < 6) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu tối thiểu 6 ký tự." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email này đã được đăng ký trong hệ thống." },
        { status: 400 }
      );
    }

    const mapping = DEPT_ROLE_MAP[deptCode] || DEPT_ROLE_MAP.SALES;
    const dept =
      (await prisma.department.findUnique({ where: { code: deptCode } })) ||
      (await prisma.department.findFirst({ where: { code: { not: "BOD" } } }));

    if (!dept) {
      return NextResponse.json({ error: "Không tìm thấy phòng ban hợp lệ." }, { status: 400 });
    }

    // Tạo mã nhân viên kế tiếp NDA-XXX
    const allUsers = await prisma.user.findMany({ select: { employeeCode: true } });
    let maxNum = 16;
    for (const u of allUsers) {
      const m = u.employeeCode.match(/NDA-(\d+)/);
      if (m) maxNum = Math.max(maxNum, Number(m[1]));
    }
    const employeeCode = `NDA-${String(maxNum + 1).padStart(3, "0")}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const position =
      String(body.position || "").trim() ||
      (employmentType === "INTERN" ? `Thực tập sinh ${dept.name}` : mapping.defaultPosition);

    const created = await prisma.user.create({
      data: {
        employeeCode,
        email,
        passwordHash,
        fullName,
        phone: phone || null,
        role: mapping.role,
        position,
        employmentType,
        university: university || null,
        isActive: false, // Bắt buộc chờ Admin duyệt mới đăng nhập được
        baseSalary: mapping.role === "LANDLORD" ? 0 : 2_000_000,
        allowance: mapping.role === "LANDLORD" || employmentType === "INTERN" ? 0 : 500_000,
        kpiTarget: mapping.role === "SALES" ? 15_000_000 : 0,
        departmentId: dept.id,
      },
    });

    // Gửi thông báo cho Admin để duyệt
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title: "Tài khoản mới chờ Admin duyệt",
          message: `${fullName} (${email}) vừa đăng ký vào ${dept.name}. Vui lòng vào Nhân sự & Phân quyền để phê duyệt.`,
          type: "WARNING",
          link: "/employees",
        })),
      });
    }

    await logAudit({
      userId: created.id,
      action: "REGISTER_PENDING",
      entity: "User",
      entityId: created.id,
      details: `Đăng ký tài khoản mới chờ Admin duyệt: ${fullName} (${email})`,
    });

    return NextResponse.json(
      {
        ok: true,
        employeeCode,
        message: "Đăng ký thành công! Tài khoản của bạn đang chờ Admin (Giám đốc) duyệt trước khi có thể đăng nhập.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi đăng ký tài khoản" }, { status: 500 });
  }
}
