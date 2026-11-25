import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      employeeCode: user.employeeCode,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      position: user.position,
      employmentType: user.employmentType,
      isTeamLead: user.isTeamLead,
      baseSalary: user.baseSalary,
      allowance: user.allowance,
      kpiTarget: user.kpiTarget,
      joinedAt: user.joinedAt,
      department: user.department,
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "CHANGE_PASSWORD") {
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return NextResponse.json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" }, { status: 400 });
    }
    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await logAudit({ userId: user.id, action: "CHANGE_PASSWORD", entity: "User", entityId: user.id });
    return NextResponse.json({ ok: true, message: "Đổi mật khẩu thành công" });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: body.fullName ?? user.fullName,
      phone: body.phone ?? user.phone,
    },
    include: { department: true },
  });

  await logAudit({ userId: user.id, action: "UPDATE_PROFILE", entity: "User", entityId: user.id });
  return NextResponse.json({ user: updated });
}
