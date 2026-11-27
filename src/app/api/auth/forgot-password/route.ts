import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

interface OtpEntry {
  email: string;
  otp: string;
  expiresAt: number;
}

const OTP_FILE = path.join(process.cwd(), "data", "password-reset-otps.json");

function normalizeStr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function readOtps(): Promise<Record<string, OtpEntry>> {
  try {
    const raw = await readFile(OTP_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveOtps(data: Record<string, OtpEntry>) {
  await mkdir(path.dirname(OTP_FILE), { recursive: true });
  await writeFile(OTP_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const departments = await prisma.department.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ departments });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "REQUEST_OTP") {
      const fullName = String(body.fullName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const departmentCode = String(body.departmentCode || "").trim();

      if (!fullName || !email || !departmentCode) {
        return NextResponse.json(
          { error: "Vui lòng nhập đầy đủ họ tên, email và phòng ban." },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { department: true },
      });

      const nameMatches = user && normalizeStr(user.fullName) === normalizeStr(fullName);
      const deptMatches =
        user &&
        (user.department.code === departmentCode ||
          normalizeStr(user.department.name) === normalizeStr(departmentCode));

      if (!user || !nameMatches || !deptMatches) {
        return NextResponse.json(
          { error: "Thông tin họ tên, email hoặc phòng ban không khớp với tài khoản đã đăng ký." },
          { status: 400 }
        );
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const otps = await readOtps();
      otps[email] = {
        email,
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
      await saveOtps(otps);

      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({
          from: `"NDAHOME Management" <${smtpUser}>`,
          to: user.email,
          subject: "[NDAHOME] Mã OTP khôi phục mật khẩu",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; border: 1px solid #f59e0b; border-radius: 12px; padding: 24px;">
              <h2 style="color: #111; margin-top: 0;">Khôi phục mật khẩu NDAHOME</h2>
              <p>Xin chào <strong>${user.fullName}</strong> (${user.department.name}),</p>
              <p>Mã OTP xác nhận đặt lại mật khẩu của bạn là:</p>
              <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #d97706; background: #fffbeb; padding: 12px 18px; border-radius: 8px; text-align: center; margin: 16px 0;">
                ${otp}
              </div>
              <p style="font-size: 13px; color: #555;">Mã có hiệu lực trong <strong>10 phút</strong>. Vui lòng không chia sẻ mã này cho người khác.</p>
            </div>
          `,
        });

        return NextResponse.json({
          ok: true,
          sentViaEmail: true,
          message: `Mã OTP 6 số đã được gửi về email ${user.email} (hiệu lực 10 phút).`,
        });
      }

      console.info(`[NDAHOME OTP] Email: ${user.email} | OTP: ${otp}`);
      return NextResponse.json({
        ok: true,
        sentViaEmail: false,
        demoOtp: otp,
        message: "Chưa cấu hình SMTP Gmail trong .env — hiển thị mã OTP kiểm thử tại đây (hiệu lực 10 phút):",
      });
    }

    if (action === "RESET_PASSWORD") {
      const email = String(body.email || "").trim().toLowerCase();
      const otp = String(body.otp || "").trim();
      const newPassword = String(body.newPassword || "");

      if (!email || !otp || newPassword.length < 6) {
        return NextResponse.json(
          { error: "Vui lòng nhập đầy đủ mã OTP và mật khẩu mới (tối thiểu 6 ký tự)." },
          { status: 400 }
        );
      }

      const otps = await readOtps();
      const entry = otps[email];
      if (!entry || entry.otp !== otp) {
        return NextResponse.json({ error: "Mã OTP không chính xác." }, { status: 400 });
      }
      if (Date.now() > entry.expiresAt) {
        return NextResponse.json({ error: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const updated = await prisma.user.update({
        where: { email },
        data: { passwordHash },
      });

      delete otps[email];
      await saveOtps(otps);

      await logAudit({
        userId: updated.id,
        action: "RESET_PASSWORD",
        entity: "User",
        entityId: updated.id,
        details: `${updated.fullName} đã đặt lại mật khẩu qua OTP`,
      });

      return NextResponse.json({
        ok: true,
        message: "Đổi mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Lỗi hệ thống khi xử lý quên mật khẩu" }, { status: 500 });
  }
}
