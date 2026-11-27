import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      include: { department: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.department.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { code: "asc" },
    }),
  ]);

  const sanitized = users.map(({ passwordHash: _, ...rest }) => rest);
  return NextResponse.json({ users: sanitized, departments });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Giám đốc mới có quyền thêm nhân sự" }, { status: 403 });
  }

  const body = await request.json();
  const passwordHash = await bcrypt.hash(body.password || "123456", 10);

  const created = await prisma.user.create({
    data: {
      employeeCode: body.employeeCode,
      email: String(body.email).trim().toLowerCase(),
      passwordHash,
      fullName: body.fullName,
      phone: body.phone || null,
      avatar: body.avatar || null,
      role: body.role,
      position: body.position,
      employmentType: body.employmentType || "FULL_TIME",
      university: body.university || null,
      internshipStart: body.internshipStart ? new Date(body.internshipStart) : null,
      internshipEnd: body.internshipEnd ? new Date(body.internshipEnd) : null,
      mentorName: body.mentorName || null,
      isTeamLead: Boolean(body.isTeamLead),
      baseSalary: Number(body.baseSalary) || 2_000_000,
      allowance: Number(body.allowance) || 0,
      kpiTarget: Number(body.kpiTarget) || 0,
      departmentId: body.departmentId,
    },
    include: { department: true },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE_USER",
    entity: "User",
    entityId: created.id,
    details: `Thêm nhân sự ${created.fullName} (${created.role})`,
  });

  const { passwordHash: _, ...rest } = created;
  return NextResponse.json({ user: rest }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Giám đốc mới có quyền cập nhật phân quyền/nhân sự" }, { status: 403 });
  }

  const body = await request.json();
  const updated = await prisma.user.update({
    where: { id: body.id },
    data: {
      role: body.role,
      position: body.position,
      avatar: body.avatar !== undefined ? body.avatar : undefined,
      employmentType: body.employmentType !== undefined ? body.employmentType : undefined,
      university: body.university !== undefined ? body.university : undefined,
      mentorName: body.mentorName !== undefined ? body.mentorName : undefined,
      isTeamLead: body.isTeamLead !== undefined ? Boolean(body.isTeamLead) : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      baseSalary: body.baseSalary !== undefined ? Number(body.baseSalary) : undefined,
      allowance: body.allowance !== undefined ? Number(body.allowance) : undefined,
      kpiTarget: body.kpiTarget !== undefined ? Number(body.kpiTarget) : undefined,
      departmentId: body.departmentId,
    },
    include: { department: true },
  });

  await logAudit({
    userId: user.id,
    action: body.isActive === true ? "APPROVE_USER" : "UPDATE_USER",
    entity: "User",
    entityId: updated.id,
    details: `${body.isActive === true ? "Duyệt kích hoạt" : "Cập nhật"} nhân sự ${updated.fullName} (Role: ${updated.role})`,
  });

  if (body.isActive === true) {
    await prisma.notification.create({
      data: {
        userId: updated.id,
        title: "Tài khoản đã được Admin duyệt",
        message: "Tài khoản của bạn đã được Giám đốc phê duyệt kích hoạt. Bạn có thể sử dụng đầy đủ hệ thống NDAHOME.",
        type: "SUCCESS",
        link: "/",
      },
    });
  }

  const { passwordHash: _, ...rest } = updated;
  return NextResponse.json({ user: rest });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Giám đốc mới có quyền xóa / từ chối tài khoản" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  if (target.isActive) {
    return NextResponse.json({ error: "Chỉ có thể xóa trực tiếp tài khoản đang chờ duyệt." }, { status: 400 });
  }

  await prisma.notification.deleteMany({ where: { userId: id } });
  await prisma.auditLog.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    action: "REJECT_USER",
    entity: "User",
    entityId: id,
    details: `Từ chối & xóa tài khoản đăng ký ${target.fullName} (${target.email})`,
  });

  return NextResponse.json({ ok: true });
}
