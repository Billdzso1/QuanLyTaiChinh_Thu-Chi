"use client";

import React, { useEffect, useRef, useState } from "react";
import { Crown, Gift, Sparkles, Trophy, X, RotateCw } from "lucide-react";
import { formatVND } from "@/lib/finance";

function FireworksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#facc15", "#f59e0b", "#10b981", "#38bdf8", "#f43f5e", "#a855f7", "#ffffff"];
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
      size: number;
    }
    const particles: Particle[] = [];

    const spawnBurst = (cx: number, cy: number) => {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const count = 42;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
        const speed = 2 + Math.random() * 5.2;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: i % 4 === 0 ? "#ffffff" : color,
          size: 2 + Math.random() * 2.2,
        });
      }
    };

    // Bắn vài chùm pháo hoa ngay lúc vừa mở
    spawnBurst(window.innerWidth * 0.2, window.innerHeight * 0.25);
    spawnBurst(window.innerWidth * 0.8, window.innerHeight * 0.22);
    spawnBurst(window.innerWidth * 0.5, window.innerHeight * 0.18);

    const interval = setInterval(() => {
      const x = window.innerWidth * (0.1 + Math.random() * 0.8);
      const y = window.innerHeight * (0.1 + Math.random() * 0.45);
      spawnBurst(x, y);
    }, 750);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06; // trọng lực rơi nhẹ
        p.vx *= 0.985;
        p.alpha -= 0.014;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

interface KpiPrize {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}

interface RewardRecord {
  mode: "WHEEL" | "DRAW";
  prize: KpiPrize;
  claimedAt: string;
}

const CONFETTI_PIECES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 7) % 20) * 0.12}s`,
  duration: `${2.6 + ((i * 5) % 12) * 0.2}s`,
  color: ["#facc15", "#f59e0b", "#10b981", "#38bdf8", "#f43f5e", "#ffffff"][i % 6],
  size: 6 + (i % 5) * 2,
}));

export function TopKpiCelebrationModal({ userRole, userName }: { userRole?: string; userName?: string }) {
  const [open, setOpen] = useState(false);
  const [isTopKpi, setIsTopKpi] = useState(false);
  const [revenue, setRevenue] = useState(0);
  const [prizes, setPrizes] = useState<KpiPrize[]>([]);
  const [rewardClaimed, setRewardClaimed] = useState<RewardRecord | null>(null);
  const [mode, setMode] = useState<"CHOICE" | "WHEEL" | "DRAW">("CHOICE");

  // Wheel animation state
  const [spinning, setSpinning] = useState(false);
  const [wheelDeg, setWheelDeg] = useState(0);

  // Lucky draw state
  const [drawingIdx, setDrawingIdx] = useState<number | null>(null);
  const [openedIdx, setOpenedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (userRole !== "SALES") return;
    let active = true;
    fetch("/api/sales/top-kpi-reward")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setIsTopKpi(Boolean(d.isTopKpi));
        setRevenue(d.revenue || 0);
        setPrizes(d.prizes || []);
        setRewardClaimed(d.rewardClaimed || null);

        if (d.isTopKpi && !d.rewardClaimed) {
          const seenKey = `ndahome_kpi_popup_${d.monthKey}`;
          if (!sessionStorage.getItem(seenKey)) {
            setOpen(true);
            sessionStorage.setItem(seenKey, "1");
          }
        }
      });
    return () => {
      active = false;
    };
  }, [userRole]);

  async function handleSpinWheel() {
    if (spinning || rewardClaimed || prizes.length === 0) return;
    setSpinning(true);
    const res = await fetch("/api/sales/top-kpi-reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "WHEEL" }),
    });
    if (!res.ok) {
      setSpinning(false);
      return;
    }
    const d = await res.json();
    const targetIndex =
      typeof d.prizeIndex === "number"
        ? d.prizeIndex
        : Math.max(
            0,
            prizes.findIndex((p) => p.id === d.rewardClaimed?.prize?.id)
          );

    const sliceAngle = 360 / prizes.length;
    const centerOfSlice = targetIndex * sliceAngle + sliceAngle / 2;
    const targetRotation = 360 * 6 + (360 - centerOfSlice);
    setWheelDeg((prev) => prev - (prev % 360) + targetRotation);

    setTimeout(() => {
      setSpinning(false);
      setRewardClaimed(d.rewardClaimed);
    }, 4200);
  }

  async function handlePickEnvelope(idx: number) {
    if (drawingIdx !== null || rewardClaimed) return;
    setDrawingIdx(idx);
    const res = await fetch("/api/sales/top-kpi-reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "DRAW" }),
    });
    if (!res.ok) {
      setDrawingIdx(null);
      return;
    }
    const d = await res.json();
    setTimeout(() => {
      setOpenedIdx(idx);
      setDrawingIdx(null);
      setRewardClaimed(d.rewardClaimed);
    }, 900);
  }

  if (!isTopKpi) return null;

  const sliceAngle = prizes.length > 0 ? 360 / prizes.length : 45;
  const wheelGradient =
    prizes.length > 0
      ? `conic-gradient(${prizes
          .map((p, i) => `${p.color} ${i * sliceAngle}deg ${(i + 1) * sliceAngle}deg`)
          .join(", ")})`
      : undefined;

  return (
    <>
      {/* Nút mở lại quà Top 1 KPI trên thanh trên cùng hoặc góc phải */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-6 z-40 px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-neutral-950 font-bold text-xs shadow-xl border-2 border-neutral-950 inline-flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer animate-bounce"
      >
        <Trophy className="w-4 h-4" />
        {rewardClaimed ? "Quà Top 1 KPI" : "Nhận thưởng Top 1 KPI!"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <style>{`
            @keyframes ndaConfettiFall {
              0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
              100% { transform: translateY(105vh) rotate(540deg); opacity: 0.2; }
            }
            @keyframes ndaGlowPulse {
              0%, 100% { box-shadow: 0 0 35px rgba(245,158,11,0.45); }
              50% { box-shadow: 0 0 75px rgba(250,204,21,0.75); }
            }
          `}</style>
          {/* Pháo hoa rực rỡ + Confetti rơi linh đình */}
          <FireworksCanvas />
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            {CONFETTI_PIECES.map((c) => (
              <span
                key={c.id}
                style={{
                  position: "absolute",
                  top: "-20px",
                  left: c.left,
                  width: `${c.size}px`,
                  height: `${Math.round(c.size * 0.6)}px`,
                  backgroundColor: c.color,
                  borderRadius: "2px",
                  animation: `ndaConfettiFall ${c.duration} linear ${c.delay} infinite`,
                }}
              />
            ))}
          </div>

          <div
            className="relative z-10 bg-neutral-950 text-white rounded-3xl max-w-2xl w-full border-2 border-amber-400 overflow-hidden my-6"
            style={{ animation: "ndaGlowPulse 2.4s ease-in-out infinite" }}
          >
            {/* Confetti / Sparkle Header Banner */}
            <div className="relative bg-gradient-to-r from-amber-600 via-yellow-300 to-amber-600 text-neutral-950 px-6 py-5 text-center">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/15 hover:bg-black/25 text-neutral-950 cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600 text-white shadow-sm text-xs font-bold mb-2 animate-pulse">
                <Crown className="w-4 h-4" /> VINH DANH QUÁN QUÂN DOANH SỐ
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 animate-spin" style={{ animationDuration: "5s" }} />
                CHÚC MỪNG {userName ? userName.toUpperCase() : "BẠN"}!
                <Sparkles className="w-6 h-6 animate-spin" style={{ animationDuration: "5s" }} />
              </h2>
              <div className="text-sm sm:text-base font-extrabold text-neutral-950 mt-1">
                TOP 1 KPI PHÒNG SALES
              </div>
              <p className="text-xs sm:text-sm font-semibold mt-1 text-neutral-900">
                Xuất sắc dẫn đầu toàn phòng Sales với doanh số{" "}
                <span className="underline font-extrabold">{formatVND(revenue)}</span>!
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Nếu đã nhận thưởng */}
              {rewardClaimed ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto">
                    <Gift className="w-10 h-10 text-amber-400" />
                  </div>
                  <div className="text-xs uppercase tracking-widest text-amber-400 font-bold">
                    Phần thưởng đặc biệt dành cho Top 1 KPI
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-yellow-300">
                    {rewardClaimed.prize.label}
                  </div>
                  <p className="text-sm text-neutral-300 max-w-md mx-auto">
                    {rewardClaimed.prize.description}
                  </p>
                  <div className="inline-block px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 text-xs font-medium">
                    Đã tự động ghi nhận vào hệ thống &amp; cập nhật bảng lương của bạn!
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => setOpen(false)}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm cursor-pointer"
                    >
                      Tuyệt vời!
                    </button>
                  </div>
                </div>
              ) : mode === "CHOICE" ? (
                <div className="space-y-4">
                  <div className="text-center text-sm text-neutral-300">
                    Hãy chọn <strong>1 trong 2 hình thức</strong> dưới đây để nhận phần thưởng may mắn của riêng bạn:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setMode("WHEEL")}
                      className="group p-5 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 border-2 border-amber-500/60 hover:border-amber-400 text-left space-y-2 transition-all hover:-translate-y-1 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <RotateCw className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                      </div>
                      <div className="text-lg font-bold text-amber-400">1. Vòng Quay May Mắn</div>
                      <p className="text-xs text-neutral-300">
                        Tự tay quay vòng quay 8 ô thưởng: +100K, +200K, +500K, +1 Triệu, Lương x2, Tăng ca +2h...
                      </p>
                    </button>

                    <button
                      onClick={() => setMode("DRAW")}
                      className="group p-5 rounded-2xl bg-gradient-to-br from-rose-950/70 to-neutral-900 border-2 border-rose-500/60 hover:border-amber-400 text-left space-y-2 transition-all hover:-translate-y-1 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-amber-400 flex items-center justify-center">
                        <Gift className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="text-lg font-bold text-amber-400">2. Bốc Thăm Trúng Thưởng</div>
                      <p className="text-xs text-neutral-300">
                        Chọn 1 trong 8 bao lì xì / lá thăm bí mật chứa những phần thưởng giá trị bất ngờ!
                      </p>
                    </button>
                  </div>
                </div>
              ) : mode === "WHEEL" ? (
                <div className="space-y-4 text-center">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => !spinning && setMode("CHOICE")}
                      disabled={spinning}
                      className="text-xs text-neutral-400 hover:text-white cursor-pointer disabled:opacity-40"
                    >
                      ← Chọn lại hình thức
                    </button>
                    <span className="text-xs font-bold text-amber-400 uppercase">Vòng Quay May Mắn Top 1 KPI</span>
                    <span className="w-20" />
                  </div>

                  {/* Wheel + Pointer */}
                  <div className="relative w-72 h-72 sm:w-80 sm:h-80 mx-auto my-2">
                    {/* Pointer */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" />
                    {/* Spinning Disk */}
                    <div
                      className="w-full h-full rounded-full border-4 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.5)] relative overflow-hidden"
                      style={{
                        background: wheelGradient,
                        transform: `rotate(${wheelDeg}deg)`,
                        transition: "transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)",
                      }}
                    >
                      {prizes.map((p, i) => {
                        const angle = i * sliceAngle + sliceAngle / 2;
                        return (
                          <div
                            key={p.id}
                            className="absolute inset-0 flex justify-center pt-5 pointer-events-none"
                            style={{ transform: `rotate(${angle}deg)` }}
                          >
                            <span className="text-[11px] font-extrabold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] whitespace-nowrap">
                              {p.shortLabel}
                            </span>
                          </div>
                        );
                      })}
                      <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-neutral-950 border-2 border-amber-400 flex items-center justify-center shadow-lg">
                        <Crown className="w-5 h-5 text-amber-400" />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSpinWheel}
                    disabled={spinning}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-neutral-950 font-extrabold text-sm shadow-lg cursor-pointer disabled:opacity-60"
                  >
                    {spinning ? "Đang quay may mắn..." : "QUAY NGAY!"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => drawingIdx === null && setMode("CHOICE")}
                      disabled={drawingIdx !== null}
                      className="text-xs text-neutral-400 hover:text-white cursor-pointer disabled:opacity-40"
                    >
                      ← Chọn lại hình thức
                    </button>
                    <span className="text-xs font-bold text-amber-400 uppercase">Bốc Thăm Trúng Thưởng (8 Lá Thăm)</span>
                    <span className="w-20" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {prizes.map((_, idx) => {
                      const isDrawing = drawingIdx === idx;
                      const isOpened = openedIdx === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => handlePickEnvelope(idx)}
                          disabled={drawingIdx !== null}
                          className={`p-4 rounded-2xl border-2 text-center space-y-2 transition-all cursor-pointer ${
                            isDrawing
                              ? "border-yellow-300 bg-amber-500/30 scale-105 animate-pulse"
                              : isOpened
                              ? "border-emerald-400 bg-emerald-900/40"
                              : "border-amber-500/60 bg-gradient-to-b from-rose-900/70 to-neutral-900 hover:border-amber-300 hover:-translate-y-1"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center mx-auto text-amber-300 font-extrabold text-sm">
                            #{idx + 1}
                          </div>
                          <div className="text-xs font-bold text-amber-300">
                            {isDrawing ? "Đang mở..." : `Lá thăm #${idx + 1}`}
                          </div>
                          <div className="text-[10px] text-neutral-300">Bấm để bốc</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-neutral-400 text-center">
                    Gồm các giải: {prizes.map((p) => p.shortLabel).join(" • ")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
