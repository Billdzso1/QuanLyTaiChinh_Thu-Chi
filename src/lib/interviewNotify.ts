import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

interface NotifyInterviewParams {
  actorId: string;
  candidateName: string;
  candidateEmail?: string | null;
  position: string;
  interviewTime: string;
  link: string;
  targetUserId?: string;
}

/**
 * Gửi thông báo nội bộ (chuông thông báo) và email mời phỏng vấn (nếu đã cấu hình SMTP).
 */
export async function notifyInterviewSchedule(params: NotifyInterviewParams) {
  const { actorId, candidateName, candidateEmail, position, interviewTime, link, targetUserId } = params;
  const formattedTime = (() => {
    const d = new Date(interviewTime);
    return Number.isNaN(d.getTime()) ? interviewTime : d.toLocaleString("vi-VN");
  })();

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  const recipientIds = new Set<string>(admins.map((a) => a.id));
  if (targetUserId) recipientIds.add(targetUserId);

  if (recipientIds.size > 0) {
    await prisma.notification.createMany({
      data: Array.from(recipientIds).map((uid) => ({
        userId: uid,
        title: `Lịch hẹn phỏng vấn: ${candidateName}`,
        message: `Ứng viên ${candidateName} (${position}) có lịch phỏng vấn dự kiến lúc ${formattedTime}.`,
        type: "INFO",
        link,
      })),
    });
  }

  await logAudit({
    userId: actorId,
    action: "SCHEDULE_INTERVIEW",
    entity: "JobApplication",
    details: `Đặt lịch phỏng vấn cho ${candidateName} (${position}) lúc ${formattedTime}`,
  });

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass && candidateEmail) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `"NDAHOME Tuyển dụng" <${smtpUser}>`,
        to: candidateEmail,
        subject: `[NDAHOME] Thư mời phỏng vấn — Vị trí ${position}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; border: 1px solid #f59e0b; border-radius: 12px; padding: 24px;">
            <h2 style="color: #111; margin-top: 0;">Thư mời phỏng vấn — NDAHOME</h2>
            <p>Xin chào <strong>${candidateName}</strong>,</p>
            <p>Phòng Nhân sự NDAHOME trân trọng mời bạn tham gia buổi phỏng vấn cho vị trí <strong>${position}</strong>.</p>
            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
              <div><strong>Thời gian dự kiến:</strong> ${formattedTime}</div>
              <div><strong>Địa điểm:</strong> Tòa nhà More Building, Số 36 Mạc Đĩnh Chi, P. Tân Định, TP.HCM</div>
            </div>
            <p style="font-size: 13px; color: #555;">Nếu cần thay đổi lịch hẹn, vui lòng phản hồi lại email này hoặc liên hệ 098.48.43.052.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Send interview email error:", err);
    }
  }
}
