"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { buildUtilityBillHtml, printUtilityBillPdf, UtilityBillPrintData } from "@/lib/utilityBillPrint";
import { formatVND } from "@/lib/finance";
import { exportToExcel } from "@/lib/export";
import { Zap, Droplets, Download, CheckCircle2, Clock, Sparkles, Home, Receipt, Calculator, Printer, X, Settings2, AlertTriangle } from "lucide-react";

interface RoomOption {
  id: string;
  propertyId: string;
  propertyName: string;
  district: string;
  roomNumber: string;
  price: number;
  status: string;
}

interface UtilityBill {
  id: string;
  roomId: string;
  roomLabel: string;
  monthKey: string;
  roomRent: number;
  oldElectric: number;
  newElectric: number;
  electricRate: number;
  oldWater: number;
  newWater: number;
  waterRate: number;
  serviceFee: number;
  totalAmount: number;
  isPaid: boolean;
  note?: string;
}

export default function LandlordUtilitiesPage() {
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [utilities, setUtilities] = useState<UtilityBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [selectedPropertyId, setSelectedPropertyId] = useState("ALL");
  const [dueDay, setDueDay] = useState(5);
  const [propertyRates, setPropertyRates] = useState<
    { propertyId: string; electricRate: number; waterRate: number; serviceFee: number }[]
  >([]);
  const [showBankConfig, setShowBankConfig] = useState(false);
  const [bankInfo, setBankInfo] = useState({ bankCode: "MB", accountNo: "0984843052", accountName: "CHU TRO NDAHOME" });
  const [previewBill, setPreviewBill] = useState<UtilityBillPrintData | null>(null);
  const [todayDay, setTodayDay] = useState(0);
  const [currentMonthKey, setCurrentMonthKey] = useState("");

  const [form, setForm] = useState({
    roomId: "",
    monthKey: "2026-11",
    oldElectric: "0",
    newElectric: "0",
    electricRate: "3800",
    oldWater: "0",
    newWater: "0",
    waterRate: "20000",
    serviceFee: "150000",
    note: "",
  });

  async function loadData() {
    setLoading(true);
    const [landlordRes, extRes] = await Promise.all([
      fetch("/api/landlord"),
      fetch("/api/landlord/extras"),
    ]);
    if (landlordRes.ok) {
      const ld = await landlordRes.json();
      setRooms(ld.rooms || []);
    }
    if (extRes.ok) {
      const ext = await extRes.json();
      setUtilities(ext.utilities || []);
      setPropertyRates(ext.propertyRates || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    const now = new Date();
    setTodayDay(now.getDate());
    setCurrentMonthKey(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    loadData();
    try {
      const savedBank = localStorage.getItem("ndahome_landlord_vietqr_bank");
      if (savedBank) setBankInfo(JSON.parse(savedBank));
      const savedDue = localStorage.getItem("ndahome_landlord_due_day");
      if (savedDue) setDueDay(Number(savedDue) || 5);
    } catch {
      // ignore
    }
  }, []);

  async function handleSaveUtility(e: React.FormEvent) {
    e.preventDefault();
    const room = rooms.find((r) => r.id === form.roomId);
    if (!room) return;
    const res = await fetch("/api/landlord/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "UTILITY",
        ...form,
        roomLabel: `${room.propertyName} — ${room.roomNumber}`,
        roomRent: room.price,
      }),
    });
    if (res.ok) {
      loadData();
    }
  }

  const visibleBills = utilities.filter((u) => filterMonth === "ALL" || u.monthKey === filterMonth);
  const totalAmount = visibleBills.reduce((s, u) => s + u.totalAmount, 0);
  const paidAmount = visibleBills.filter((u) => u.isPaid).reduce((s, u) => s + u.totalAmount, 0);
  const unpaidAmount = Math.max(0, totalAmount - paidAmount);
  const collectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  function handleExportExcel() {
    exportToExcel(
      visibleBills.map((u) => ({
        Thang: u.monthKey,
        Phong: u.roomLabel,
        TienPhong: u.roomRent,
        SoDien: Math.max(0, u.newElectric - u.oldElectric),
        TienDien: Math.max(0, u.newElectric - u.oldElectric) * u.electricRate,
        SoNuoc: Math.max(0, u.newWater - u.oldWater),
        TienNuoc: Math.max(0, u.newWater - u.oldWater) * u.waterRate,
        PhiDichVu: u.serviceFee,
        TongCong: u.totalAmount,
        TrangThai: u.isPaid ? "Đã thu" : "Chưa thu",
      })),
      "NDAHOME_DienNuoc_TienPhong",
      "DienNuoc"
    );
  }

  const districts = Array.from(new Set(rooms.map((r) => r.district).filter(Boolean))).sort();
  const propertiesInDistrict = Array.from(
    new Map(
      rooms
        .filter((r) => selectedDistrict === "ALL" || r.district === selectedDistrict)
        .map((r) => [r.propertyId, { id: r.propertyId, name: r.propertyName, district: r.district }])
    ).values()
  );
  const selectableRooms = rooms.filter((r) => {
    if (selectedDistrict !== "ALL" && r.district !== selectedDistrict) return false;
    if (selectedPropertyId !== "ALL" && r.propertyId !== selectedPropertyId) return false;
    return true;
  });

  const selectedRoom = rooms.find((r) => r.id === form.roomId);
  const elecDiff = Math.max(0, Number(form.newElectric || 0) - Number(form.oldElectric || 0));
  const waterDiff = Math.max(0, Number(form.newWater || 0) - Number(form.oldWater || 0));
  const isBillOverdue = (u: UtilityBill) => {
    if (u.isPaid || !currentMonthKey) return false;
    if (u.monthKey < currentMonthKey) return true;
    if (u.monthKey === currentMonthKey && todayDay > dueDay) return true;
    return false;
  };
  const overdueBills = visibleBills.filter(isBillOverdue);
  const previewElec = elecDiff * Number(form.electricRate || 0);
  const previewWater = waterDiff * Number(form.waterRate || 0);
  const previewService = Number(form.serviceFee || 0);
  const previewTotal = (selectedRoom?.price || 0) + previewElec + previewWater + previewService;

  return (
    <AppShell>
      <div className="space-y-6 pb-8">
        {/* Modern Indigo-Cyan Hero Header */}
        <div className="relative overflow-hidden rounded-[28px] border border-indigo-400/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-950 p-6 sm:p-8 text-white shadow-[0_24px_60px_-15px_rgba(30,41,59,0.45)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 20%, rgba(56,189,248,0.38), transparent 45%), radial-gradient(circle at 15% 85%, rgba(99,102,241,0.35), transparent 45%), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "100% 100%, 100% 100%, 36px 36px, 36px 36px",
            }}
          />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/15 border border-cyan-400/35 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-200">
                <Sparkles className="w-3.5 h-3.5" /> Sổ Điện – Nước &amp; Hóa Đơn Tháng
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-sky-100 to-cyan-300 bg-clip-text text-transparent">
                Điện – Nước &amp; Tiền phòng hàng tháng
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/95 max-w-2xl">
                Chọn Quận → Khu nhà → Phòng để chốt chỉ số điện, nước, phí dịch vụ và theo dõi tiến độ thu tiền hàng tháng.
              </p>
              <div className="pt-1 flex items-center gap-3 text-xs">
                <span className="rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-emerald-300 font-bold">
                  Tiến độ thu: {collectionRate}%
                </span>
                <div className="w-36 h-2 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 transition-all duration-700"
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setShowBankConfig((prev) => !prev)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer"
              >
                <Settings2 className="w-4 h-4 text-cyan-300" /> Cài đặt STK VietQR
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer"
              >
                <Download className="w-4 h-4" /> Xuất Excel Điện – Nước
              </button>
            </div>
          </div>
        </div>

        {showBankConfig && (
          <div className="bg-white rounded-2xl border border-amber-300 p-4 shadow-sm flex flex-wrap items-end gap-3 text-xs">
            <div>
              <label className="block font-bold mb-1">Ngân hàng (VD: MB, VCB, TCB, ACB)</label>
              <input
                value={bankInfo.bankCode}
                onChange={(e) => {
                  const next = { ...bankInfo, bankCode: e.target.value.toUpperCase() };
                  setBankInfo(next);
                  localStorage.setItem("ndahome_landlord_vietqr_bank", JSON.stringify(next));
                }}
                className="border border-neutral-300 rounded-lg px-3 py-1.5 w-32 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Số tài khoản nhận tiền phòng</label>
              <input
                value={bankInfo.accountNo}
                onChange={(e) => {
                  const next = { ...bankInfo, accountNo: e.target.value };
                  setBankInfo(next);
                  localStorage.setItem("ndahome_landlord_vietqr_bank", JSON.stringify(next));
                }}
                className="border border-neutral-300 rounded-lg px-3 py-1.5 w-44 font-mono"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block font-bold mb-1">Tên chủ tài khoản</label>
              <input
                value={bankInfo.accountName}
                onChange={(e) => {
                  const next = { ...bankInfo, accountName: e.target.value };
                  setBankInfo(next);
                  localStorage.setItem("ndahome_landlord_vietqr_bank", JSON.stringify(next));
                }}
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowBankConfig(false)}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white shadow-sm font-bold cursor-pointer"
            >
              Xong
            </button>
          </div>
        )}

        {overdueBills.length > 0 && (
          <div className="rounded-2xl bg-rose-50 border border-rose-300 p-4 flex items-center gap-3 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Cảnh báo nhắc thu: Có <strong>{overdueBills.length} phiếu thu</strong> đã quá ngày hạn thu (mùng{" "}
              <strong>{dueDay}</strong> hàng tháng) chưa thanh toán!
            </span>
          </div>
        )}

        {/* 3 Elevated Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-white to-amber-50/70 border border-amber-200/80 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tổng cần thu ({visibleBills.length} phiếu)</span>
              <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl font-black text-neutral-900 mt-2 tabular-nums">{formatVND(totalAmount)}</div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-white to-emerald-50/70 border border-emerald-200/80 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Đã thu thành công</span>
              <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2 tabular-nums">{formatVND(paidAmount)}</div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-white to-orange-50/70 border border-orange-200/80 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Còn lại chưa thu</span>
              <span className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </span>
            </div>
            <div className="text-2xl font-black text-orange-600 mt-2 tabular-nums">{formatVND(unpaidAmount)}</div>
          </div>
        </div>

        {/* Split Interactive Console: Left Calculator + Right Live Receipt Preview */}
        <form onSubmit={handleSaveUtility} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-3xl border border-neutral-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="font-extrabold text-base text-neutral-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Calculator className="w-4 h-4" />
                </span>
                Nhập chỉ số Điện – Nước &amp; Phí tháng
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">1. Chọn Quận</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setSelectedPropertyId("ALL");
                    setForm({ ...form, roomId: "" });
                  }}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="ALL">Tất cả Quận ({districts.length})</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">2. Chọn Khu nhà / Địa điểm</label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => {
                    setSelectedPropertyId(e.target.value);
                    setForm({ ...form, roomId: "" });
                  }}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="ALL">
                    {selectedDistrict === "ALL"
                      ? `Tất cả khu nhà (${propertiesInDistrict.length})`
                      : `Tất cả khu tại ${selectedDistrict} (${propertiesInDistrict.length})`}
                  </option>
                  {propertiesInDistrict.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.district})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-neutral-800 mb-1.5">3. Chọn Phòng ({selectableRooms.length} phòng) *</label>
                <select
                  required
                  value={form.roomId}
                  onChange={(e) => {
                    const rid = e.target.value;
                    const r = rooms.find((item) => item.id === rid);
                    const rate = r ? propertyRates.find((pr) => pr.propertyId === r.propertyId) : undefined;
                    setForm({
                      ...form,
                      roomId: rid,
                      ...(rate
                        ? {
                            electricRate: String(rate.electricRate),
                            waterRate: String(rate.waterRate),
                            serviceFee: String(rate.serviceFee),
                          }
                        : {}),
                    });
                  }}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">-- Chọn phòng cần tính --</option>
                  {selectableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.propertyName} — {r.roomNumber} ({r.district} • {formatVND(r.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">Tháng chốt *</label>
                <input
                  type="month"
                  required
                  value={form.monthKey}
                  onChange={(e) => setForm({ ...form, monthKey: e.target.value })}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-800 mb-1.5">Phí DV / Rác / Wifi (VNĐ)</label>
                <input
                  type="number"
                  min={0}
                  value={form.serviceFee}
                  onChange={(e) => setForm({ ...form, serviceFee: e.target.value })}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 font-semibold"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" /> Chỉ số Điện (kWh)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-neutral-500">Số cũ</span>
                    <input
                      type="number"
                      min={0}
                      value={form.oldElectric}
                      onChange={(e) => setForm({ ...form, oldElectric: e.target.value })}
                      className="w-full mt-0.5 border border-amber-200 rounded-xl px-2.5 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-500">Số mới</span>
                    <input
                      type="number"
                      min={0}
                      value={form.newElectric}
                      onChange={(e) => setForm({ ...form, newElectric: e.target.value })}
                      className="w-full mt-0.5 border border-amber-300 rounded-xl px-2.5 py-2 bg-white font-bold text-amber-700"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500">Đơn giá (đ/kWh)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.electricRate}
                    onChange={(e) => setForm({ ...form, electricRate: e.target.value })}
                    className="w-full mt-0.5 border border-amber-200 rounded-xl px-2.5 py-1.5 bg-white font-semibold"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-2">
                <div className="font-bold text-sky-900 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-600" /> Chỉ số Nước (m³)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-neutral-500">Số cũ</span>
                    <input
                      type="number"
                      min={0}
                      value={form.oldWater}
                      onChange={(e) => setForm({ ...form, oldWater: e.target.value })}
                      className="w-full mt-0.5 border border-sky-200 rounded-xl px-2.5 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-500">Số mới</span>
                    <input
                      type="number"
                      min={0}
                      value={form.newWater}
                      onChange={(e) => setForm({ ...form, newWater: e.target.value })}
                      className="w-full mt-0.5 border border-sky-300 rounded-xl px-2.5 py-2 bg-white font-bold text-sky-700"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500">Đơn giá (đ/m³)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.waterRate}
                    onChange={(e) => setForm({ ...form, waterRate: e.target.value })}
                    className="w-full mt-0.5 border border-sky-200 rounded-xl px-2.5 py-1.5 bg-white font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Live Indigo-Slate Receipt Card */}
          <div className="rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-xl flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Phiếu tạm tính</div>
                  <div className="text-base font-extrabold mt-0.5">
                    {selectedRoom ? `${selectedRoom.propertyName} — ${selectedRoom.roomNumber}` : "Chưa chọn phòng"}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-white/10 font-mono text-xs text-cyan-200">{form.monthKey}</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-cyan-300" /> Tiền thuê phòng
                  </span>
                  <span className="font-bold text-white tabular-nums">{formatVND(selectedRoom?.price || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" /> Điện ({elecDiff} kWh)
                  </span>
                  <span className="font-bold text-yellow-300 tabular-nums">{formatVND(previewElec)}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-sky-400" /> Nước ({waterDiff} m³)
                  </span>
                  <span className="font-bold text-sky-300 tabular-nums">{formatVND(previewWater)}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-300">
                  <span>Phí DV / Rác / Wifi</span>
                  <span className="font-bold text-white tabular-nums">{formatVND(previewService)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-white/15 pt-4">
              <div className="flex items-end justify-between">
                <span className="text-xs text-neutral-400">Tổng thanh toán</span>
                <span className="text-2xl font-black text-emerald-400 tabular-nums">{formatVND(previewTotal)}</span>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-200 via-amber-400 to-amber-500 text-neutral-950 text-xs font-black shadow-[0_0_25px_rgba(251,191,36,0.35)] hover:brightness-110 transition cursor-pointer"
              >
                Lưu phiếu tính tiền tháng
              </button>
            </div>
          </div>
        </form>

        {/* Bills Table */}
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-x-auto shadow-sm">
          <div className="p-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-neutral-900">Danh sách phiếu thu Điện – Nước</div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5 text-neutral-600">
                Hạn thu ngày:
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dueDay}
                  onChange={(e) => {
                    const v = Math.min(28, Math.max(1, Number(e.target.value) || 5));
                    setDueDay(v);
                    localStorage.setItem("ndahome_landlord_due_day", String(v));
                  }}
                  className="w-14 border border-neutral-300 rounded-lg px-2 py-1 text-center font-bold"
                />
              </label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="border border-neutral-300 rounded-xl px-3 py-1.5 text-xs bg-white font-medium"
              >
                <option value="ALL">Tất cả các tháng</option>
                {Array.from(new Set(utilities.map((u) => u.monthKey))).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-200">
              <tr>
                <th className="px-5 py-3.5 text-left font-bold">Tháng</th>
                <th className="px-5 py-3.5 text-left font-bold">Phòng</th>
                <th className="px-5 py-3.5 text-right font-bold">Tiền phòng</th>
                <th className="px-5 py-3.5 text-right font-bold">Điện (số)</th>
                <th className="px-5 py-3.5 text-right font-bold">Nước (m³)</th>
                <th className="px-5 py-3.5 text-right font-bold">Phí DV</th>
                <th className="px-5 py-3.5 text-right font-bold">Tổng cộng</th>
                <th className="px-5 py-3.5 text-center font-bold">Trạng thái</th>
                <th className="px-5 py-3.5 text-right font-bold">Phiếu báo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-neutral-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : visibleBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-neutral-500">
                    Chưa có phiếu điện nước nào. Hãy chọn Quận → Khu nhà → Phòng ở trên để chốt chỉ số tháng.
                  </td>
                </tr>
              ) : (
                visibleBills.map((u) => {
                  const overdue = isBillOverdue(u);
                  return (
                  <tr key={u.id} className={`transition-colors ${overdue ? "bg-rose-50/40 hover:bg-rose-50/70" : "hover:bg-amber-50/40"}`}>
                    <td className="px-5 py-3.5 font-mono font-extrabold text-amber-700">{u.monthKey}</td>
                    <td className="px-5 py-3.5 font-bold text-neutral-900">{u.roomLabel}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{formatVND(u.roomRent)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {Math.max(0, u.newElectric - u.oldElectric)} kWh (
                      {formatVND(Math.max(0, u.newElectric - u.oldElectric) * u.electricRate)})
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {Math.max(0, u.newWater - u.oldWater)} m³ (
                      {formatVND(Math.max(0, u.newWater - u.oldWater) * u.waterRate)})
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{formatVND(u.serviceFee)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-extrabold text-emerald-700">
                      {formatVND(u.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch("/api/landlord/extras", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ type: "TOGGLE_UTILITY_PAID", id: u.id }),
                          });
                          loadData();
                        }}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                          u.isPaid
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : overdue
                              ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                        }`}
                      >
                        {u.isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {u.isPaid ? "Đã thu" : overdue ? "Quá hạn thu" : "Chưa thu"}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewBill({
                            ...u,
                            bankCode: bankInfo.bankCode,
                            accountNo: bankInfo.accountNo,
                            accountName: bankInfo.accountName,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm shadow-indigo-500/20 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3 h-3" /> Phiếu PDF
                      </button>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Xem trước & In Phiếu báo tiền phòng PDF kèm VietQR */}
        {previewBill && (
          <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
                <div className="font-bold text-sm text-neutral-900">
                  Phiếu báo tiền phòng {previewBill.monthKey} — {previewBill.roomLabel}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printUtilityBillPdf(previewBill)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> In / Lưu PDF gửi Zalo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewBill(null)}
                    className="p-1.5 hover:bg-neutral-200 rounded-xl cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto bg-neutral-100">
                <iframe
                  title="Phiếu báo tiền phòng PDF"
                  srcDoc={buildUtilityBillHtml(previewBill)}
                  className="w-full h-[64vh] bg-white rounded-xl shadow border border-neutral-300"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
