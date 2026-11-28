"use client";

import React, { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AttachmentPreviewModal } from "@/components/AttachmentPreviewModal";
import {
  MessageSquare,
  Send,
  Image as ImageIcon,
  Smile,
  Crown,
  Calculator,
  Building2,
  Cpu,
  Megaphone,
  Home,
  GraduationCap,
  ShieldAlert,
  VolumeX,
  Volume2,
  UserMinus,
  UserPlus,
  Ban,
  Unlock,
  Trash2,
  Users,
  Hash,
  X,
} from "lucide-react";

interface ChatChannel {
  id: string;
  name: string;
  desc: string;
}

interface ChatMsg {
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
  reactions: Record<string, string[]>;
  createdAt: string;
}

interface ChatMember {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  position: string;
  employmentType: string;
  isTeamLead: boolean;
  isActive: boolean;
  avatar?: string | null;
  departmentName: string;
  isMuted: boolean;
  muteLabel: string;
  isKickedFromChannel: boolean;
}

const EMOJI_CHOICES = ["👍", "❤️", "😂", "🎉", "🔥", "👏"];
const QUICK_TEXT_EMOJIS = ["😀", "😂", "😍", "🥳", "👍", "👏", "🔥", "❤️", "🎉", "🙏", "✅", "🚀"];

function getRoleTheme(role: string, empType?: string) {
  if (empType === "INTERN") {
    return {
      frame: "ring-2 ring-teal-400 bg-gradient-to-br from-teal-500 to-emerald-500",
      pill: "bg-teal-100 text-teal-800 border-teal-300",
      bubbleBorder: "border-l-4 border-l-teal-400",
      label: "Thực tập sinh",
      Icon: GraduationCap,
    };
  }
  const map: Record<
    string,
    { frame: string; pill: string; bubbleBorder: string; label: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    ADMIN: {
      frame: "ring-2 ring-indigo-500 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500",
      pill: "bg-indigo-100 text-indigo-800 border-indigo-300",
      bubbleBorder: "border-l-4 border-l-indigo-500",
      label: "Giám đốc",
      Icon: Crown,
    },
    ACCOUNTANT: {
      frame: "ring-2 ring-emerald-500 bg-gradient-to-br from-emerald-500 to-teal-600",
      pill: "bg-emerald-100 text-emerald-800 border-emerald-300",
      bubbleBorder: "border-l-4 border-l-emerald-500",
      label: "Kế toán",
      Icon: Calculator,
    },
    SALES: {
      frame: "ring-2 ring-sky-500 bg-gradient-to-br from-sky-500 to-cyan-500",
      pill: "bg-sky-100 text-sky-800 border-sky-300",
      bubbleBorder: "border-l-4 border-l-sky-500",
      label: "Sales",
      Icon: Building2,
    },
    IT: {
      frame: "ring-2 ring-violet-500 bg-gradient-to-br from-violet-600 to-purple-600",
      pill: "bg-violet-100 text-violet-800 border-violet-300",
      bubbleBorder: "border-l-4 border-l-violet-500",
      label: "Phòng IT",
      Icon: Cpu,
    },
    MARKETING: {
      frame: "ring-2 ring-rose-500 bg-gradient-to-br from-rose-500 to-pink-600",
      pill: "bg-rose-100 text-rose-800 border-rose-300",
      bubbleBorder: "border-l-4 border-l-rose-500",
      label: "Marketing",
      Icon: Megaphone,
    },
    LANDLORD: {
      frame: "ring-2 ring-amber-500 bg-gradient-to-br from-amber-500 to-orange-500",
      pill: "bg-amber-100 text-amber-800 border-amber-300",
      bubbleBorder: "border-l-4 border-l-amber-500",
      label: "Chủ trọ",
      Icon: Home,
    },
  };
  return (
    map[role] || {
      frame: "ring-2 ring-slate-400 bg-slate-600",
      pill: "bg-slate-100 text-slate-800 border-slate-300",
      bubbleBorder: "border-l-4 border-l-slate-400",
      label: role,
      Icon: Users,
    }
  );
}

export default function CompanyChatPage() {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState("GENERAL");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [isKickedHere, setIsKickedHere] = useState(false);
  const [myMute, setMyMute] = useState<{ isMuted: boolean; label: string }>({ isMuted: false, label: "" });
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [modMember, setModMember] = useState<ChatMember | null>(null);
  const [muteMinutes, setMuteMinutes] = useState("60");
  const endRef = useRef<HTMLDivElement>(null);

  async function loadChat(ch = activeChannel) {
    try {
      const [res, meRes] = await Promise.all([
        fetch(`/api/chat?channelId=${ch}`, { cache: "no-store" }),
        fetch("/api/auth/me", { cache: "no-store" }),
      ]);
      if (meRes.ok) {
        const m = await meRes.json().catch(() => null);
        if (m?.user) setMe({ id: m.user.id, role: m.user.role });
      }
      if (res.ok) {
        const d = await res.json().catch(() => null);
        if (d) {
          setChannels(d.channels || []);
          setMessages(d.messages || []);
          setMembers(d.members || []);
          setIsKickedHere(Boolean(d.isKickedHere));
          setMyMute(d.myMute || { isMuted: false, label: "" });
        }
      }
    } catch {
      // Bỏ qua lỗi mạng tạm thời khi tự động làm mới mỗi 4 giây
    }
  }

  useEffect(() => {
    loadChat(activeChannel);
    const timer = setInterval(() => loadChat(activeChannel), 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) {
        setImageUrl(d.url);
      } else {
        setErrorMsg(d.error || "Không tải được ảnh lên máy chủ");
      }
    } catch {
      setErrorMsg("Lỗi kết nối khi tải ảnh lên");
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (sending || (!text.trim() && !imageUrl)) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: activeChannel, text, imageUrl: imageUrl || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(d.error || `Không gửi được tin nhắn (mã ${res.status})`);
        return;
      }
      setText("");
      setImageUrl("");
      setShowEmojiPicker(false);
      await loadChat(activeChannel);
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ khi gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    try {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REACT", messageId, emoji }),
      });
      loadChat(activeChannel);
    } catch {
      setErrorMsg("Không thể thả cảm xúc lúc này.");
    }
  }

  async function handleDeleteMsg(messageId: string) {
    try {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_MSG", messageId }),
      });
      loadChat(activeChannel);
    } catch {
      setErrorMsg("Không thể xóa tin nhắn lúc này.");
    }
  }

  async function handleModerate(
    action: "MUTE" | "UNMUTE" | "KICK" | "UNKICK" | "BAN_USER" | "UNBAN_USER",
    targetUserId: string,
    extra?: { minutes?: number }
  ) {
    try {
      const res = await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetUserId,
          channelId: activeChannel,
          minutes: extra?.minutes,
        }),
      });
      if (res.ok) {
        setModMember(null);
        loadChat(activeChannel);
      }
    } catch {
      setErrorMsg("Không thể thực hiện kiểm duyệt lúc này.");
    }
  }

  const currentChannelInfo = channels.find((c) => c.id === activeChannel);
  const isAdmin = me?.role === "ADMIN";

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-indigo-600" />
              Nhóm Trao Đổi Toàn Công Ty NDAHOME
            </h1>
            <p className="text-sm text-slate-500">
              Kết nối liên phòng ban (Sales • IT • Marketing • Kế toán • Giám đốc), gửi ảnh, thả icon &amp; quản trị nhóm
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[74vh] min-h-[540px]">
          {/* Left: Channels */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-3 flex flex-col overflow-hidden">
            <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" /> Kênh Liên Phòng Ban
            </div>
            <div className="mt-2 space-y-1.5 overflow-y-auto flex-1">
              {channels.map((ch) => {
                const active = ch.id === activeChannel;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChannel(ch.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                      active
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/25"
                        : "hover:bg-indigo-50/70 text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>#</span>
                      <span className="truncate">{ch.name}</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 line-clamp-1 ${active ? "text-sky-100" : "text-slate-400"}`}>
                      {ch.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center: Chat Stream */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/40 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">
                  # {currentChannelInfo?.name || "Nhóm Chung Toàn Công Ty"}
                </div>
                <div className="text-[11px] text-slate-500">{currentChannelInfo?.desc}</div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                {members.filter((m) => m.isActive && !m.isKickedFromChannel).length} thành viên
              </span>
            </div>

            {isKickedHere ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2">
                <UserMinus className="w-10 h-10 text-rose-500" />
                <div className="font-bold text-slate-900">Bạn đã bị mời khỏi kênh này</div>
                <div className="text-xs text-slate-500">Vui lòng liên hệ Giám đốc (Admin) nếu cần tham gia lại.</div>
              </div>
            ) : (
              <>
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                  {messages.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-10">
                      Chưa có tin nhắn nào trong kênh này. Hãy bắt đầu cuộc trò chuyện!
                    </div>
                  ) : (
                    messages.map((m) => {
                      const theme = getRoleTheme(m.senderRole, m.senderEmpType);
                      const RoleIcon = theme.Icon;
                      const isMine = me?.id === m.senderId;
                      return (
                        <div key={m.id} className="group flex items-start gap-2.5">
                          {/* Avatar với khung viền màu & icon riêng theo vai trò */}
                          <div className="relative shrink-0 mt-0.5">
                            <div className={`p-0.5 rounded-full ${theme.frame}`}>
                              {m.senderAvatar ? (
                                <img
                                  src={m.senderAvatar}
                                  alt={m.senderName}
                                  className="w-9 h-9 rounded-full object-cover bg-white ring-2 ring-white"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-xs">
                                  {m.senderName.split(" ").slice(-1)[0]?.[0] || "N"}
                                </div>
                              )}
                            </div>
                            <span
                              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border flex items-center justify-center shadow-2xs ${theme.pill}`}
                              title={theme.label}
                            >
                              <RoleIcon className="w-2.5 h-2.5" />
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">{m.senderName}</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${theme.pill}`}>
                                <RoleIcon className="w-2.5 h-2.5" />
                                {theme.label}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {m.senderDept} • {new Date(m.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {(isAdmin || isMine) && m.senderId !== "system" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMsg(m.id)}
                                  className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer transition-opacity"
                                  title="Xóa tin nhắn"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className={`mt-1 bg-white rounded-2xl rounded-tl-sm border border-slate-200 ${theme.bubbleBorder} px-3.5 py-2 shadow-2xs inline-block max-w-full`}>
                              {m.text && <p className="text-xs text-slate-800 whitespace-pre-wrap break-words">{m.text}</p>}
                              {m.imageUrl && (
                                <img
                                  src={m.imageUrl}
                                  alt="Ảnh đính kèm"
                                  onClick={() => setPreviewImg(m.imageUrl || null)}
                                  className="mt-2 max-h-56 rounded-xl border border-slate-200 object-cover cursor-pointer hover:opacity-95"
                                />
                              )}
                            </div>

                            {/* Reactions & Quick React Bar */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              {Object.entries(m.reactions || {}).map(([emoji, uids]) => {
                                if (!uids || uids.length === 0) return null;
                                const reacted = me ? uids.includes(me.id) : false;
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleReact(m.id, emoji)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border cursor-pointer transition-transform hover:scale-105 ${
                                      reacted
                                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold"
                                        : "bg-white border-slate-200 text-slate-600"
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span>{uids.length}</span>
                                  </button>
                                );
                              })}
                              <div className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 bg-white border border-slate-200 rounded-full px-1.5 py-0.5 shadow-2xs transition-opacity">
                                {EMOJI_CHOICES.map((em) => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => handleReact(m.id, em)}
                                    className="hover:scale-125 transition-transform text-xs px-0.5 cursor-pointer"
                                    title={`Thả ${em}`}
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                {/* Compose Box */}
                <div className="p-3 border-t border-slate-200 bg-white space-y-2">
                  {myMute.isMuted && !isAdmin && (
                    <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <VolumeX className="w-4 h-4 shrink-0" />
                      Bạn đang bị Admin cấm nhắn tin ({myMute.label}).
                    </div>
                  )}
                  {errorMsg && (
                    <div className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs">{errorMsg}</div>
                  )}
                  {imageUrl && (
                    <div className="relative inline-block">
                      <img src={imageUrl} alt="Preview" className="h-16 rounded-lg border border-indigo-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {showEmojiPicker && (
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
                      {QUICK_TEXT_EMOJIS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setText((t) => t + em)}
                          className="text-base hover:scale-125 transition-transform px-1 cursor-pointer"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                  <form onSubmit={handleSend} className="flex items-center gap-2">
                    <label
                      className="p-2 rounded-xl border border-slate-200 hover:bg-indigo-50 text-indigo-600 cursor-pointer shrink-0"
                      title="Gửi hình ảnh"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-amber-50 text-amber-600 cursor-pointer shrink-0"
                      title="Chèn icon"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    <input
                      disabled={(myMute.isMuted && !isAdmin) || uploadingImg}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={
                        uploadingImg
                          ? "Đang tải ảnh lên..."
                          : `Nhắn tin tới #${currentChannelInfo?.name || "Nhóm công ty"}...`
                      }
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={sending || (myMute.isMuted && !isAdmin) || (!text.trim() && !imageUrl)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" /> {sending ? "Đang gửi..." : "Gửi"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* Right: Members & Admin Moderation */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-3 flex flex-col overflow-hidden">
            <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" /> Thành viên ({members.length})
              </span>
              {isAdmin && (
                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                  Admin kiểm duyệt
                </span>
              )}
            </div>
            <div className="mt-2 space-y-2 overflow-y-auto flex-1 pr-1">
              {members.map((mb) => {
                const theme = getRoleTheme(mb.role, mb.employmentType);
                const RoleIcon = theme.Icon;
                return (
                  <div
                    key={mb.id}
                    className={`p-2 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                      !mb.isActive
                        ? "bg-rose-50/60 border-rose-200"
                        : mb.isKickedFromChannel
                          ? "bg-slate-100 border-slate-200 opacity-75"
                          : "bg-slate-50/70 border-slate-200/80 hover:border-indigo-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-0.5 rounded-full shrink-0 ${theme.frame}`}>
                        {mb.avatar ? (
                          <img src={mb.avatar} alt={mb.fullName} className="w-7 h-7 rounded-full object-cover bg-white" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-[10px]">
                            {mb.fullName.split(" ").slice(-1)[0]?.[0] || "N"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                          {mb.fullName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full border text-[9px] font-bold ${theme.pill}`}>
                            <RoleIcon className="w-2.5 h-2.5" />
                            {theme.label}
                          </span>
                          {mb.isMuted && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                              Cấm chat ({mb.muteLabel})
                            </span>
                          )}
                          {mb.isKickedFromChannel && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[9px] font-bold">
                              Đã kick
                            </span>
                          )}
                          {!mb.isActive && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">
                              Đã ban
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdmin && mb.id !== me?.id && (
                      <button
                        type="button"
                        onClick={() => setModMember(mb)}
                        className="p-1.5 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-700 cursor-pointer shrink-0"
                        title="Quản lý / Kiểm duyệt thành viên"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Admin Moderation Modal */}
        {modMember && isAdmin && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
              <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Kiểm duyệt thành viên: {modMember.fullName}</h3>
                  <p className="text-[11px] text-sky-100">
                    {modMember.employeeCode} • {modMember.departmentName}
                  </p>
                </div>
                <button onClick={() => setModMember(null)} className="text-white/80 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Cấm nhắn tin theo thời hạn */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900">1. Cấm nhắn tin (Mute) trong nhóm</div>
                  <div className="flex gap-2">
                    <select
                      value={muteMinutes}
                      onChange={(e) => setMuteMinutes(e.target.value)}
                      className="flex-1 border border-amber-300 bg-white rounded-lg px-3 py-1.5 text-xs"
                    >
                      <option value="15">15 phút</option>
                      <option value="60">1 giờ</option>
                      <option value="1440">24 giờ (1 ngày)</option>
                      <option value="10080">7 ngày</option>
                      <option value="-1">Vĩnh viễn</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleModerate("MUTE", modMember.id, { minutes: Number(muteMinutes) })}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <VolumeX className="w-3.5 h-3.5" /> Cấm chat
                    </button>
                  </div>
                  {modMember.isMuted && (
                    <button
                      type="button"
                      onClick={() => handleModerate("UNMUTE", modMember.id)}
                      className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Gỡ cấm nhắn tin ngay
                    </button>
                  )}
                </div>

                {/* Kick khỏi kênh */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900">2. Kick khỏi kênh #{currentChannelInfo?.name}</div>
                    <div className="text-[11px] text-slate-500">Không xem và không nhắn được trong kênh này</div>
                  </div>
                  {modMember.isKickedFromChannel ? (
                    <button
                      type="button"
                      onClick={() => handleModerate("UNKICK", modMember.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Mời lại
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleModerate("KICK", modMember.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <UserMinus className="w-3.5 h-3.5" /> Kick nhóm
                    </button>
                  )}
                </div>

                {/* Ban tài khoản toàn hệ thống */}
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-rose-900">3. Ban / Khóa tài khoản hệ thống</div>
                    <div className="text-[11px] text-rose-700">Ngắt quyền đăng nhập toàn hệ thống NDAHOME</div>
                  </div>
                  {modMember.isActive ? (
                    <button
                      type="button"
                      onClick={() => handleModerate("BAN_USER", modMember.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Ban className="w-3.5 h-3.5" /> Ban Acc
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleModerate("UNBAN_USER", modMember.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Mở Acc
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <AttachmentPreviewModal url={previewImg} title="Ảnh trong nhóm chat" onClose={() => setPreviewImg(null)} />
      </div>
    </AppShell>
  );
}
