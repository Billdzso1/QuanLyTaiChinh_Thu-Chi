import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSessionToken, SESSION_COOKIE, UserRole } from "@/lib/auth";
import { verifyHumanToken } from "@/lib/humanGuard";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const { email, password, humanToken } = await request.json();
    const isHuman = await verifyHumanToken(humanToken);
    if (!isHuman) {
      return NextResponse.json(
        { error: "Vui lòng xác nhận 'Tôi không phải là người máy' trước khi đăng nhập." },
        { status: 400 }
      );
    }
    if (!email || !password) {
      return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      include: { department: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Tài khoản không tồn tại" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Tài khoản của bạn đang chờ Admin phê duyệt hoặc đã bị khóa. Vui lòng liên hệ Giám đốc." },
        { status: 403 }
      );
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
      token,
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
