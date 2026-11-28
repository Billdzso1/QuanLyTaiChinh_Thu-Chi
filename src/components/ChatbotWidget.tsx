"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bot, Send, X, Sparkles, ArrowRight } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  links?: { label: string; href: string }[];
}

const QUICK_QUESTIONS = [
  "Hiện có bao nhiêu phòng trống?",
  "Lương tháng này của tôi?",
  "Chấm công & đề xuất của tôi?",
  "Thống kê nhân sự & phỏng vấn?",
];

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      text: "Chào bạn! Mình là **Trợ lý AI Dữ liệu NDAHOME**. Hãy hỏi mình về phòng trống, lương cá nhân, chấm công, nhân sự, dự án hoặc số liệu hệ thống nhé!",
    },
  ]);

  async function askBot(questionText: string) {
    const q = questionText.trim();
    if (!q || loading) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const d = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: res.ok ? d.answer : d.error || "Không thể tra cứu dữ liệu lúc này.",
          links: d.links || [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, role: "bot", text: "Lỗi kết nối máy chủ chatbot." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderFormattedText(text: string) {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={i} className={line.trim() === "" ? "h-1.5" : "leading-relaxed"}>
          {parts.map((part, idx) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={idx} className="font-bold">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={idx}>{part}</span>
            )
          )}
        </div>
      );
    });
  }

  return (
    <div className="fixed bottom-6 left-6 z-40 no-print">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white shadow-xl shadow-indigo-500/35 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          title="Mở Trợ lý dữ liệu NDAHOME"
        >
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
            <Bot className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-indigo-600 animate-pulse" />
          </span>
          <span className="text-xs font-bold tracking-wide">Trợ lý AI Dữ liệu</span>
        </button>
      ) : (
        <div className="w-[340px] sm:w-[390px] h-[510px] bg-white rounded-3xl border border-indigo-200 shadow-2xl shadow-indigo-950/20 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-extrabold">Trợ lý AI NDAHOME</div>
                <div className="text-[10px] text-sky-100">Tra cứu dữ liệu trực tiếp theo phân quyền</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/70">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs shadow-2xs ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-br-sm"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                  }`}
                >
                  {renderFormattedText(m.text)}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {m.links.map((lk) => (
                        <Link
                          key={lk.href}
                          href={lk.href}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px]"
                        >
                          {lk.label} <ArrowRight className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-[11px] text-slate-400 italic px-2">Đang tổng hợp dữ liệu...</div>
            )}
          </div>

          {/* Quick Questions */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askBot(q)}
                className="shrink-0 px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium border border-indigo-200/70 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askBot(input);
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi về phòng, lương, nhân sự..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white flex items-center justify-center disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
