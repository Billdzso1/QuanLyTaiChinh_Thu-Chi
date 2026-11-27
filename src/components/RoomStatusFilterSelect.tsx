"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

const STATUS_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả trạng thái",
    dotClass: "bg-neutral-400",
    textClass: "text-neutral-700",
    activeBg: "bg-neutral-100",
  },
  {
    value: "AVAILABLE",
    label: "Còn trống",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
    activeBg: "bg-emerald-50",
  },
  {
    value: "RESERVED",
    label: "Đã đặt cọc",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
    activeBg: "bg-amber-50",
  },
  {
    value: "RENTED",
    label: "Đã thuê",
    dotClass: "bg-sky-500",
    textClass: "text-sky-700",
    activeBg: "bg-sky-50",
  },
  {
    value: "MAINTENANCE",
    label: "Bảo trì",
    dotClass: "bg-rose-500",
    textClass: "text-rose-700",
    activeBg: "bg-rose-50",
  },
] as const;

export function RoomStatusFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = STATUS_OPTIONS.find((opt) => opt.value === value) || STATUS_OPTIONS[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 border border-neutral-300 rounded-lg px-2.5 py-2 text-xs bg-white hover:bg-neutral-50 transition cursor-pointer"
      >
        <span className={`inline-flex items-center gap-2 font-medium truncate ${current.textClass}`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${current.dotClass}`} />
          <span className="truncate">{current.label}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-full min-w-[170px] rounded-xl border border-neutral-200 bg-white shadow-lg py-1 z-40">
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs transition cursor-pointer ${
                  isSelected ? `${opt.activeBg} font-semibold` : "hover:bg-neutral-50"
                }`}
              >
                <span className={`inline-flex items-center gap-2 ${opt.textClass}`}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotClass}`} />
                  <span>{opt.label}</span>
                </span>
                {isSelected && <Check className={`w-3.5 h-3.5 shrink-0 ${opt.textClass}`} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
