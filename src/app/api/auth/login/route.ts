import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSessionToken, SESSION_COOKIE, UserRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      include: { department: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Tài khoản không tồn tại hoặc đã bị khóa" }, { status: 401 });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Mật khẩu không chính xác" }, { status: 401 });
    }

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      fullName: user.fullName,
      departmentId: user.departmentId,
      departmentCode: user.department.code,
      isTeamLead: user.isTeamLead,
    });

    await logAudit({
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      details: `${user.fullName} (${user.role}) đăng nhập hệ thống`,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        position: user.position,
        isTeamLead: user.isTeamLead,
        department: user.department,
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi đăng nhập" }, { status: 500 });
  }
}
