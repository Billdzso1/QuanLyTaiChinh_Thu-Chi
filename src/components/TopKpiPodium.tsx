"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Crown, Trophy, Medal, Sparkles, Flame, FileCheck2, Star, Award } from "lucide-react";
import { formatVND } from "@/lib/finance";

export interface TopKpiMember {
  id: string;
  fullName: string;
  employeeCode: string;
  position: string;
  avatar?: string | null;
  revenue: number;
  contractCount: number;
  kpiTarget: number;
  kpiPercent: number;
}

interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  color: string;
  trail: { x: number; y: number }[];
}

interface FireworkParticle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  size: number;
  gravity: number;
  type: "spark" | "confetti" | "star";
  rotation: number;
  rotationSpeed: number;
}

const FIREWORK_PALETTES = [
  ["#fde047", "#fbbf24", "#f59e0b", "#ffffff"], // Royal Gold
  ["#34d399", "#10b981", "#a7f3d0", "#fde047"], // Emerald & Gold
  ["#fb7185", "#f43f5e", "#fda4af", "#fde047"], // Rose & Gold
  ["#38bdf8", "#818cf8", "#e0f2fe", "#c084fc"], // Sapphire & Violet
];

export function TopKpiPodium({ topKpi }: { topKpi: TopKpiMember[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rocketsRef = useRef<Rocket[]>([]);
  const particlesRef = useRef<FireworkParticle[]>([]);
  const animIdRef = useRef<number | null>(null);
  const [celebrating, setCelebrating] = useState(true);

  const explodeAt = useCallback((cx: number, cy: number, count = 64) => {
    const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
    // Core flash particles
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.22;
      const speed = 1.6 + Math.random() * 5.2;
      const mod = i % 6;
      const type: FireworkParticle["type"] = mod === 0 ? "confetti" : mod === 3 ? "star" : "spark";
      particlesRef.current.push({
        x: cx,
        y: cy,
        px: cx,
        py: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (type === "confetti" ? 1.0 : 0.2),
        alpha: 1,
        decay: type === "confetti" ? 0.007 + Math.random() * 0.005 : 0.011 + Math.random() * 0.01,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: type === "confetti" ? 4.5 + Math.random() * 3.5 : type === "star" ? 2.8 + Math.random() * 1.5 : 1.6 + Math.random() * 1.8,
        gravity: type === "confetti" ? 0.055 : 0.042,
        type,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
      });
    }
  }, []);

  const launchRocket = useCallback((startXRatio?: number, targetYRatio?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const sx = w * (startXRatio ?? 0.15 + Math.random() * 0.7);
    const ty = h * (targetYRatio ?? 0.14 + Math.random() * 0.28);
    const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
    rocketsRef.current.push({
      x: sx,
      y: h + 8,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -(5.8 + Math.random() * 2.4),
      targetY: ty,
      color: palette[0],
      trail: [],
    });
  }, []);

  const launchSalvo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    explodeAt(w * 0.5, h * 0.24, 72);
    launchRocket(0.2, 0.28);
    launchRocket(0.8, 0.26);
    setTimeout(() => launchRocket(0.35, 0.18), 260);
    setTimeout(() => launchRocket(0.65, 0.2), 480);
    setTimeout(() => explodeAt(w * 0.5, h * 0.2, 68), 820);
  }, [explodeAt, launchRocket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let frame = 0;
    if (celebrating && topKpi.length > 0) {
      launchSalvo();
    }

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (celebrating && topKpi.length > 0) {
        frame++;
        if (frame % 135 === 0) {
          launchRocket();
        }
      }

      // Update & draw rising rockets
      const nextRockets: Rocket[] = [];
      for (const r of rocketsRef.current) {
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 10) r.trail.shift();

        r.x += r.vx;
        r.y += r.vy;
        r.vy *= 0.992;

        if (r.y <= r.targetY || r.vy > -1.2) {
          explodeAt(r.x, r.y, 58);
        } else {
          ctx.save();
          for (let i = 0; i < r.trail.length; i++) {
            const pt = r.trail[i];
            const ratio = (i + 1) / r.trail.length;
            ctx.globalAlpha = ratio * 0.7;
            ctx.fillStyle = r.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.5 * ratio, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#ffffff";
          ctx.shadowBlur = 12;
          ctx.shadowColor = r.color;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          nextRockets.push(r);
        }
      }
      rocketsRef.current = nextRockets;

      // Update & draw explosion particles
      const nextParticles: FireworkParticle[] = [];
      for (const p of particlesRef.current) {
        p.px = p.x;
        p.py = p.y;
        p.vx *= 0.982;
        p.vy = p.vy * 0.982 + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        if (p.alpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.strokeStyle = p.color;
          ctx.shadowBlur = p.type === "confetti" ? 4 : 10;
          ctx.shadowColor = p.color;

          if (p.type === "confetti") {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.55);
          } else if (p.type === "star") {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillRect(-p.size, -0.7, p.size * 2, 1.4);
            ctx.fillRect(-0.7, -p.size, 1.4, p.size * 2);
          } else {
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.px, p.py);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
          ctx.restore();
          nextParticles.push(p);
        }
      }
      particlesRef.current = nextParticles;
      animIdRef.current = requestAnimationFrame(tick);
    };

    animIdRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, [celebrating, topKpi.length, launchSalvo, launchRocket, explodeAt]);

  if (!topKpi || topKpi.length === 0) return null;

  const first = topKpi[0];
  const second = topKpi[1];
  const third = topKpi[2];

  const podiumSlots: { member: TopKpiMember; rank: 1 | 2 | 3; orderClass: string }[] = [];
  if (second) podiumSlots.push({ member: second, rank: 2, orderClass: "md:order-1 md:mt-7" });
  if (first) podiumSlots.push({ member: first, rank: 1, orderClass: "md:order-2 md:mt-0" });
  if (third) podiumSlots.push({ member: third, rank: 3, orderClass: "md:order-3 md:mt-12" });

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-400/50 bg-[#09090b] p-6 sm:p-7 text-white shadow-[0_20px_60px_-15px_rgba(245,158,11,0.28)]">
      {/* Inline keyframes for shimmer & floating luxury glow */}
      <style>{`
        @keyframes nda-shimmer {
          0% { transform: translateX(-120%) skewX(-18deg); }
          100% { transform: translateX(220%) skewX(-18deg); }
        }
        @keyframes nda-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes nda-pulse-ring {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }
        .nda-shimmer-bar::after {
          content: "";
          position: absolute;
          inset: 0;
          width: 45%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
          animation: nda-shimmer 2.8s infinite ease-in-out;
        }
        .nda-float-crown {
          animation: nda-float 2.6s infinite ease-in-out;
        }
        .nda-pulse-aura {
          animation: nda-pulse-ring 3s infinite ease-in-out;
        }
      `}</style>

      {/* Volumetric Stage Spotlight Beams & Luxury Background Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(251,191,36,0.35), transparent 55%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 36px 36px, 36px 36px",
        }}
      />
      <div
        className="pointer-events-none absolute -top-10 left-1/2 h-[340px] w-[420px] -translate-x-1/2 opacity-35 blur-2xl"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 0%, transparent 140deg, rgba(251,191,36,0.55) 180deg, transparent 220deg)",
        }}
      />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 h-56 w-3/4 -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />

      {/* Fireworks, Rockets & Confetti Canvas Overlay */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10 h-full w-full" />

      {/* Header */}
      <div className="relative z-20 mb-7 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-4">
          <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 text-neutral-950 shadow-[0_0_25px_rgba(251,191,36,0.55)]">
            <Trophy className="h-7 w-7" />
            <Sparkles className="absolute -top-1.5 -right-1.5 h-4 w-4 text-yellow-200 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-amber-100 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                BẢNG VÀNG TOP 3 KPI TOÀN CÔNG TY
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/25 to-yellow-500/15 border border-amber-400/50 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-200 shadow-inner">
                <Flame className="h-3.5 w-3.5 text-amber-400" /> Vinh danh xuất sắc
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-300/90 mt-1">
              Bảng xếp hạng thời gian thực theo % hoàn thành KPI từ hợp đồng đã thuê chính thức (đã tính chia 50/50 Online – Offline)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <button
            type="button"
            onClick={() => {
              setCelebrating(true);
              launchSalvo();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 via-amber-400 to-amber-500 px-4 py-2.5 text-xs font-extrabold text-neutral-950 shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            <Sparkles className="h-4 w-4" /> Bắn pháo hoa chúc mừng
          </button>
          <button
            type="button"
            onClick={() => setCelebrating((prev) => !prev)}
            className="rounded-xl border border-white/15 bg-white/5 backdrop-blur-md px-3.5 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-white/10 transition cursor-pointer"
          >
            {celebrating ? "Tạm dừng pháo hoa" : "Bật pháo hoa"}
          </button>
        </div>
      </div>

      {/* Olympic 3D Podium Grid */}
      <div className="relative z-20 grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
        {podiumSlots.map(({ member, rank, orderClass }) => {
          const isFirst = rank === 1;
          const isSecond = rank === 2;

          const cardTheme = isFirst
            ? "border-amber-300/80 bg-gradient-to-b from-amber-500/20 via-neutral-900/95 to-black shadow-[0_0_45px_rgba(251,191,36,0.22)] ring-1 ring-amber-300/40"
            : isSecond
              ? "border-slate-300/50 bg-gradient-to-b from-slate-300/15 via-neutral-900/90 to-black shadow-[0_10px_30px_rgba(148,163,184,0.12)]"
              : "border-orange-400/50 bg-gradient-to-b from-orange-500/15 via-neutral-900/90 to-black shadow-[0_10px_30px_rgba(249,115,22,0.12)]";

          const badgeTheme = isFirst
            ? "bg-gradient-to-r from-yellow-200 via-amber-400 to-amber-500 text-neutral-950 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
            : isSecond
              ? "bg-gradient-to-r from-slate-100 via-slate-300 to-slate-400 text-neutral-950"
              : "bg-gradient-to-r from-orange-200 via-orange-400 to-amber-600 text-neutral-950";

          const avatarRing = isFirst
            ? "ring-4 ring-amber-300 bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 text-neutral-950 shadow-[0_0_25px_rgba(251,191,36,0.5)]"
            : isSecond
              ? "ring-2 ring-slate-300 bg-gradient-to-br from-slate-100 to-slate-500 text-neutral-950"
              : "ring-2 ring-orange-400 bg-gradient-to-br from-orange-200 to-amber-700 text-neutral-950";

          const barFill = isFirst
            ? "bg-gradient-to-r from-amber-300 via-yellow-400 to-emerald-400"
            : isSecond
              ? "bg-gradient-to-r from-slate-200 via-sky-300 to-sky-500"
              : "bg-gradient-to-r from-orange-300 via-amber-400 to-amber-500";

          const pedestalTheme = isFirst
            ? "h-10 bg-gradient-to-b from-amber-400/35 via-amber-600/20 to-transparent border-t-2 border-amber-300/70 text-amber-200"
            : isSecond
              ? "h-7 bg-gradient-to-b from-slate-300/25 via-slate-500/15 to-transparent border-t-2 border-slate-300/50 text-slate-300"
              : "h-5 bg-gradient-to-b from-orange-400/25 via-orange-700/15 to-transparent border-t-2 border-orange-400/50 text-orange-300";

          const initials = member.fullName
            .split(" ")
            .filter(Boolean)
            .slice(-2)
            .map((w) => w[0]?.toUpperCase())
            .join("");

          return (
            <div key={member.id} className={`flex flex-col ${orderClass}`}>
              <div
                className={`group relative overflow-hidden rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 ${cardTheme}`}
              >
                {/* Giant subtle watermark rank number */}
                <div
                  className={`pointer-events-none absolute -right-2 -top-4 select-none font-black text-7xl tracking-tighter opacity-[0.07] ${
                    isFirst ? "text-amber-300" : isSecond ? "text-slate-200" : "text-orange-300"
                  }`}
                >
                  0{rank}
                </div>

                {/* Top Badge Row */}
                <div className="relative z-10 flex items-center justify-between gap-2 mb-5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${badgeTheme}`}
                  >
                    {isFirst ? (
                      <>
                        <Crown className="h-3.5 w-3.5" /> TOP 1 · QUÁN QUÂN
                      </>
                    ) : isSecond ? (
                      <>
                        <Medal className="h-3.5 w-3.5" /> TOP 2 · Á QUÂN
                      </>
                    ) : (
                      <>
                        <Award className="h-3.5 w-3.5" /> TOP 3 · XUẤT SẮC
                      </>
                    )}
                  </span>
                  <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] font-mono text-neutral-300">
                    {member.employeeCode}
                  </span>
                </div>

                {/* Champion / Medalist Profile */}
                <div className="relative z-10 flex flex-col items-center text-center mb-5">
                  <div className="relative mb-3">
                    {isFirst && (
                      <>
                        <div className="nda-pulse-aura pointer-events-none absolute -inset-2 rounded-full bg-amber-400/30 blur-md" />
                        <div className="nda-float-crown absolute -top-5 left-1/2 -translate-x-1/2 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]">
                          <Crown className="h-7 w-7 text-yellow-300 fill-amber-400" />
                        </div>
                        <Star className="absolute -left-4 top-0 h-3.5 w-3.5 text-yellow-200 fill-yellow-200 animate-pulse" />
                        <Star className="absolute -right-4 top-2 h-3 w-3 text-amber-300 fill-amber-300 animate-pulse" />
                      </>
                    )}
                    <div
                      className={`relative flex ${
                        isFirst ? "h-20 w-20 text-xl" : "h-16 w-16 text-lg"
                      } items-center justify-center rounded-full font-black ${avatarRing}`}
                    >
                      {member.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.avatar}
                          alt={member.fullName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                  </div>

                  <div className="text-lg font-extrabold text-white tracking-tight">{member.fullName}</div>
                  <div className="text-xs text-neutral-300 mt-0.5">{member.position}</div>
                </div>

                {/* KPI Percentage & Animated Shimmer Bar */}
                <div className="relative z-10 mb-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-medium text-neutral-300">Hoàn thành KPI</span>
                    <span
                      className={`text-2xl font-black tracking-tight ${
                        isFirst ? "text-amber-300" : isSecond ? "text-slate-100" : "text-orange-300"
                      }`}
                    >
                      {member.kpiPercent}%
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
                    <div
                      className={`nda-shimmer-bar relative h-full overflow-hidden rounded-full transition-all duration-700 ${barFill}`}
                      style={{ width: `${Math.min(100, Math.max(6, member.kpiPercent))}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="relative z-10 grid grid-cols-2 gap-2.5 rounded-xl bg-white/[0.04] border border-white/10 p-3 text-xs">
                  <div>
                    <div className="text-[11px] text-neutral-400">Doanh số đạt</div>
                    <div className="mt-0.5 font-extrabold text-emerald-300 truncate">{formatVND(member.revenue)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-neutral-400">Hợp đồng thuê</div>
                    <div className="mt-0.5 inline-flex items-center justify-end gap-1 font-extrabold text-white">
                      <FileCheck2 className="h-3.5 w-3.5 text-amber-400" />
                      {member.contractCount} HĐ
                    </div>
                  </div>
                </div>
              </div>

              {/* Metallic 3D Podium Plinth (desktop) */}
              <div
                className={`hidden md:flex items-center justify-center rounded-b-2xl mx-3 text-[11px] font-black tracking-[0.22em] uppercase ${pedestalTheme}`}
              >
                Hạng {rank}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
