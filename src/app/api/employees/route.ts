import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyInterviewSchedule } from "@/lib/interviewNotify";

interface EmployeeExtraProfile {
  cvUrl?: string | null;
  recruitmentStatus?: string | null;
  statusNote?: string | null;
  interviewAt?: string | null;
}

const PROFILES_FILE = path.join(process.cwd(), "data", "employee-profiles.json");

async function readExtraProfiles(): Promise<Record<string, EmployeeExtraProfile>> {
  try {
    const raw = await readFile(PROFILES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveExtraProfiles(data: Record<string, EmployeeExtraProfile>) {
  await mkdir(path.dirname(PROFILES_FILE), { recursive: true });
  await writeFile(PROFILES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [users, departments, extraProfiles] = await Promise.all([
    prisma.user.findMany({
      include: { department: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.department.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { code: "asc" },
    }),
    readExtraProfiles(),
  ]);

  const sanitized = users.map(({ passwordHash: _, ...rest }) => ({
    ...rest,
    cvUrl: extraProfiles[rest.id]?.cvUrl || null,
    recruitmentStatus: extraProfiles[rest.id]?.recruitmentStatus || null,
    statusNote: extraProfiles[rest.id]?.statusNote || null,
    interviewAt: extraProfiles[rest.id]?.interviewAt || null,
  }));
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

  if (body.cvUrl || body.recruitmentStatus || body.statusNote || body.interviewAt) {
    const profiles = await readExtraProfiles();
    profiles[created.id] = {
      cvUrl: body.cvUrl || null,
      recruitmentStatus: body.recruitmentStatus || null,
      statusNote: body.statusNote || null,
      interviewAt: body.interviewAt || null,
    };
    await saveExtraProfiles(profiles);
  }

  if (body.interviewAt) {
    await notifyInterviewSchedule({
      actorId: user.id,
      candidateName: created.fullName,
      candidateEmail: created.email,
      position: created.position,
      interviewTime: body.interviewAt,
      link: "/employees",
      targetUserId: created.id,
    });
  }

  const { passwordHash: _, ...rest } = created;
  return NextResponse.json(
    {
      user: {
        ...rest,
        cvUrl: body.cvUrl || null,
        recruitmentStatus: body.recruitmentStatus || null,
        statusNote: body.statusNote || null,
        interviewAt: body.interviewAt || null,
      },
    },
    { status: 201 }
  );
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
    action: body.isActive === false ? "LOCK_USER" : body.isActive === true ? "APPROVE_USER" : "UPDATE_USER",
    entity: "User",
    entityId: updated.id,
    details: `${body.isActive === false ? "Khóa tài khoản" : body.isActive === true ? "Kích hoạt/Mở khóa" : "Cập nhật"} nhân sự ${updated.fullName} (Role: ${updated.role})`,
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

  if (
    body.cvUrl !== undefined ||
    body.recruitmentStatus !== undefined ||
    body.statusNote !== undefined ||
    body.interviewAt !== undefined
  ) {
    const profiles = await readExtraProfiles();
    const cur = profiles[updated.id] || {};
    profiles[updated.id] = {
      cvUrl: body.cvUrl !== undefined ? body.cvUrl : cur.cvUrl,
      recruitmentStatus:
        body.recruitmentStatus !== undefined ? body.recruitmentStatus : cur.recruitmentStatus,
      statusNote: body.statusNote !== undefined ? body.statusNote : cur.statusNote,
      interviewAt: body.interviewAt !== undefined ? body.interviewAt : cur.interviewAt,
    };
    await saveExtraProfiles(profiles);
  }

  if (body.interviewAt) {
    await notifyInterviewSchedule({
      actorId: user.id,
      candidateName: updated.fullName,
      candidateEmail: updated.email,
      position: updated.position,
      interviewTime: body.interviewAt,
      link: "/employees",
      targetUserId: updated.id,
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
