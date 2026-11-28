"use client";

import React, { useEffect, useState } from "react";
import { Upload, FileText, X, CreditCard, Banknote, Layers, QrCode, Settings2 } from "lucide-react";
import { formatVND } from "@/lib/finance";

export type PaymentMethodType = "TRANSFER" | "CASH" | "MIXED";

export interface PaymentVerificationValue {
  customerIdCard: string;
  paymentMethod: PaymentMethodType;
  transferAmount: string;
  cashAmount: string;
  evidenceUrl: string;
}

const BANK_OPTIONS = [
  { code: "MB", name: "MB Bank" },
  { code: "VCB", name: "Vietcombank" },
  { code: "TCB", name: "Techcombank" },
  { code: "ACB", name: "ACB" },
  { code: "VPB", name: "VPBank" },
  { code: "TPB", name: "TPBank" },
  { code: "BIDV", name: "BIDV" },
  { code: "ICB", name: "VietinBank" },
];

const DEFAULT_BANK = {
  bankCode: "MB",
  accountNo: "0984843052",
  accountName: "CONG TY TNHH NDAHOME",
};

export function PaymentVerificationFields({
  value,
  onChange,
  totalAmount,
  qrDescription,
}: {
  value: PaymentVerificationValue;
  onChange: (next: PaymentVerificationValue) => void;
  totalAmount?: number;
  qrDescription?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [bankInfo, setBankInfo] = useState(DEFAULT_BANK);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ndahome_vietqr_bank");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.bankCode && parsed.accountNo) setBankInfo(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  function updateBankInfo(next: typeof DEFAULT_BANK) {
    setBankInfo(next);
    try {
      localStorage.setItem("ndahome_vietqr_bank", JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        onChange({ ...value, evidenceUrl: data.url });
      }
    } finally {
      setUploading(false);
    }
  }

  const methods: { id: PaymentMethodType; label: string; icon: React.ReactNode }[] = [
    { id: "TRANSFER", label: "Chuyển khoản", icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: "CASH", label: "Tiền mặt", icon: <Banknote className="w-3.5 h-3.5" /> },
    { id: "MIXED", label: "Cả CK & Tiền mặt", icon: <Layers className="w-3.5 h-3.5" /> },
  ];

  const showVietQr = value.paymentMethod === "TRANSFER" || value.paymentMethod === "MIXED";
  const qrAmount =
    value.paymentMethod === "MIXED"
      ? Math.max(0, Number(value.transferAmount || 0))
      : Math.max(0, Number(totalAmount || 0));
  const addInfo = (qrDescription || "NDAHOME THANH TOAN HOP DONG").slice(0, 50);
  const vietQrUrl = `https://img.vietqr.io/image/${bankInfo.bankCode}-${bankInfo.accountNo}-compact2.png?amount=${qrAmount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(bankInfo.accountName)}`;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-neutral-900 mb-1">
          Số CCCD / CMND khách hàng *
        </label>
        <input
          type="text"
          required
          value={value.customerIdCard}
          onChange={(e) => onChange({ ...value, customerIdCard: e.target.value })}
          placeholder="Nhập số CCCD 12 số của khách..."
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-neutral-900 mb-1.5">
          Hình thức thanh toán *
        </label>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => {
            const active = value.paymentMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (m.id === "MIXED" && !value.transferAmount && !value.cashAmount && totalAmount) {
                    const half = Math.round(totalAmount / 2);
                    onChange({
                      ...value,
                      paymentMethod: m.id,
                      transferAmount: String(half),
                      cashAmount: String(Math.max(0, totalAmount - half)),
                    });
                  } else {
                    onChange({ ...value, paymentMethod: m.id });
                  }
                }}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm border-amber-500 shadow-sm"
                    : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                {m.icon}
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        {value.paymentMethod === "MIXED" && (
          <div className="grid grid-cols-2 gap-2.5 mt-2 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Chuyển khoản (VNĐ)
              </label>
              <input
                type="number"
                min={0}
                required
                value={value.transferAmount}
                onChange={(e) => {
                  const ck = Number(e.target.value || 0);
                  const remain = totalAmount && totalAmount >= ck ? String(totalAmount - ck) : value.cashAmount;
                  onChange({ ...value, transferAmount: e.target.value, cashAmount: remain });
                }}
                className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-semibold text-sky-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Tiền mặt (VNĐ)
              </label>
              <input
                type="number"
                min={0}
                required
                value={value.cashAmount}
                onChange={(e) => onChange({ ...value, cashAmount: e.target.value })}
                className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-semibold text-emerald-700"
              />
            </div>
          </div>
        )}

        {/* VietQR Code Box when Transfer / Mixed is selected */}
        {showVietQr && (
          <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-br from-sky-50 via-white to-amber-50 border border-sky-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                <QrCode className="w-4 h-4 text-sky-600" />
                Mã VietQR Chuyển Khoản Nhanh
              </div>
              <button
                type="button"
                onClick={() => setEditingBank((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
              >
                <Settings2 className="w-3 h-3" /> {editingBank ? "Đóng chỉnh STK" : "Đổi STK nhận"}
              </button>
            </div>

            {editingBank && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-white border border-sky-200 text-[11px]">
                <select
                  value={bankInfo.bankCode}
                  onChange={(e) => updateBankInfo({ ...bankInfo, bankCode: e.target.value })}
                  className="border border-neutral-300 rounded px-2 py-1.5 bg-white"
                >
                  {BANK_OPTIONS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <input
                  value={bankInfo.accountNo}
                  onChange={(e) => updateBankInfo({ ...bankInfo, accountNo: e.target.value })}
                  placeholder="Số tài khoản"
                  className="border border-neutral-300 rounded px-2 py-1.5"
                />
                <input
                  value={bankInfo.accountName}
                  onChange={(e) => updateBankInfo({ ...bankInfo, accountName: e.target.value })}
                  placeholder="Tên chủ TK"
                  className="border border-neutral-300 rounded px-2 py-1.5"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-36 h-36 bg-white rounded-xl border border-neutral-200 p-1.5 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vietQrUrl}
                  alt="VietQR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-[11px] text-neutral-700 space-y-1 flex-1">
                <div>
                  Ngân hàng:{" "}
                  <strong className="text-neutral-900">
                    {BANK_OPTIONS.find((b) => b.code === bankInfo.bankCode)?.name || bankInfo.bankCode}
                  </strong>
                </div>
                <div>
                  Số tài khoản: <strong className="font-mono text-neutral-950">{bankInfo.accountNo}</strong>
                </div>
                <div>
                  Chủ tài khoản: <strong className="text-neutral-900">{bankInfo.accountName}</strong>
                </div>
                <div>
                  Số tiền quét: <strong className="text-emerald-700 text-xs">{formatVND(qrAmount)}</strong>
                </div>
                <div className="text-neutral-500">
                  Nội dung: <strong className="text-neutral-800">{addInfo}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-neutral-900 mb-1">
          Minh chứng thanh toán / Hợp đồng (Ảnh hoặc PDF)
        </label>
        {value.evidenceUrl ? (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
            <a
              href={value.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:underline truncate"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">Đã tải minh chứng lên ({value.evidenceUrl.split("/").pop()})</span>
            </a>
            <button
              type="button"
              onClick={() => onChange({ ...value, evidenceUrl: "" })}
              className="p-1 rounded hover:bg-emerald-100 text-emerald-700 cursor-pointer"
              title="Xóa file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-neutral-300 hover:border-amber-500 hover:bg-amber-50/40 text-xs font-medium text-neutral-700 cursor-pointer transition">
            <Upload className="w-4 h-4 text-amber-600" />
            <span>{uploading ? "Đang tải minh chứng..." : "Chọn ảnh chuyển khoản / biên nhận / file PDF"}</span>
            <input
              type="file"
              accept="image/*,.pdf"
              disabled={uploading}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
}
