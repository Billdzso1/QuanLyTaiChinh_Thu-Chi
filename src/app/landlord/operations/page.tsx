"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND, formatDate } from "@/lib/finance";
import {
  Users,
  Settings,
  Wallet,
  Send,
  Sparkles,
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  Car,
  CreditCard,
  Trash2,
  Building2,
} from "lucide-react";

interface RoomOpt {
  id: string;
  propertyId: string;
  propertyName: string;
  district: string;
  roomNumber: string;
  status: string;
}

interface PropertyOpt {
  id: string;
  name: string;
  district: string;
}

interface ActiveTenantRow {
  contractId: string;
  contractCode: string;
  roomLabel: string;
  district: string;
  customerName: string;
  customerPhone: string;
  customerIdCard?: string | null;
  startDate?: string;
  endDate?: string;
  signedDate: string;
}

interface ResidentItem {
  id: string;
  roomId: string;
  roomLabel: string;
  fullName: string;
  phone: string;
  idCard?: string;
  vehiclePlate?: string;
  keyCardCode?: string;
  tempResidenceDone: boolean;
  createdAt: string;
}

interface PropertyRateItem {
  propertyId: string;
  propertyName: string;
  electricRate: number;
  waterRate: number;
  serviceFee: number;
  parkingFee: number;
}

interface OperatingExpenseItem {
  id: string;
  propertyId: string;
  propertyName: string;
  monthKey: string;
  title: string;
  amount: number;
  createdAt: string;
}

export default function LandlordOperationsPage() {
  const [tab, setTab] = useState<"RESIDENTS" | "RATES" | "EXPENSES" | "SUPPORT">("RESIDENTS");
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [properties, setProperties] = useState<PropertyOpt[]>([]);
  const [tenants, setTenants] = useState<ActiveTenantRow[]>([]);
  const [residents, setResidents] = useState<ResidentItem[]>([]);
  const [rates, setRates] = useState<PropertyRateItem[]>([]);
  const [expenses, setExpenses] = useState<OperatingExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [resForm, setResForm] = useState({
    roomId: "",
    fullName: "",
    phone: "",
    idCard: "",
    vehiclePlate: "",
    keyCardCode: "",
    tempResidenceDone: false,
  });

  const [rateForm, setRateForm] = useState({
    propertyId: "",
    electricRate: "3800",
    waterRate: "20000",
    serviceFee: "150000",
    parkingFee: "100000",
  });

  const [expForm, setExpForm] = useState({
    propertyId: "",
    monthKey: "2026-11",
    title: "",
    amount: "",
  });

  const [supportForm, setSupportForm] = useState({
    category: "BOOST_EMPTY_ROOM",
    message: "",
  });
  const [supportSentMsg, setSupportSentMsg] = useState("");

  async function loadAll() {
    setLoading(true);
    const [ldRes, extRes] = await Promise.all([fetch("/api/landlord"), fetch("/api/landlord/extras")]);
    if (ldRes.ok) {
      const ld = await ldRes.json();
      setRooms(ld.rooms || []);
      setProperties(ld.properties || []);
      const activeContracts = (ld.contracts || []).filter((c: { status: string }) => c.status === "ACTIVE");
      setTenants(
        activeContracts.map((c: { id: string; contractCode: string; propertyName?: string; roomNumber?: string; district?: string; customer: { fullName: string; phone: string; idCard?: string | null }; startDate?: string; endDate?: string; signedDate: string }) => ({
          contractId: c.id,
          contractCode: c.contractCode,
          roomLabel: `${c.propertyName || ""} — ${c.roomNumber || ""}`,
          district: c.district || "",
          customerName: c.customer.fullName,
          customerPhone: c.customer.phone,
          customerIdCard: c.customer.idCard,
          startDate: c.startDate,
          endDate: c.endDate,
          signedDate: c.signedDate,
        }))
      );
      if (!rateForm.propertyId && ld.properties?.[0]?.id) {
        setRateForm((f) => ({ ...f, propertyId: ld.properties[0].id }));
      }
      if (!expForm.propertyId && ld.properties?.[0]?.id) {
        setExpForm((f) => ({ ...f, propertyId: ld.properties[0].id }));
      }
    }
    if (extRes.ok) {
      const ext = await extRes.json();
      setResidents(ext.residents || []);
      setRates(ext.propertyRates || []);
      setExpenses(ext.operatingExpenses || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddResident(e: React.FormEvent) {
    e.preventDefault();
    const room = rooms.find((r) => r.id === resForm.roomId);
    if (!room) return;
    const res = await fetch("/api/landlord/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "RESIDENT",
        ...resForm,
        roomLabel: `${room.propertyName} — ${room.roomNumber}`,
      }),
    });
    if (res.ok) {
      setResForm({ roomId: "", fullName: "", phone: "", idCard: "", vehiclePlate: "", keyCardCode: "", tempResidenceDone: false });
      loadAll();
    }
  }

  async function handleSaveRates(e: React.FormEvent) {
    e.preventDefault();
    const prop = properties.find((p) => p.id === rateForm.propertyId);
    if (!prop) return;
    const res = await fetch("/api/landlord/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "PROPERTY_RATES",
        ...rateForm,
        propertyName: prop.name,
      }),
    });
    if (res.ok) loadAll();
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const prop = properties.find((p) => p.id === expForm.propertyId);
    if (!prop) return;
    const res = await fetch("/api/landlord/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "OPERATING_EXPENSE",
        ...expForm,
        propertyName: prop.name,
      }),
    });
    if (res.ok) {
      setExpForm((f) => ({ ...f, title: "", amount: "" }));
      loadAll();
    }
  }

  async function handleSendSupport(e: React.FormEvent) {
    e.preventDefault();
    setSupportSentMsg("");
    const res = await fetch("/api/landlord/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "SEND_SUPPORT_REQUEST", ...supportForm }),
    });
    if (res.ok) {
      setSupportForm((f) => ({ ...f, message: "" }));
      setSupportSentMsg("Đã gửi yêu cầu thông báo tới đội ngũ NDAHOME thành công!");
    }
  }

  const totalOpExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <AppShell>
      <div className="space-y-6 pb-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-[28px] border border-indigo-400/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-950 p-6 sm:p-8 text-white shadow-xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 20%, rgba(56,189,248,0.35), transparent 45%), radial-gradient(circle at 15% 85%, rgba(99,102,241,0.3), transparent 45%)",
            }}
          />
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/15 border border-cyan-400/35 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-200">
              <Sparkles className="w-3.5 h-3.5" /> Quản trị Cư dân &amp; Vận hành Tòa nhà
            </div>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-white via-sky-100 to-cyan-300 bg-clip-text text-transparent">
              Cư dân, Tạm trú, Bảng giá &amp; Vận hành
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Quản lý danh sách cư dân đang ở, khai báo tạm trú, biển số xe, thẻ từ, bảng giá dịch vụ riêng từng khu nhà và chi phí vận hành tòa nhà.
            </p>
          </div>
        </div>

        {/* Pill Tabs */}
        <div className="inline-flex flex-wrap gap-1.5 bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-sm">
          {[
            { id: "RESIDENTS", label: `Cư dân & Tạm trú (${tenants.length + residents.length})`, icon: <Users className="w-4 h-4" /> },
            { id: "RATES", label: `Bảng giá Khu nhà (${rates.length})`, icon: <Settings className="w-4 h-4" /> },
            { id: "EXPENSES", label: `Chi phí Vận hành (${expenses.length})`, icon: <Wallet className="w-4 h-4" /> },
            { id: "SUPPORT", label: "Gửi yêu cầu NDAHOME", icon: <Send className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === t.id ? "bg-indigo-600 text-white shadow-sm shadow-md" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-neutral-500 bg-white rounded-3xl border border-neutral-200">
            Đang tải dữ liệu...
          </div>
        ) : tab === "RESIDENTS" ? (
          <div className="space-y-6">
            {/* Primary Tenants from Active Contracts */}
            <div className="bg-white rounded-3xl border border-neutral-200 overflow-x-auto shadow-sm">
              <div className="p-4 border-b border-neutral-100 font-extrabold text-sm text-neutral-900">
                Khách thuê chính đang ở ({tenants.length} phòng)
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Phòng / Khu vực</th>
                    <th className="px-4 py-3 text-left">Khách thuê</th>
                    <th className="px-4 py-3 text-left">CCCD / CMND</th>
                    <th className="px-4 py-3 text-left">Thời hạn ở</th>
                    <th className="px-4 py-3 text-right">Liên hệ nhanh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {tenants.map((t) => (
                    <tr key={t.contractId} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 font-bold text-neutral-900">
                        {t.roomLabel} <span className="text-neutral-400 font-normal">({t.district})</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold">{t.customerName}</div>
                        <div className="text-neutral-500">{t.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">{t.customerIdCard || "Chưa cập nhật"}</td>
                      <td className="px-4 py-3">
                        {formatDate(t.startDate || t.signedDate)} → {formatDate(t.endDate)}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5">
                        <a
                          href={`tel:${t.customerPhone}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold"
                        >
                          <Phone className="w-3 h-3" /> Gọi
                        </a>
                        <a
                          href={`https://zalo.me/${t.customerPhone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 font-bold"
                        >
                          <MessageCircle className="w-3 h-3" /> Zalo
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Co-residents / Temp Residence / Vehicle Plates */}
            <form onSubmit={handleAddResident} className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-3 shadow-sm text-xs">
              <div className="font-extrabold text-sm text-neutral-900">
                + Đăng ký Nhân khẩu ở cùng / Biển số xe / Tạm trú
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Phòng *</label>
                  <select
                    required
                    value={resForm.roomId}
                    onChange={(e) => setResForm({ ...resForm, roomId: e.target.value })}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.propertyName} — {r.roomNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Họ tên cư dân *</label>
                  <input
                    required
                    value={resForm.fullName}
                    onChange={(e) => setResForm({ ...resForm, fullName: e.target.value })}
                    placeholder="Nguyễn Văn B"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">SĐT / CCCD</label>
                  <input
                    value={resForm.phone}
                    onChange={(e) => setResForm({ ...resForm, phone: e.target.value })}
                    placeholder="090xxxxxxx"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Biển số xe</label>
                  <input
                    value={resForm.vehiclePlate}
                    onChange={(e) => setResForm({ ...resForm, vehiclePlate: e.target.value })}
                    placeholder="59X3-123.45"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Mã thẻ từ</label>
                  <input
                    value={resForm.keyCardCode}
                    onChange={(e) => setResForm({ ...resForm, keyCardCode: e.target.value })}
                    placeholder="CARD-012"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 font-semibold text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resForm.tempResidenceDone}
                    onChange={(e) => setResForm({ ...resForm, tempResidenceDone: e.target.checked })}
                  />
                  Đã khai báo tạm trú công an phường (VNeID)
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 font-bold cursor-pointer"
                >
                  Lưu cư dân &amp; xe
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {residents.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center justify-between gap-3 shadow-sm">
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-sm text-neutral-900">
                      {r.fullName} <span className="font-normal text-neutral-500">({r.roomLabel})</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-neutral-600">
                      {r.phone && <span>SĐT: {r.phone}</span>}
                      {r.vehiclePlate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 font-bold">
                          <Car className="w-3 h-3 text-amber-600" /> {r.vehiclePlate}
                        </span>
                      )}
                      {r.keyCardCode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold">
                          <CreditCard className="w-3 h-3" /> {r.keyCardCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/landlord/extras", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "TOGGLE_RESIDENT_TEMP_RES", id: r.id }),
                        });
                        loadAll();
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                        r.tempResidenceDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.tempResidenceDone ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {r.tempResidenceDone ? "Đã tạm trú" : "Chưa tạm trú"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/landlord/extras", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "DELETE_RESIDENT", id: r.id }),
                        });
                        loadAll();
                      }}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : tab === "RATES" ? (
          <div className="space-y-5">
            <form onSubmit={handleSaveRates} className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-sm text-xs">
              <div className="font-extrabold text-sm text-neutral-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" /> Cấu hình đơn giá mặc định theo Khu nhà (tự động điền khi chốt Điện – Nước)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block font-bold mb-1">Khu nhà *</label>
                  <select
                    required
                    value={rateForm.propertyId}
                    onChange={(e) => setRateForm({ ...rateForm, propertyId: e.target.value })}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 bg-white"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.district})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Giá điện (đ/kWh)</label>
                  <input
                    type="number"
                    value={rateForm.electricRate}
                    onChange={(e) => setRateForm({ ...rateForm, electricRate: e.target.value })}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Giá nước (đ/m³)</label>
                  <input
                    type="number"
                    value={rateForm.waterRate}
                    onChange={(e) => setRateForm({ ...rateForm, waterRate: e.target.value })}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Phí DV / Rác / Wifi</label>
                  <input
                    type="number"
                    value={rateForm.serviceFee}
                    onChange={(e) => setRateForm({ ...rateForm, serviceFee: e.target.value })}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Phí giữ xe / chiếc</label>
                  <input
                    type="number"
                    value={rateForm.parkingFee}
                    onChange={(e) => setRateForm({ ...rateForm, parkingFee: e.target.value })}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 font-bold cursor-pointer">
                  Lưu bảng giá khu nhà
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rates.map((r) => (
                <div key={r.propertyId} className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center justify-between text-xs shadow-sm">
                  <div>
                    <div className="font-extrabold text-sm text-neutral-900">{r.propertyName}</div>
                    <div className="text-neutral-500 mt-1">
                      Điện: <strong>{formatVND(r.electricRate)}</strong> · Nước: <strong>{formatVND(r.waterRate)}</strong> · DV:{" "}
                      <strong>{formatVND(r.serviceFee)}</strong> · Xe: <strong>{formatVND(r.parkingFee)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : tab === "EXPENSES" ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-r from-white to-rose-50 border border-rose-200 p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-neutral-500">Tổng chi phí vận hành đã ghi nhận</div>
                <div className="text-2xl font-black text-rose-600 mt-1">{formatVND(totalOpExpenses)}</div>
              </div>
            </div>

            <form onSubmit={handleAddExpense} className="bg-white rounded-3xl border border-neutral-200 p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs shadow-sm">
              <div>
                <label className="block font-bold mb-1">Khu nhà *</label>
                <select
                  required
                  value={expForm.propertyId}
                  onChange={(e) => setExpForm({ ...expForm, propertyId: e.target.value })}
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 bg-white"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Tháng</label>
                <input
                  type="month"
                  value={expForm.monthKey}
                  onChange={(e) => setExpForm({ ...expForm, monthKey: e.target.value })}
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">Khoản chi vận hành *</label>
                <input
                  required
                  value={expForm.title}
                  onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                  placeholder="VD: Điện hành lang, thuê bảo vệ, phí rác tòa nhà..."
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  required
                  value={expForm.amount}
                  onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                  placeholder="Số tiền"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 font-bold"
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white shadow-sm font-bold shrink-0 cursor-pointer">
                  Lưu
                </button>
              </div>
            </form>

            <div className="bg-white rounded-3xl border border-neutral-200 overflow-x-auto shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Tháng</th>
                    <th className="px-4 py-3 text-left">Khu nhà</th>
                    <th className="px-4 py-3 text-left">Nội dung chi</th>
                    <th className="px-4 py-3 text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {expenses.map((ex) => (
                    <tr key={ex.id}>
                      <td className="px-4 py-3 font-mono font-bold">{ex.monthKey}</td>
                      <td className="px-4 py-3 font-semibold">{ex.propertyName}</td>
                      <td className="px-4 py-3">{ex.title}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">{formatVND(ex.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendSupport} className="bg-white rounded-3xl border border-neutral-200 p-6 max-w-2xl space-y-4 shadow-sm text-xs">
            <div className="font-extrabold text-base text-neutral-900">Gửi Yêu cầu / Thông báo trực tiếp sang NDAHOME</div>
            <div>
              <label className="block font-bold mb-1.5">Loại yêu cầu</label>
              <select
                value={supportForm.category}
                onChange={(e) => setSupportForm({ ...supportForm, category: e.target.value })}
                className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 bg-white font-semibold"
              >
                <option value="BOOST_EMPTY_ROOM">Nhờ đội Sales đẩy nhanh tìm khách cho phòng trống</option>
                <option value="REMIND_PAYOUT">Nhắc Kế toán / Admin đối soát chuyển tiền cọc</option>
                <option value="OTHER">Yêu cầu hỗ trợ khác (đổi giá thuê, sửa thông tin...)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1.5">Nội dung chi tiết *</label>
              <textarea
                rows={4}
                required
                value={supportForm.message}
                onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
                placeholder="Nhập nội dung cần gửi tới Ban Giám đốc / Sales / Kế toán NDAHOME..."
                className="w-full border border-neutral-300 rounded-xl px-3 py-2.5"
              />
            </div>
            {supportSentMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                {supportSentMsg}
              </div>
            )}
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 font-bold inline-flex items-center gap-2 cursor-pointer">
              <Send className="w-4 h-4" /> Gửi thông báo ngay
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
