import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import { notifyInterviewSchedule } from "@/lib/interviewNotify";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Giám đốc mới có quyền truy cập" }, { status: 403 });
  }

  const [applications, members, departments] = await Promise.all([
    prisma.jobApplication.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      include: {
        department: true,
        payrolls: { orderBy: [{ year: "desc" }, { month: "desc" }] },
        _count: { select: { attendances: true } },
      },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.department.findMany({ orderBy: { code: "asc" } }),
  ]);

  const sanitizedMembers = members.map(({ passwordHash: _, ...rest }) => rest);
  return NextResponse.json({ applications, members: sanitizedMembers, departments });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const app = await prisma.jobApplication.create({
    data: {
      code: generateCode("UV"),
      fullName: body.fullName,
      phone: body.phone,
      email: body.email || null,
      position: body.position,
      departmentCode: body.departmentCode || "SALES",
      applicantType: body.applicantType || "FULL_TIME",
      university: body.university || null,
      expectedSalary: Number(body.expectedSalary) || 0,
      cvUrl: body.cvUrl || null,
      interviewDate: body.interviewDate || null,
      status: body.status || "NEW",
      note: body.note || null,
    },
  });

  await logAudit({
    userId: user.id,
    action: "CREATE_JOB_APPLICATION",
    entity: "JobApplication",
    entityId: app.id,
    details: `Thêm hồ sơ ứng viên ${app.fullName} (${app.position})`,
  });

  if (app.interviewDate) {
    await notifyInterviewSchedule({
      actorId: user.id,
      candidateName: app.fullName,
      candidateEmail: app.email,
      position: app.position,
      interviewTime: app.interviewDate,
      link: "/recruitment",
    });
  }

  return NextResponse.json({ application: app }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.entity === "ONBOARD") {
    const app = await prisma.jobApplication.findUnique({ where: { id: body.id } });
    if (!app) return NextResponse.json({ error: "Không tìm thấy hồ sơ ứng viên" }, { status: 404 });

    const dept = await prisma.department.findUnique({ where: { code: app.departmentCode } });
    if (!dept) return NextResponse.json({ error: "Không tìm thấy phòng ban" }, { status: 400 });

    const userCount = await prisma.user.count();
    const employeeCode = `NDA-${String(userCount + 1).padStart(3, "0")}`;
    const email = (app.email && app.email.trim()) || `${employeeCode.toLowerCase()}@ndahome.vn`;

    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      return NextResponse.json(
        { error: `Email ${email} đã tồn tại trong hệ thống nhân sự` },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash("123456", 10);
    const role = app.departmentCode === "ACCOUNTING" ? "ACCOUNTANT" : app.departmentCode;

    const newUser = await prisma.user.create({
      data: {
        employeeCode,
        email: email.toLowerCase(),
        passwordHash,
        fullName: app.fullName,
        phone: app.phone,
        role,
        position: app.position,
        employmentType: app.applicantType,
        university: app.university || null,
        baseSalary: app.expectedSalary || 2_000_000,
        allowance: app.applicantType === "INTERN" ? 0 : 500_000,
        departmentId: dept.id,
      },
    });

    await prisma.jobApplication.update({
      where: { id: app.id },
      data: { status: "ONBOARDED" },
    });

    await logAudit({
      userId: user.id,
      action: "ONBOARD_APPLICANT",
      entity: "User",
      entityId: newUser.id,
      details: `Nhận ứng viên ${app.fullName} vào làm (${employeeCode}, ${dept.name})`,
    });

    return NextResponse.json({ user: newUser, employeeCode });
  }

  if (body.entity === "MEMBER_SALARY") {
    const updated = await prisma.user.update({
      where: { id: body.id },
      data: {
        baseSalary: body.baseSalary !== undefined ? Number(body.baseSalary) : undefined,
        allowance: body.allowance !== undefined ? Number(body.allowance) : undefined,
        kpiTarget: body.kpiTarget !== undefined ? Number(body.kpiTarget) : undefined,
        employmentType: body.employmentType !== undefined ? body.employmentType : undefined,
        university: body.university !== undefined ? body.university : undefined,
        mentorName: body.mentorName !== undefined ? body.mentorName : undefined,
        position: body.position !== undefined ? body.position : undefined,
      },
    });
    await logAudit({
      userId: user.id,
      action: "DIRECTOR_UPDATE_SALARY",
      entity: "User",
      entityId: updated.id,
      details: `Giám đốc cập nhật lương/hồ sơ ${updated.fullName}: Lương CB ${updated.baseSalary}`,
    });
    return NextResponse.json({ member: updated });
  }

  const updated = await prisma.jobApplication.update({
    where: { id: body.id },
    data: {
      fullName: body.fullName !== undefined ? body.fullName : undefined,
      phone: body.phone !== undefined ? body.phone : undefined,
      email: body.email !== undefined ? body.email : undefined,
      position: body.position !== undefined ? body.position : undefined,
      departmentCode: body.departmentCode !== undefined ? body.departmentCode : undefined,
      applicantType: body.applicantType !== undefined ? body.applicantType : undefined,
      university: body.university !== undefined ? body.university : undefined,
      expectedSalary: body.expectedSalary !== undefined ? Number(body.expectedSalary) : undefined,
      cvUrl: body.cvUrl !== undefined ? body.cvUrl : undefined,
      interviewDate: body.interviewDate !== undefined ? body.interviewDate : undefined,
      status: body.status !== undefined ? body.status : undefined,
      note: body.note !== undefined ? body.note : undefined,
    },
  });

  if (body.interviewDate) {
    await notifyInterviewSchedule({
      actorId: user.id,
      candidateName: updated.fullName,
      candidateEmail: updated.email,
      position: updated.position,
      interviewTime: body.interviewDate,
      link: "/recruitment",
    });
  }

  return NextResponse.json({ application: updated });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.jobApplication.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
