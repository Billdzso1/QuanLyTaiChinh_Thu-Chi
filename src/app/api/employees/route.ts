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
    action: "UPDATE_USER",
    entity: "User",
    entityId: updated.id,
    details: `Cập nhật nhân sự ${updated.fullName} (Role: ${updated.role})`,
  });

  const { passwordHash: _, ...rest } = updated;
  return NextResponse.json({ user: rest });
}
