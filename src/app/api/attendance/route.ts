import { NextResponse } from "next/server";
import { getCurrentUser, canAccessFinance, UserRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope"); // "all" for accountant/admin, default personal
  const targetUserId = searchParams.get("userId");

  const canViewAll = (scope === "all" || Boolean(targetUserId)) && canAccessFinance(user.role as UserRole);
  const where = targetUserId && canViewAll ? { userId: targetUserId } : canViewAll ? {} : { userId: user.id };

  const [attendances, leaveRequests, adjustments] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, employeeCode: true, department: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.leaveRequest.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, employeeCode: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendanceAdjustment.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, employeeCode: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ attendances, leaveRequests, adjustments });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const today = new Date().toISOString().slice(0, 10);

  if (body.action === "CHECK_IN") {
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });
    if (existing?.checkIn) {
      return NextResponse.json({ error: "Bạn đã chấm công vào hôm nay rồi" }, { status: 400 });
    }
    const now = new Date();
    const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 15);
    const att = await prisma.attendance.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      update: { checkIn: now, status: isLate ? "LATE" : "PRESENT" },
      create: {
        userId: user.id,
        date: today,
        checkIn: now,
        status: isLate ? "LATE" : "PRESENT",
      },
    });
    await logAudit({ userId: user.id, action: "CHECK_IN", entity: "Attendance", entityId: att.id });
    return NextResponse.json({ attendance: att });
  }

  if (body.action === "CHECK_OUT") {
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    });
    if (!existing?.checkIn) {
      return NextResponse.json({ error: "Bạn chưa chấm công vào hôm nay" }, { status: 400 });
    }
    const now = new Date();
    const hours = Math.max(0, (now.getTime() - existing.checkIn.getTime()) / (1000 * 60 * 60));
    const att = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        workHours: Number(hours.toFixed(2)),
        overtimeHours: hours > 8.5 ? Number((hours - 8.5).toFixed(2)) : 0,
      },
    });
    await logAudit({ userId: user.id, action: "CHECK_OUT", entity: "Attendance", entityId: att.id });
    return NextResponse.json({ attendance: att });
  }

  if (body.action === "LEAVE_REQUEST") {
    const leave = await prisma.leaveRequest.create({
      data: {
        userId: user.id,
        leaveType: body.leaveType || "ANNUAL",
        startDate: body.startDate,
        endDate: body.endDate,
        days: Number(body.days) || 1,
        reason: body.reason,
        evidenceUrl: body.evidenceUrl || null,
      },
    });
    return NextResponse.json({ leaveRequest: leave }, { status: 201 });
  }

  if (body.action === "ADJUSTMENT_REQUEST") {
    const adj = await prisma.attendanceAdjustment.create({
      data: {
        userId: user.id,
        date: body.date,
        requestedCheckIn: body.requestedCheckIn,
        requestedCheckOut: body.requestedCheckOut,
        reason: body.reason,
      },
    });
    return NextResponse.json({ adjustment: adj }, { status: 201 });
  }

  if (body.action === "ADMIN_MARK_ATTENDANCE") {
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ Giám đốc mới được chấm công cho từng nhân sự" }, { status: 403 });
    }
    const { targetUserId, date, checkInTime, checkOutTime, status, note } = body;
    if (!targetUserId || !date) {
      return NextResponse.json({ error: "Thiếu thông tin nhân sự hoặc ngày" }, { status: 400 });
    }
    const checkIn = checkInTime ? new Date(`${date}T${checkInTime}:00`) : null;
    const checkOut = checkOutTime ? new Date(`${date}T${checkOutTime}:00`) : null;
    let workHours = 0;
    let overtimeHours = 0;
    if (checkIn && checkOut) {
      const diff = Math.max(0, (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
      workHours = Number(diff.toFixed(2));
      overtimeHours = diff > 8.5 ? Number((diff - 8.5).toFixed(2)) : 0;
    }

    const att = await prisma.attendance.upsert({
      where: { userId_date: { userId: targetUserId, date } },
      update: {
        checkIn,
        checkOut,
        workHours,
        overtimeHours,
        status: status || "PRESENT",
        note: note || null,
        isConfirmed: true,
      },
      create: {
        userId: targetUserId,
        date,
        checkIn,
        checkOut,
        workHours,
        overtimeHours,
        status: status || "PRESENT",
        note: note || null,
        isConfirmed: true,
      },
    });
    await logAudit({
      userId: user.id,
      action: "ADMIN_MARK_ATTENDANCE",
      entity: "Attendance",
      entityId: att.id,
      details: `Chấm công hộ cho ${targetUserId} ngày ${date} (${status || "PRESENT"})`,
    });
    return NextResponse.json({ attendance: att });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessFinance(user.role as UserRole)) {
    return NextResponse.json({ error: "Chỉ Kế toán/Giám đốc được xác nhận chấm công" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "CONFIRM_ATTENDANCE") {
    const updated = await prisma.attendance.update({
      where: { id: body.id },
      data: { isConfirmed: true },
    });
    return NextResponse.json({ attendance: updated });
  }

  if (body.action === "LOCK_MONTH") {
    await prisma.attendance.updateMany({
      where: { date: { startsWith: body.monthPrefix } },
      data: { isLocked: true, isConfirmed: true },
    });
    await logAudit({
      userId: user.id,
      action: "LOCK_ATTENDANCE",
      entity: "Attendance",
      details: `Chốt bảng công tháng ${body.monthPrefix}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "REVIEW_LEAVE") {
    const updated = await prisma.leaveRequest.update({
      where: { id: body.id },
      data: { status: body.status, approverId: user.id, reviewNote: body.reviewNote || null },
    });
    return NextResponse.json({ leaveRequest: updated });
  }

  if (body.action === "REVIEW_ADJUSTMENT") {
    const updated = await prisma.attendanceAdjustment.update({
      where: { id: body.id },
      data: { status: body.status, approverId: user.id, reviewNote: body.reviewNote || null },
    });
    return NextResponse.json({ adjustment: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
