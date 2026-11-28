import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export interface ChatMessageItem {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderCode: string;
  senderRole: string;
  senderDept: string;
  senderEmpType: string;
  senderAvatar?: string | null;
  text: string;
  imageUrl?: string | null;
  reactions: Record<string, string[]>; // emoji -> userIds
  createdAt: string;
}

export interface ChatModerationState {
  mutedUntil: Record<string, number>; // userId -> epoch ms (-1 = forever)
  kicked: Record<string, string[]>; // channelId -> userIds[]
}

interface ChatStore {
  messages: ChatMessageItem[];
  moderation: ChatModerationState;
}

const CHAT_FILE = path.join(process.cwd(), "data", "company-chat.json");

const CHAT_CHANNELS = [
  { id: "GENERAL", name: "Nhóm Chung Toàn Công Ty", desc: "Tất cả phòng ban trao đổi & thông báo chung" },
  { id: "CROSS_DEPT", name: "Liên Phòng Ban (Phối hợp)", desc: "Kết nối Sales • Marketing • IT • Kế toán" },
  { id: "SALES", name: "Phòng Sales & Hợp đồng", desc: "Trao đổi khách hàng, quỹ phòng & lịch dẫn" },
  { id: "IT", name: "Phòng IT & Kỹ thuật", desc: "Hỗ trợ kỹ thuật, dự án & hạ tầng" },
  { id: "MARKETING", name: "Phòng Marketing", desc: "Chiến dịch quảng cáo, nội dung & leads" },
  { id: "ACCOUNTING", name: "Phòng Kế toán & Tài chính", desc: "Chứng từ, thu chi, lương & thanh toán" },
];

async function readChatStore(): Promise<ChatStore> {
  try {
    const raw = await readFile(CHAT_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ChatStore>;
    return {
      messages: parsed.messages || [],
      moderation: {
        mutedUntil: parsed.moderation?.mutedUntil || {},
        kicked: parsed.moderation?.kicked || {},
      },
    };
  } catch {
    return {
      messages: [
        {
          id: "welcome-msg-1",
          channelId: "GENERAL",
          senderId: "system",
          senderName: "Hệ thống NDAHOME",
          senderCode: "SYS",
          senderRole: "ADMIN",
          senderDept: "Ban Giám đốc",
          senderEmpType: "FULL_TIME",
          text: "Chào mừng toàn thể nhân sự NDAHOME đến với Nhóm Trao Đổi Nội Bộ! Mọi phòng ban có thể trao đổi công việc, gửi ảnh và thả cảm xúc tại đây.",
          reactions: { "🎉": [], "👍": [] },
          createdAt: new Date().toISOString(),
        },
      ],
      moderation: { mutedUntil: {}, kicked: {} },
    };
  }
}

async function saveChatStore(store: ChatStore) {
  await mkdir(path.dirname(CHAT_FILE), { recursive: true });
  await writeFile(CHAT_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function getMuteRemaining(mutedUntilVal?: number): { isMuted: boolean; label: string } {
  if (!mutedUntilVal) return { isMuted: false, label: "" };
  if (mutedUntilVal === -1) return { isMuted: true, label: "vô thời hạn" };
  const diff = mutedUntilVal - Date.now();
  if (diff <= 0) return { isMuted: false, label: "" };
  const mins = Math.ceil(diff / 60000);
  if (mins < 60) return { isMuted: true, label: `còn ${mins} phút` };
  const hours = Math.ceil(mins / 60);
  if (hours < 24) return { isMuted: true, label: `còn ${hours} giờ` };
  const days = Math.ceil(hours / 24);
  return { isMuted: true, label: `còn ${days} ngày` };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId") || "GENERAL";

  const [store, members] = await Promise.all([
    readChatStore(),
    prisma.user.findMany({
      include: { department: true },
      orderBy: { employeeCode: "asc" },
    }),
  ]);

  const kickedUsers = store.moderation.kicked[channelId] || [];
  const isKickedHere = user.role !== "ADMIN" && kickedUsers.includes(user.id);

  const visibleMessages = isKickedHere
    ? []
    : store.messages.filter((m) => m.channelId === channelId);

  const myMute = getMuteRemaining(store.moderation.mutedUntil[user.id]);

  const safeMembers = members.map((m) => {
    const mMute = getMuteRemaining(store.moderation.mutedUntil[m.id]);
    return {
      id: m.id,
      employeeCode: m.employeeCode,
      fullName: m.fullName,
      role: m.role,
      position: m.position,
      employmentType: m.employmentType,
      isTeamLead: m.isTeamLead,
      isActive: m.isActive,
      avatar: m.avatar,
      departmentName: m.department.name,
      isMuted: mMute.isMuted,
      muteLabel: mMute.label,
      isKickedFromChannel: kickedUsers.includes(m.id),
    };
  });

  return NextResponse.json({
    channels: CHAT_CHANNELS,
    messages: visibleMessages,
    members: safeMembers,
    isKickedHere,
    myMute,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const channelId = String(body.channelId || "GENERAL");
  const text = String(body.text || "").trim();
  const imageUrl = body.imageUrl ? String(body.imageUrl) : null;

  if (!text && !imageUrl) {
    return NextResponse.json({ error: "Vui lòng nhập nội dung hoặc chọn ảnh" }, { status: 400 });
  }

  const store = await readChatStore();
  const kickedUsers = store.moderation.kicked[channelId] || [];
  if (user.role !== "ADMIN" && kickedUsers.includes(user.id)) {
    return NextResponse.json({ error: "Bạn đã bị Admin mời khỏi kênh chat này." }, { status: 403 });
  }

  const myMute = getMuteRemaining(store.moderation.mutedUntil[user.id]);
  if (user.role !== "ADMIN" && myMute.isMuted) {
    return NextResponse.json(
      { error: `Bạn đang bị Admin tạm cấm nhắn tin (${myMute.label}).` },
      { status: 403 }
    );
  }

  const newMsg: ChatMessageItem = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    channelId,
    senderId: user.id,
    senderName: user.fullName,
    senderCode: user.employeeCode,
    senderRole: user.role,
    senderDept: user.department.name,
    senderEmpType: user.employmentType,
    senderAvatar: user.avatar,
    text,
    imageUrl,
    reactions: {},
    createdAt: new Date().toISOString(),
  };

  store.messages.push(newMsg);
  if (store.messages.length > 500) {
    store.messages = store.messages.slice(-500);
  }
  await saveChatStore(store);

  return NextResponse.json({ message: newMsg }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const store = await readChatStore();

  if (body.action === "REACT") {
    const msg = store.messages.find((m) => m.id === body.messageId);
    if (!msg) return NextResponse.json({ error: "Không tìm thấy tin nhắn" }, { status: 404 });
    const emoji = String(body.emoji || "👍");
    const currentList = msg.reactions[emoji] || [];
    if (currentList.includes(user.id)) {
      msg.reactions[emoji] = currentList.filter((id) => id !== user.id);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji] = [...currentList, user.id];
    }
    await saveChatStore(store);
    return NextResponse.json({ message: msg });
  }

  if (body.action === "DELETE_MSG") {
    const msg = store.messages.find((m) => m.id === body.messageId);
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "ADMIN" && msg.senderId !== user.id) {
      return NextResponse.json({ error: "Không có quyền xóa tin nhắn này" }, { status: 403 });
    }
    store.messages = store.messages.filter((m) => m.id !== body.messageId);
    await saveChatStore(store);
    return NextResponse.json({ ok: true });
  }

  // Các quyền kiểm duyệt chỉ dành cho ADMIN (Giám đốc)
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Giám đốc (Admin) mới có quyền kiểm duyệt thành viên" }, { status: 403 });
  }

  const targetUserId = String(body.targetUserId || "");
  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ error: "Không thể thực hiện trên tài khoản này" }, { status: 400 });
  }

  if (body.action === "MUTE") {
    const minutes = Number(body.minutes ?? 60);
    store.moderation.mutedUntil[targetUserId] =
      minutes === -1 ? -1 : Date.now() + minutes * 60 * 1000;
    await saveChatStore(store);
    await logAudit({
      userId: user.id,
      action: "CHAT_MUTE_USER",
      entity: "User",
      entityId: targetUserId,
      details: `Cấm nhắn tin thành viên ${targetUserId} (${minutes === -1 ? "vĩnh viễn" : `${minutes} phút`})`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "UNMUTE") {
    delete store.moderation.mutedUntil[targetUserId];
    await saveChatStore(store);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "KICK") {
    const ch = String(body.channelId || "GENERAL");
    const list = store.moderation.kicked[ch] || [];
    if (!list.includes(targetUserId)) {
      store.moderation.kicked[ch] = [...list, targetUserId];
    }
    await saveChatStore(store);
    await logAudit({
      userId: user.id,
      action: "CHAT_KICK_USER",
      entity: "User",
      entityId: targetUserId,
      details: `Mời thành viên ${targetUserId} khỏi kênh chat ${ch}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "UNKICK") {
    const ch = String(body.channelId || "GENERAL");
    const list = store.moderation.kicked[ch] || [];
    store.moderation.kicked[ch] = list.filter((id) => id !== targetUserId);
    await saveChatStore(store);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "BAN_USER" || body.action === "UNBAN_USER") {
    const isBan = body.action === "BAN_USER";
    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: !isBan },
    });
    await logAudit({
      userId: user.id,
      action: isBan ? "LOCK_USER" : "APPROVE_USER",
      entity: "User",
      entityId: targetUserId,
      details: `${isBan ? "Ban (khóa) tài khoản từ nhóm chat" : "Mở khóa tài khoản"}: ${updated.fullName}`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
