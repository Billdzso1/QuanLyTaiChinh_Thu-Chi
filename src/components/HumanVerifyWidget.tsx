"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Check,
  Loader2,
  Home,
  KeyRound,
  Shield,
  Star,
  RefreshCw,
  Bot,
} from "lucide-react";

type GuardIconId = "HOME" | "KEY" | "SHIELD" | "STAR";

interface ChallengeState {
  challengeToken: string;
  targetLabel: string;
  options: { id: GuardIconId; label: string }[];
}

function renderIcon(id: GuardIconId) {
  switch (id) {
    case "HOME":
      return <Home className="w-5 h-5" />;
    case "KEY":
      return <KeyRound className="w-5 h-5" />;
    case "SHIELD":
      return <Shield className="w-5 h-5" />;
    case "STAR":
      return <Star className="w-5 h-5" />;
  }
}

export function HumanVerifyWidget({
  verifiedToken,
  onVerified,
}: {
  verifiedToken: string;
  onVerified: (token: string) => void;
}) {
  const [status, setStatus] = useState<"IDLE" | "SCANNING" | "CHALLENGE" | "VERIFIED">(
    verifiedToken ? "VERIFIED" : "IDLE"
  );
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function startVerification() {
    if (status === "SCANNING" || status === "VERIFIED") return;
    setErrMsg("");
    setStatus("SCANNING");
    try {
      const [res] = await Promise.all([
        fetch("/api/auth/human-check"),
        new Promise((r) => setTimeout(r, 380)),
      ]);
      const data = await res.json();
      if (!res.ok) {
        setErrMsg("Không khởi tạo được xác thực AI.");
        setStatus("IDLE");
        return;
      }
      setChallenge({
        challengeToken: data.challengeToken,
        targetLabel: data.targetLabel,
        options: data.options,
      });
      setStatus("CHALLENGE");
    } catch {
      setErrMsg("Lỗi kết nối xác thực AI.");
      setStatus("IDLE");
    }
  }

  async function handleSelectOption(selectedId: GuardIconId) {
    if (!challenge || submitting) return;
    setSubmitting(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/auth/human-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken: challenge.challengeToken,
          selectedId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.humanToken) {
        setErrMsg(data.error || "Xác thực chưa đúng, thử lại.");
        setSubmitting(false);
        await startVerification();
        return;
      }
      onVerified(data.humanToken);
      setStatus("VERIFIED");
      setChallenge(null);
    } catch {
      setErrMsg("Lỗi kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    onVerified("");
    setChallenge(null);
    setErrMsg("");
    setStatus("IDLE");
  }

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        status === "VERIFIED"
          ? "bg-emerald-50/70 border-emerald-300"
          : "bg-neutral-50 border-neutral-300"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={status === "IDLE" ? startVerification : undefined}
          disabled={status === "VERIFIED" || status === "SCANNING"}
          className="flex items-center gap-2.5 text-left cursor-pointer disabled:cursor-default"
        >
          <span
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
              status === "VERIFIED"
                ? "bg-emerald-600 border-emerald-600 text-white"
                : status === "SCANNING"
                  ? "border-amber-500 bg-amber-50"
                  : "border-neutral-400 bg-white hover:border-amber-500"
            }`}
          >
            {status === "VERIFIED" && <Check className="w-4 h-4 stroke-[3]" />}
            {status === "SCANNING" && <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
          </span>
          <div>
            <div className="text-xs font-bold text-neutral-900">
              {status === "VERIFIED"
                ? "Đã xác nhận không phải người máy"
                : status === "SCANNING"
                  ? "AI đang kiểm tra bảo mật..."
                  : "Tôi không phải là người máy"}
            </div>
            <div className="text-[11px] text-neutral-500">
              {status === "VERIFIED"
                ? "Xác thực AI hoàn tất • Phiên hợp lệ"
                : "Bấm vào ô vuông để xác thực chống robot"}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {status === "VERIFIED" ? (
            <button
              type="button"
              onClick={handleReset}
              title="Xác thực lại"
              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex flex-col items-end">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                <Bot className="w-3 h-3" /> AI Guard
              </span>
            </div>
          )}
        </div>
      </div>

      {status === "CHALLENGE" && challenge && (
        <div className="mt-3 pt-3 border-t border-neutral-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-700 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Hãy bấm chọn biểu tượng:{" "}
              <strong className="text-neutral-950 underline decoration-amber-500">
                {challenge.targetLabel}
              </strong>
            </span>
            <button
              type="button"
              onClick={startVerification}
              className="text-[11px] text-neutral-500 hover:text-neutral-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Đổi
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {challenge.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={submitting}
                onClick={() => handleSelectOption(opt.id)}
                className="flex items-center justify-center py-3 px-2 rounded-lg border border-neutral-300 bg-white hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 text-neutral-800 transition cursor-pointer disabled:opacity-50"
              >
                {renderIcon(opt.id)}
              </button>
            ))}
          </div>
        </div>
      )}

      {errMsg && (
        <div className="mt-2 text-[11px] font-medium text-rose-600">{errMsg}</div>
      )}
    </div>
  );
}
