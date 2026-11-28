"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RoomStatusFilterSelect } from "@/components/RoomStatusFilterSelect";
import { buildDepositReceiptHtml, printDepositReceiptPdf, DepositReceiptData } from "@/lib/depositReceiptPrint";
import { exportToExcel } from "@/lib/export";
import { formatVND, formatShortVND, formatDate } from "@/lib/finance";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Building2,
  Home,
  Plus,
  Pencil,
  Wallet,
  CheckCircle2,
  Clock,
  Upload,
  X,
  MapPin,
  Wrench,
  User,
  FileText,
  Printer,
  ExternalLink,
  Search,
  Download,
  AlertTriangle,
  Sparkles,
  Layers,
  TrendingUp,
  Maximize2,
  ArrowUpRight,
  ShieldCheck,
  BellRing,
  LogOut,
  RefreshCw,
  BarChart3,
} from "lucide-react";

const ROOM_TYPE_LABELS: Record<string, string> = {
  PHONG_TRO: "Phòng trọ",
  PHONG_THUONG: "Thuê phòng thường",
  CHUNG_CU: "Chung cư / CHDV",
  STUDIO: "Studio / Duplex",
  NHA_NGUYEN_CAN: "Nhà nguyên căn",
};

interface DepositItem {
  id: string;
  totalDeposit: number;
  collectedAmount: number;
  landlordShare: number;
  landlordPaidAmount: number;
  landlordPayoutStatus: string;
}

interface ContractItem {
  id: string;
  contractCode: string;
  status: string;
  monthlyRent: number;
  depositAmount: number;
  landlordPayable: number;
  signedDate: string;
  startDate?: string;
  endDate?: string;
  durationMonths: number;
  invoiceUrl?: string | null;
  note?: string | null;
  roomNumber?: string;
  propertyName?: string;
  district?: string;
  address?: string;
  landlordName?: string;
  landlordPhone?: string;
  customer: { fullName: string; phone: string; idCard?: string | null; email?: string | null };
  sales: { fullName: string };
  deposits: DepositItem[];
}

interface RoomItem {
  id: string;
  propertyId: string;
  propertyName: string;
  district: string;
  address: string;
  landlordName?: string;
  landlordPhone?: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  area: number;
  price: number;
  amenities?: string | null;
  imageUrl?: string | null;
  status: string;
  contracts: ContractItem[];
}

interface PropertyItem {
  id: string;
  name: string;
  district: string;
  address: string;
  landlordName: string;
  landlordPhone: string;
  note?: string | null;
  rooms: RoomItem[];
}

interface LandlordData {
  properties: PropertyItem[];
  rooms: RoomItem[];
  contracts: ContractItem[];
  stats: {
    totalProperties: number;
    totalRooms: number;
    availableRooms: number;
    reservedRooms: number;
    rentedRooms: number;
    maintenanceRooms: number;
    totalLandlordShare: number;
    paidToLandlord: number;
    unpaidToLandlord: number;
  };
}

export default function LandlordPortalPage() {
  const [data, setData] = useState<LandlordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ROOMS" | "PROPERTIES" | "PAYOUTS" | "ISSUES" | "ANALYTICS">("ROOMS");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("ALL");
  const [filterPropertyId, setFilterPropertyId] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [issues, setIssues] = useState<
    { id: string; roomId: string; roomLabel: string; title: string; cost: number; status: "OPEN" | "DONE"; createdAt: string }[]
  >([]);
  const [vacatingNotices, setVacatingNotices] = useState<
    { roomId: string; roomLabel: string; expectedVacateDate: string; note?: string; reportedAt: string }[]
  >([]);
  const [utilities, setUtilities] = useState<
    { roomId: string; totalAmount: number; isPaid: boolean }[]
  >([]);
  const [operatingExpenses, setOperatingExpenses] = useState<
    { propertyId: string; amount: number }[]
  >([]);
  const [vacateRoomTarget, setVacateRoomTarget] = useState<RoomItem | null>(null);
  const [vacateForm, setVacateForm] = useState({ expectedVacateDate: "", note: "" });
  const [checkoutContract, setCheckoutContract] = useState<ContractItem | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({ finalUtilityFee: "0", damageFee: "0", note: "" });
  const [issueForm, setIssueForm] = useState({ roomId: "", title: "", cost: "0" });
  const [nowMs, setNowMs] = useState<number>(0);

  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [propForm, setPropForm] = useState({
    name: "",
    district: "Bình Thạnh",
    address: "",
    landlordName: "",
    landlordPhone: "",
    note: "",
  });

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractItem | null>(null);
  const [receiptModalData, setReceiptModalData] = useState<DepositReceiptData | null>(null);
  const [roomForm, setRoomForm] = useState({
    propertyId: "",
    roomNumber: "",
    roomType: "PHONG_TRO",
    floor: "1",
    area: "25",
    monthlyPrice: "4500000",
    amenities: "",
    description: "",
    imageUrl: "",
    status: "AVAILABLE",
  });

  async function loadData() {
    setLoading(true);
    const [res, extRes] = await Promise.all([fetch("/api/landlord"), fetch("/api/landlord/extras")]);
    if (res.ok) setData(await res.json());
    if (extRes.ok) {
      const ext = await extRes.json();
      setIssues(ext.issues || []);
      setVacatingNotices(ext.vacatingNotices || []);
      setUtilities(ext.utilities || []);
      setOperatingExpenses(ext.operatingExpenses || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    setNowMs(Date.now());
    loadData();
  }, []);

  async function handleSaveProperty(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/landlord", {
      method: editingPropertyId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "PROPERTY",
        id: editingPropertyId || undefined,
        ...propForm,
      }),
    });
    if (res.ok) {
      setShowPropertyModal(false);
      setEditingPropertyId(null);
      loadData();
    }
  }

  async function handleSaveRoom(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/landlord", {
      method: editingRoomId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "ROOM",
        id: editingRoomId || undefined,
        ...roomForm,
      }),
    });
    if (res.ok) {
      setShowRoomModal(false);
      setEditingRoomId(null);
      loadData();
    }
  }

  async function handleToggleMaintenance(room: RoomItem) {
    if (room.status !== "AVAILABLE" && room.status !== "MAINTENANCE") return;
    const nextStatus = room.status === "AVAILABLE" ? "MAINTENANCE" : "AVAILABLE";
    await fetch("/api/landlord", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "ROOM", id: room.id, status: nextStatus }),
    });
    loadData();
  }

  async function handleRoomImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (res.ok && d.url) setRoomForm((f) => ({ ...f, imageUrl: d.url }));
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleSaveIssue(e: React.FormEvent) {
    e.preventDefault();
    const room = data?.rooms.find((r) => r.id === issueForm.roomId);
    if (!room || !issueForm.title.trim()) return;
    const res = await fetch("/api/landlord/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ISSUE",
        ...issueForm,
        roomLabel: `${room.propertyName} — ${room.roomNumber}`,
      }),
    });
    if (res.ok) {
      setIssueForm({ roomId: "", title: "", cost: "0" });
      loadData();
    }
  }

  async function handleReportVacating(e: React.FormEvent) {
    e.preventDefault();
    if (!vacateRoomTarget) return;
    const res = await fetch("/api/landlord/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "REPORT_VACATING",
        roomId: vacateRoomTarget.id,
        roomLabel: `${vacateRoomTarget.propertyName} — ${vacateRoomTarget.roomNumber}`,
        expectedVacateDate: vacateForm.expectedVacateDate,
        note: vacateForm.note,
      }),
    });
    if (res.ok) {
      setVacateRoomTarget(null);
      loadData();
    }
  }

  async function handleConfirmCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!checkoutContract) return;
    const res = await fetch("/api/landlord", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "CHECKOUT_CONTRACT",
        contractId: checkoutContract.id,
        finalUtilityFee: Number(checkoutForm.finalUtilityFee || 0),
        damageFee: Number(checkoutForm.damageFee || 0),
        note: checkoutForm.note,
      }),
    });
    if (res.ok) {
      setCheckoutContract(null);
      setSelectedContract(null);
      loadData();
    }
  }

  async function handleRenewContract(contractId: string, addMonths: 6 | 12) {
    const res = await fetch("/api/landlord", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "RENEW_CONTRACT", contractId, addMonths }),
    });
    if (res.ok) {
      setSelectedContract(null);
      loadData();
    }
  }

  const districtsList = Array.from(new Set((data?.properties || []).map((p) => p.district).filter(Boolean))).sort();
  const visibleProperties = (data?.properties || []).filter(
    (p) => filterDistrict === "ALL" || p.district === filterDistrict
  );

  const filteredRooms = (data?.rooms || []).filter((r) => {
    if (filterDistrict !== "ALL" && r.district !== filterDistrict) return false;
    if (filterPropertyId !== "ALL" && r.propertyId !== filterPropertyId) return false;
    if (filterStatus !== "ALL" && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const customerName = r.contracts[0]?.customer.fullName?.toLowerCase() || "";
      const customerPhone = r.contracts[0]?.customer.phone?.toLowerCase() || "";
      const hay = `${r.propertyName} ${r.roomNumber} ${r.district} ${r.landlordName || ""} ${customerName} ${customerPhone}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const expiringContracts = (data?.contracts || []).filter((c) => {
    if (c.status !== "ACTIVE" || !c.endDate || !nowMs) return false;
    const daysLeft = Math.ceil((new Date(c.endDate).getTime() - nowMs) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= 30;
  });

  function handleExportRoomsExcel() {
    if (!data) return;
    exportToExcel(
      filteredRooms.map((r) => ({
        KhuNha: r.propertyName,
        Quan: r.district,
        Phong: r.roomNumber,
        LoaiHinh: ROOM_TYPE_LABELS[r.roomType] || r.roomType,
        GiaThue: r.price,
        TrangThai: r.status,
        ChuNha: r.landlordName || "",
        SDTChuNha: r.landlordPhone || "",
        KhachThue: r.contracts[0]?.customer.fullName || "",
      })),
      "NDAHOME_DanhSach_PhongTro",
      "PhongTro"
    );
  }

  const occupancyRate =
    data && data.stats.totalRooms > 0
      ? Math.round(((data.stats.rentedRooms + data.stats.reservedRooms) / data.stats.totalRooms) * 100)
      : 0;

  const totalIssueCost = issues.reduce((s, i) => s + i.cost, 0);
  const openIssuesCount = issues.filter((i) => i.status === "OPEN").length;

  return (
    <AppShell>
      <div className="space-y-6 pb-8">
        {/* Modern Indigo-Cyan Hero Stage */}
        <div className="relative overflow-hidden rounded-[28px] border border-indigo-400/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-950 p-6 sm:p-8 text-white shadow-[0_24px_60px_-15px_rgba(30,41,59,0.45)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 15%, rgba(56,189,248,0.38), transparent 45%), radial-gradient(circle at 15% 90%, rgba(99,102,241,0.35), transparent 45%), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "100% 100%, 100% 100%, 36px 36px, 36px 36px",
            }}
          />

          <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/15 border border-cyan-400/35 px-3.5 py-1 text-[11px] font-bold tracking-wider uppercase text-cyan-200">
                <Sparkles className="w-3.5 h-3.5" /> NDAHOME Property Executive
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-sky-100 to-cyan-300 bg-clip-text text-transparent">
                Cổng Chủ Trọ &amp; Quản Lý Hệ Thống Phòng
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/95 max-w-2xl leading-relaxed">
                Điều hành tập trung toàn bộ tòa nhà theo từng quận, kiểm soát trạng thái phòng thời gian thực, xem hợp đồng và đối soát dòng tiền với NDAHOME.
              </p>

              {data && (
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] border border-white/15 px-3.5 py-2 text-xs">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-200">Tỷ lệ lấp đầy:</span>
                    <strong className="text-emerald-300 text-sm">{occupancyRate}%</strong>
                    <div className="w-24 h-2 rounded-full bg-white/15 overflow-hidden ml-1">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 transition-all duration-700"
                        style={{ width: `${occupancyRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] border border-white/15 px-3.5 py-2 text-xs text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-cyan-300" />
                    <span>{data.stats.totalProperties} khu nhà · {data.stats.totalRooms} phòng</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleExportRoomsExcel}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer"
              >
                <Download className="w-4 h-4" /> Xuất Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingPropertyId(null);
                  setPropForm({ name: "", district: "Bình Thạnh", address: "", landlordName: "", landlordPhone: "", note: "" });
                  setShowPropertyModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 backdrop-blur-md transition cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-amber-300" /> + Thêm Khu nhà
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingRoomId(null);
                  setRoomForm({
                    propertyId: data?.properties[0]?.id || "",
                    roomNumber: "",
                    roomType: "PHONG_TRO",
                    floor: "1",
                    area: "25",
                    monthlyPrice: "4500000",
                    amenities: "",
                    description: "",
                    imageUrl: "",
                    status: "AVAILABLE",
                  });
                  setShowRoomModal(true);
                }}
                disabled={!data?.properties?.length}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-200 via-amber-400 to-amber-500 hover:brightness-110 text-neutral-950 text-xs font-black inline-flex items-center gap-1.5 shadow-[0_0_25px_rgba(251,191,36,0.35)] transition cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Thêm Phòng mới
              </button>
            </div>
          </div>
        </div>

        {/* 4 High-Craft KPI Cards */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-amber-50/70 border border-amber-200/80 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Khu nhà quản lý</span>
                <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-black text-neutral-900 mt-2 tabular-nums">{data.stats.totalProperties} khu</div>
              <div className="text-xs text-neutral-500 mt-1">Tổng quy mô {data.stats.totalRooms} phòng</div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-emerald-50/70 border border-emerald-200/80 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tình trạng phòng</span>
                <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-2 tabular-nums">
                {data.stats.availableRooms} trống · {data.stats.rentedRooms} thuê
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  {data.stats.reservedRooms} đã cọc
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                  {data.stats.maintenanceRooms} bảo trì
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-sky-50/70 border border-sky-200/80 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Phần chủ trọ được chia</span>
                <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-700 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl font-black text-sky-700 mt-2 tabular-nums">{formatVND(data.stats.totalLandlordShare)}</div>
              <div className="text-xs text-neutral-500 mt-1">{data.contracts.length} hợp đồng phát sinh</div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-orange-50/70 border border-orange-200/80 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Chờ NDAHOME trả</span>
                <span className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-700 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl font-black text-orange-600 mt-2 tabular-nums">{formatVND(data.stats.unpaidToLandlord)}</div>
              <div className="text-xs text-emerald-700 font-bold mt-1">
                Đã nhận: {formatVND(data.stats.paidToLandlord)}
              </div>
            </div>
          </div>
        )}

        {/* Expiring contracts alert */}
        {expiringContracts.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span>
                Có <strong>{expiringContracts.length} hợp đồng</strong> sắp hết hạn trong 30 ngày tới (
                {expiringContracts.map((c) => `${c.propertyName} - ${c.roomNumber}`).join(", ")}).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTab("PAYOUTS")}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white shadow-sm font-bold cursor-pointer hover:bg-neutral-800 transition"
            >
              Xem hợp đồng
            </button>
          </div>
        )}

        {/* Glassmorphic Segmented Tab Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-neutral-200 shadow-sm">
            {[
              { id: "ROOMS", label: `Danh sách Phòng`, count: data?.rooms.length || 0, icon: <Home className="w-4 h-4" /> },
              { id: "PROPERTIES", label: `Khu nhà`, count: data?.properties.length || 0, icon: <Building2 className="w-4 h-4" /> },
              { id: "PAYOUTS", label: `Hợp đồng & Đối soát`, count: data?.contracts.length || 0, icon: <FileText className="w-4 h-4" /> },
              { id: "ISSUES", label: `Bảo trì & Sự cố`, count: openIssuesCount, icon: <Wrench className="w-4 h-4" /> },
              { id: "ANALYTICS", label: `Báo cáo Lợi nhuận`, count: data?.properties.length || 0, icon: <BarChart3 className="w-4 h-4" /> },
            ].map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm shadow-md"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                      active ? "bg-amber-400/20 text-amber-300" : "bg-neutral-200/70 text-neutral-700"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading || !data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-80 rounded-3xl bg-white border border-neutral-200 animate-pulse" />
            ))}
          </div>
        ) : tab === "ROOMS" ? (
          <div className="space-y-5">
            {/* Sleek Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-neutral-200 shadow-sm">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm phòng, chủ nhà, khách..."
                  className="w-full border border-neutral-300 rounded-xl pl-9 pr-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <select
                value={filterDistrict}
                onChange={(e) => {
                  setFilterDistrict(e.target.value);
                  setFilterPropertyId("ALL");
                }}
                className="border border-neutral-300 rounded-xl px-3 py-2 text-xs bg-white font-medium"
              >
                <option value="ALL">Tất cả Quận ({districtsList.length})</option>
                {districtsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={filterPropertyId}
                onChange={(e) => setFilterPropertyId(e.target.value)}
                className="border border-neutral-300 rounded-xl px-3 py-2 text-xs bg-white font-medium"
              >
                <option value="ALL">
                  {filterDistrict === "ALL"
                    ? `Tất cả khu nhà (${visibleProperties.length})`
                    : `Tất cả khu tại ${filterDistrict} (${visibleProperties.length})`}
                </option>
                {visibleProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.district})
                  </option>
                ))}
              </select>
              <RoomStatusFilterSelect value={filterStatus} onChange={setFilterStatus} />
            </div>

            {filteredRooms.length === 0 ? (
              <div className="p-14 text-center text-sm text-neutral-500 bg-white rounded-3xl border border-neutral-200 shadow-sm">
                Chưa có phòng nào phù hợp bộ lọc. Hãy thử xóa bộ lọc hoặc bấm <strong>Thêm Phòng mới</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRooms.map((r) => {
                  const activeContract = r.contracts[0];
                  const statusBadge =
                    r.status === "AVAILABLE"
                      ? { label: "Còn trống", dot: "bg-emerald-500", cls: "bg-white/95 text-emerald-700 border border-emerald-200" }
                      : r.status === "RESERVED"
                        ? { label: "Đã đặt cọc", dot: "bg-amber-500", cls: "bg-white/95 text-amber-800 border border-amber-200" }
                        : r.status === "RENTED"
                          ? { label: "Đã thuê", dot: "bg-cyan-300", cls: "bg-indigo-950/90 text-cyan-200 border border-cyan-400/40" }
                          : { label: "Bảo trì", dot: "bg-rose-500", cls: "bg-rose-50/95 text-rose-700 border border-rose-200" };

                  const amenityTags = (r.amenities || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 3);

                  return (
                    <div
                      key={r.id}
                      className="group bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm flex flex-col transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_24px_48px_-12px_rgba(79,70,229,0.16)] hover:border-indigo-400/70"
                    >
                      <div className="relative aspect-[16/10] bg-neutral-100 overflow-hidden">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.imageUrl}
                            alt={r.roomNumber}
                            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                            Chưa có ảnh phòng
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 text-[11px] font-bold">
                          {ROOM_TYPE_LABELS[r.roomType] || r.roomType}
                        </span>
                        <span
                          className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold shadow-md backdrop-blur-md ${statusBadge.cls}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.label}
                        </span>
                        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between gap-2 text-white">
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm truncate drop-shadow">{r.propertyName}</div>
                            <div className="text-[11px] text-neutral-200/90 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-amber-400 shrink-0" /> {r.district}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-neutral-950 font-black text-xs shadow shrink-0">
                            {formatVND(r.price)}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-extrabold text-neutral-900 text-base">Phòng {r.roomNumber}</div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-lg">
                              <Maximize2 className="w-3 h-3 text-neutral-500" />
                              Tầng {r.floor} · {r.area}m²
                            </span>
                          </div>

                          {r.landlordName && (
                            <div className="text-[11px] text-neutral-600 flex items-center gap-1.5 bg-neutral-50 border border-neutral-200/70 rounded-xl px-2.5 py-1.5">
                              <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate">
                                Chủ: <strong className="text-neutral-900">{r.landlordName}</strong>
                                {r.landlordPhone ? ` · ${r.landlordPhone}` : ""}
                              </span>
                            </div>
                          )}

                          {amenityTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {amenityTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/60 text-[10px] font-semibold"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {activeContract && (r.status === "RESERVED" || r.status === "RENTED") && (
                            <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200 text-[11px] text-amber-950 flex items-center justify-between gap-2">
                              <span className="truncate">
                                Khách: <strong>{activeContract.customer.fullName}</strong> ({activeContract.customer.phone})
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedContract({
                                    ...activeContract,
                                    roomNumber: r.roomNumber,
                                    propertyName: r.propertyName,
                                    district: r.district,
                                    address: r.address,
                                    landlordName: r.landlordName,
                                    landlordPhone: r.landlordPhone,
                                  })
                                }
                                className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-sm font-bold hover:bg-neutral-800 inline-flex items-center gap-1 cursor-pointer transition"
                              >
                                Xem HĐ <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-end gap-1.5">
                          {r.status === "RENTED" && (() => {
                            const vac = vacatingNotices.find((vn) => vn.roomId === r.id);
                            return vac ? (
                              <span className="px-2.5 py-1 rounded-xl bg-orange-100 text-orange-800 text-[10px] font-bold">
                                Sắp trống {formatDate(vac.expectedVacateDate)}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const d = new Date();
                                  d.setDate(d.getDate() + 15);
                                  setVacateForm({ expectedVacateDate: d.toISOString().slice(0, 10), note: "" });
                                  setVacateRoomTarget(r);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                              >
                                <BellRing className="w-3 h-3" /> Báo sắp trống
                              </button>
                            );
                          })()}
                          {(r.status === "AVAILABLE" || r.status === "MAINTENANCE") && (
                            <button
                              type="button"
                              onClick={() => handleToggleMaintenance(r)}
                              className="px-3 py-1.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                            >
                              <Wrench className="w-3 h-3" />
                              {r.status === "AVAILABLE" ? "Bảo trì" : "Mở lại"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRoomId(r.id);
                              setRoomForm({
                                propertyId: r.propertyId,
                                roomNumber: r.roomNumber,
                                roomType: r.roomType,
                                floor: String(r.floor),
                                area: String(r.area),
                                monthlyPrice: String(r.price),
                                amenities: r.amenities || "",
                                description: "",
                                imageUrl: r.imageUrl || "",
                                status: r.status,
                              });
                              setShowRoomModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm shadow-indigo-500/20 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <Pencil className="w-3 h-3" /> Chỉnh sửa
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === "PROPERTIES" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.properties.map((p) => {
              const total = p.rooms.length;
              const emptyCount = p.rooms.filter((r) => r.status === "AVAILABLE").length;
              const rentedCount = p.rooms.filter((r) => r.status === "RENTED").length;
              const reservedCount = p.rooms.filter((r) => r.status === "RESERVED").length;
              const fillPct = total > 0 ? Math.round(((rentedCount + reservedCount) / total) * 100) : 0;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl hover:border-amber-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold mb-1.5">
                        <MapPin className="w-3 h-3" /> {p.district}
                      </span>
                      <h3 className="font-extrabold text-neutral-900 text-lg">{p.name}</h3>
                      <div className="text-xs text-neutral-500 mt-0.5">{p.address}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPropertyId(p.id);
                        setPropForm({
                          name: p.name,
                          district: p.district,
                          address: p.address,
                          landlordName: p.landlordName || "",
                          landlordPhone: p.landlordPhone || "",
                          note: p.note || "",
                        });
                        setShowPropertyModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm shadow-indigo-500/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Sửa
                    </button>
                  </div>

                  {/* Occupancy bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500 font-medium">Lấp đầy khu nhà</span>
                      <span className="font-bold text-emerald-700">{fillPct}% ({rentedCount + reservedCount}/{total} phòng)</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-700"
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-100 text-xs">
                    <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-neutral-800">
                      <User className="w-3.5 h-3.5 text-amber-600" />
                      Chủ nhà: <strong>{p.landlordName}</strong> {p.landlordPhone ? `· ${p.landlordPhone}` : ""}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{emptyCount} trống</span>
                      <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">{rentedCount} thuê</span>
                    </div>
                  </div>
                  {p.note && <div className="text-xs text-neutral-500 italic">Ghi chú: {p.note}</div>}
                </div>
              );
            })}
          </div>
        ) : tab === "ISSUES" ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white border border-rose-200 p-4 shadow-sm">
                <div className="text-xs text-neutral-500">Sự cố đang xử lý</div>
                <div className="text-2xl font-black text-rose-600 mt-1">{openIssuesCount} việc</div>
              </div>
              <div className="rounded-2xl bg-white border border-emerald-200 p-4 shadow-sm">
                <div className="text-xs text-neutral-500">Đã sửa xong</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{issues.length - openIssuesCount} việc</div>
              </div>
              <div className="rounded-2xl bg-white border border-amber-200 p-4 shadow-sm">
                <div className="text-xs text-neutral-500">Tổng chi phí bảo trì</div>
                <div className="text-2xl font-black text-amber-700 mt-1">{formatVND(totalIssueCost)}</div>
              </div>
            </div>

            <form onSubmit={handleSaveIssue} className="bg-white rounded-2xl border border-neutral-200 p-5 flex flex-wrap gap-3 items-end text-xs shadow-sm">
              <div className="flex-1 min-w-[200px]">
                <label className="block font-bold mb-1">Phòng gặp sự cố *</label>
                <select
                  required
                  value={issueForm.roomId}
                  onChange={(e) => setIssueForm({ ...issueForm, roomId: e.target.value })}
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 bg-white"
                >
                  <option value="">-- Chọn phòng --</option>
                  {data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.propertyName} — {r.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-[2] min-w-[220px]">
                <label className="block font-bold mb-1">Nội dung bảo trì / sửa chữa *</label>
                <input
                  required
                  value={issueForm.title}
                  onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                  placeholder="VD: Vệ sinh máy lạnh, thay vòi sen, sửa khóa cửa..."
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2.5"
                />
              </div>
              <div className="w-40">
                <label className="block font-bold mb-1">Chi phí dự kiến (VNĐ)</label>
                <input
                  type="number"
                  min={0}
                  value={issueForm.cost}
                  onChange={(e) => setIssueForm({ ...issueForm, cost: e.target.value })}
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 font-bold cursor-pointer hover:bg-neutral-800 transition"
              >
                + Ghi nhận sự cố
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {issues.length === 0 ? (
                <div className="md:col-span-2 p-12 text-center text-xs text-neutral-500 bg-white rounded-3xl border border-neutral-200">
                  Chưa có ghi nhận sự cố / bảo trì nào.
                </div>
              ) : (
                issues.map((iss) => (
                  <div
                    key={iss.id}
                    className={`bg-white rounded-2xl border border-neutral-200 border-l-4 ${
                      iss.status === "DONE" ? "border-l-emerald-500" : "border-l-rose-500"
                    } p-4 flex items-center justify-between gap-3 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg`}
                  >
                    <div>
                      <div className="font-bold text-sm text-neutral-900">{iss.title}</div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {iss.roomLabel} · Chi phí: <strong className="text-neutral-800">{formatVND(iss.cost)}</strong> · {formatDate(iss.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch("/api/landlord/extras", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: "TOGGLE_ISSUE_STATUS", id: iss.id }),
                        });
                        loadData();
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer transition ${
                        iss.status === "DONE"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                      }`}
                    >
                      {iss.status === "DONE" ? "Đã sửa xong" : "Đang xử lý"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : tab === "ANALYTICS" ? (
          (() => {
            const propAnalytics = data.properties.map((p) => {
              const roomIds = new Set(p.rooms.map((r) => r.id));
              const estimatedRentRev = p.rooms
                .filter((r) => r.status === "RENTED")
                .reduce((s, r) => s + r.price, 0);
              const utilityPaidRev = utilities
                .filter((u) => roomIds.has(u.roomId) && u.isPaid)
                .reduce((s, u) => s + u.totalAmount, 0);
              const revenue = utilityPaidRev > 0 ? utilityPaidRev : estimatedRentRev;
              const issueCost = issues
                .filter((i) => roomIds.has(i.roomId))
                .reduce((s, i) => s + i.cost, 0);
              const opCost = operatingExpenses
                .filter((e) => e.propertyId === p.id)
                .reduce((s, e) => s + e.amount, 0);
              const maintenanceCost = issueCost + opCost;
              return {
                name: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
                fullName: p.name,
                district: p.district,
                revenue,
                maintenanceCost,
                netProfit: revenue - maintenanceCost,
              };
            });

            return (
              <div className="space-y-5">
                <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-neutral-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-amber-600" /> Biểu đồ Doanh thu – Bảo trì – Lợi nhuận ròng theo Khu nhà
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propAnalytics} accessibilityLayer={false}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatShortVND(Number(v))} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => formatVND(Number(v))} />
                        <Legend />
                        <Bar dataKey="revenue" name="Doanh thu phòng/điện nước" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="maintenanceCost" name="Chi phí bảo trì" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="netProfit" name="Lợi nhuận ròng" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-neutral-200 overflow-x-auto shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-200">
                      <tr>
                        <th className="px-5 py-3.5 text-left font-bold">Khu nhà</th>
                        <th className="px-5 py-3.5 text-left font-bold">Quận</th>
                        <th className="px-5 py-3.5 text-right font-bold">Doanh thu tháng</th>
                        <th className="px-5 py-3.5 text-right font-bold">Chi phí bảo trì</th>
                        <th className="px-5 py-3.5 text-right font-bold">Lợi nhuận ròng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {propAnalytics.map((row) => (
                        <tr key={row.fullName} className="hover:bg-amber-50/40">
                          <td className="px-5 py-3.5 font-bold text-neutral-900">{row.fullName}</td>
                          <td className="px-5 py-3.5 text-neutral-600">{row.district}</td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-emerald-700">
                            {formatVND(row.revenue)}
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-rose-600">
                            {formatVND(row.maintenanceCost)}
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-extrabold text-amber-700">
                            {formatVND(row.netProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-200 text-xs">
                <tr>
                  <th className="px-5 py-4 text-left font-bold">Mã HĐ &amp; Trạng thái</th>
                  <th className="px-5 py-4 text-left font-bold">Phòng / Khách / Chủ</th>
                  <th className="px-5 py-4 text-right font-bold">Tổng cọc</th>
                  <th className="px-5 py-4 text-right font-bold">Phần trả Chủ trọ</th>
                  <th className="px-5 py-4 text-left font-bold">Thanh toán chủ trọ</th>
                  <th className="px-5 py-4 text-right font-bold">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.contracts.map((c) => {
                  const dep = c.deposits[0];
                  const isPaid = dep?.landlordPayoutStatus === "PAID";
                  const statusBadge =
                    c.status === "CLOSED"
                      ? { label: "Đã thanh lý", cls: "bg-neutral-200 text-neutral-700" }
                      : c.status === "FORFEITED"
                        ? { label: "Hủy cọc", cls: "bg-rose-100 text-rose-700" }
                        : c.status === "RESERVED"
                          ? { label: "Đã đặt cọc", cls: "bg-amber-100 text-amber-800" }
                          : { label: "Đã thuê / Ký HĐ", cls: "bg-emerald-100 text-emerald-700" };
                  return (
                    <tr key={c.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-amber-700">{c.contractCode}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-1">
                          {formatDate(c.signedDate)} · {c.durationMonths} tháng
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-neutral-900">
                          {c.propertyName} — {c.roomNumber}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          Khách: <strong className="text-neutral-700">{c.customer.fullName}</strong> ({c.customer.phone})
                          {c.landlordName ? ` · Chủ: ${c.landlordName}` : ""}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-semibold">{formatVND(c.depositAmount)}</td>
                      <td className="px-5 py-4 text-right tabular-nums font-extrabold text-emerald-700">
                        {formatVND(dep?.landlordShare ?? c.landlordPayable)}
                      </td>
                      <td className="px-5 py-4">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đã thanh toán
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5" /> Chờ công ty chuyển
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedContract(c)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm shadow-indigo-500/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <FileText className="w-3.5 h-3.5" /> Xem HĐ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Thêm / Sửa Khu nhà */}
        {showPropertyModal && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-neutral-900">
                  {editingPropertyId ? "Cập nhật thông tin Khu nhà" : "Thêm Khu nhà / Tòa nhà mới"}
                </h3>
                <button onClick={() => setShowPropertyModal(false)} className="p-1.5 hover:bg-neutral-100 rounded-xl cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveProperty} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Tên khu nhà / tòa nhà *</label>
                  <input
                    required
                    value={propForm.name}
                    onChange={(e) => setPropForm({ ...propForm, name: e.target.value })}
                    placeholder="VD: Nhà trọ Hùng Vương"
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Quận / Khu vực *</label>
                  <input
                    required
                    value={propForm.district}
                    onChange={(e) => setPropForm({ ...propForm, district: e.target.value })}
                    placeholder="VD: Bình Thạnh, Thủ Đức, Quận 12..."
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Địa chỉ chi tiết *</label>
                  <input
                    required
                    value={propForm.address}
                    onChange={(e) => setPropForm({ ...propForm, address: e.target.value })}
                    placeholder="Số nhà, đường, phường..."
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Tên chủ nhà *</label>
                    <input
                      required
                      value={propForm.landlordName}
                      onChange={(e) => setPropForm({ ...propForm, landlordName: e.target.value })}
                      placeholder="VD: Chị Lan / Anh Hùng"
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">SĐT chủ nhà *</label>
                    <input
                      required
                      value={propForm.landlordPhone}
                      onChange={(e) => setPropForm({ ...propForm, landlordPhone: e.target.value })}
                      placeholder="090xxxxxxx"
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Ghi chú thêm</label>
                  <textarea
                    rows={2}
                    value={propForm.note}
                    onChange={(e) => setPropForm({ ...propForm, note: e.target.value })}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowPropertyModal(false)} className="px-4 py-2 rounded-xl border border-neutral-300 text-xs font-semibold cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-xs font-bold cursor-pointer">
                    Lưu khu nhà
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Thêm / Sửa Phòng */}
        {showRoomModal && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-amber-200 my-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-neutral-900">
                  {editingRoomId ? "Cập nhật thông tin Phòng" : "Thêm Phòng mới"}
                </h3>
                <button onClick={() => setShowRoomModal(false)} className="p-1.5 hover:bg-neutral-100 rounded-xl cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveRoom} className="space-y-3">
                {!editingRoomId && (
                  <div>
                    <label className="block text-xs font-bold mb-1">Thuộc khu nhà *</label>
                    <select
                      required
                      value={roomForm.propertyId}
                      onChange={(e) => setRoomForm({ ...roomForm, propertyId: e.target.value })}
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs bg-white"
                    >
                      {(data?.properties || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.district})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Mã / Số phòng *</label>
                    <input
                      required
                      value={roomForm.roomNumber}
                      onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                      placeholder="VD: P101"
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Loại hình</label>
                    <select
                      value={roomForm.roomType}
                      onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs bg-white"
                    >
                      {Object.entries(ROOM_TYPE_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Tầng</label>
                    <input
                      type="number"
                      min={1}
                      value={roomForm.floor}
                      onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Diện tích (m²)</label>
                    <input
                      type="number"
                      min={5}
                      value={roomForm.area}
                      onChange={(e) => setRoomForm({ ...roomForm, area: e.target.value })}
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Giá thuê/tháng *</label>
                    <input
                      type="number"
                      min={500000}
                      required
                      value={roomForm.monthlyPrice}
                      onChange={(e) => setRoomForm({ ...roomForm, monthlyPrice: e.target.value })}
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Tiện ích</label>
                  <input
                    value={roomForm.amenities}
                    onChange={(e) => setRoomForm({ ...roomForm, amenities: e.target.value })}
                    placeholder="Máy lạnh, tủ lạnh, gác lửng, wifi..."
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Ảnh phòng</label>
                  <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-neutral-300 hover:border-amber-500 text-xs cursor-pointer">
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>{uploadingImg ? "Đang tải ảnh..." : roomForm.imageUrl ? "Đổi ảnh phòng" : "Tải ảnh phòng lên"}</span>
                    <input type="file" accept="image/*" onChange={handleRoomImageUpload} className="hidden" />
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowRoomModal(false)} className="px-4 py-2 rounded-xl border border-neutral-300 text-xs font-semibold cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-xs font-bold cursor-pointer">
                    Lưu thông tin phòng
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Xem chi tiết Hợp đồng */}
        {selectedContract && (() => {
          const c = selectedContract;
          const dep = c.deposits[0];
          const isReserved = c.status === "RESERVED";
          const isForfeited = c.status === "FORFEITED";
          const matchedPm = c.note?.match(/Hình thức thanh toán:\s*([^•]+)/);
          return (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setSelectedContract(null)}
            >
              <div
                className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-amber-200 my-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold text-amber-700">{c.contractCode}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isForfeited
                            ? "bg-rose-100 text-rose-700"
                            : isReserved
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {isForfeited
                          ? "Đã hủy cọc"
                          : isReserved
                            ? "Đã đặt cọc (Chờ ký giấy)"
                            : "Đã thanh toán đủ & Ký HĐ"}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Ngày ký: {formatDate(c.signedDate)} · Thời hạn: {c.durationMonths} tháng
                      {c.startDate && c.endDate ? ` (${formatDate(c.startDate)} → ${formatDate(c.endDate)})` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedContract(null)}
                    className="p-1.5 hover:bg-neutral-100 rounded-xl cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
                    <div className="font-bold text-neutral-900 mb-1">Phòng &amp; Chủ nhà</div>
                    <div>
                      Phòng: <strong>{c.propertyName} — {c.roomNumber}</strong>
                    </div>
                    {c.district && <div>Khu vực: {c.district}</div>}
                    {c.landlordName && (
                      <div>
                        Chủ nhà: <strong>{c.landlordName}</strong> {c.landlordPhone ? `(${c.landlordPhone})` : ""}
                      </div>
                    )}
                    <div>Sales phụ trách: {c.sales.fullName}</div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1">
                    <div className="font-bold text-neutral-900 mb-1">Khách thuê</div>
                    <div>
                      Họ tên: <strong>{c.customer.fullName}</strong>
                    </div>
                    <div>SĐT: {c.customer.phone}</div>
                    <div>CCCD/CMND: {c.customer.idCard || "Chưa cập nhật"}</div>
                    {c.customer.email && <div>Email: {c.customer.email}</div>}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-neutral-500">Giá thuê/tháng</div>
                    <div className="font-extrabold text-neutral-900 mt-0.5">{formatVND(c.monthlyRent)}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Tổng tiền cọc</div>
                    <div className="font-extrabold text-neutral-900 mt-0.5">{formatVND(c.depositAmount)}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500">Phần trả Chủ trọ</div>
                    <div className="font-extrabold text-emerald-700 mt-0.5">
                      {formatVND(dep?.landlordShare ?? c.landlordPayable)}
                    </div>
                  </div>
                </div>

                {c.note && (
                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 text-xs text-neutral-700">
                    <strong>Ghi chú:</strong> {c.note}
                  </div>
                )}

                {c.invoiceUrl && (
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700">Minh chứng / Hợp đồng đính kèm:</span>
                    <a
                      href={c.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-amber-700 font-bold hover:underline"
                    >
                      Mở xem file <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-neutral-100">
                  {c.status === "ACTIVE" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleRenewContract(c.id, 6)}
                        className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Gia hạn +6T
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRenewContract(c.id, 12)}
                        className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Gia hạn +12T
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutForm({ finalUtilityFee: "0", damageFee: "0", note: "" });
                          setCheckoutContract(c);
                        }}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Thanh lý / Trả phòng
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptModalData({
                        contractCode: c.contractCode,
                        customerName: c.customer.fullName,
                        customerPhone: c.customer.phone,
                        customerIdCard: c.customer.idCard || undefined,
                        roomLabel: `${c.propertyName || ""} — ${c.roomNumber || ""}`,
                        address: [c.address, c.district].filter(Boolean).join(", "),
                        monthlyRent: c.monthlyRent,
                        depositAmount: c.depositAmount,
                        collectedAmount: dep?.collectedAmount || c.depositAmount,
                        durationMonths: c.durationMonths,
                        moveInDate: c.signedDate,
                        salesName: c.sales.fullName,
                        paymentMethodLabel: matchedPm ? matchedPm[1].trim() : undefined,
                        evidenceUrl: c.invoiceUrl || undefined,
                        note: c.note || undefined,
                      });
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Xem / Tải Hóa đơn PDF
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal Báo phòng sắp trống cho Sales */}
        {vacateRoomTarget && (
          <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-orange-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-neutral-900">
                  Báo phòng sắp trống ({vacateRoomTarget.roomNumber})
                </h3>
                <button onClick={() => setVacateRoomTarget(null)} className="p-1.5 hover:bg-neutral-100 rounded-xl cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-neutral-500">
                Thông báo sẽ gửi ngay cho đội Sales để tìm khách mới trước khi phòng trống.
              </p>
              <form onSubmit={handleReportVacating} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Ngày dự kiến trả phòng *</label>
                  <input
                    type="date"
                    required
                    value={vacateForm.expectedVacateDate}
                    onChange={(e) => setVacateForm({ ...vacateForm, expectedVacateDate: e.target.value })}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Ghi chú cho Sales</label>
                  <textarea
                    rows={2}
                    value={vacateForm.note}
                    onChange={(e) => setVacateForm({ ...vacateForm, note: e.target.value })}
                    placeholder="VD: Khách báo chuyển công tác cuối tháng, có thể dẫn khách xem từ tuần sau..."
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setVacateRoomTarget(null)} className="px-4 py-2 rounded-xl border border-neutral-300 text-xs font-semibold cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer">
                    Gửi thông báo cho Sales
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Thanh lý / Trả phòng & Tính hoàn cọc */}
        {checkoutContract && (() => {
          const c = checkoutContract;
          const baseDeposit = c.deposits[0]?.collectedAmount || c.depositAmount;
          const utilFee = Math.max(0, Number(checkoutForm.finalUtilityFee || 0));
          const dmgFee = Math.max(0, Number(checkoutForm.damageFee || 0));
          const refund = Math.max(0, baseDeposit - utilFee - dmgFee);

          return (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-rose-700">
                    Thanh lý &amp; Trả phòng ({c.contractCode})
                  </h3>
                  <button onClick={() => setCheckoutContract(null)} className="p-1.5 hover:bg-neutral-100 rounded-xl cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleConfirmCheckout} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-bold mb-1">Điện nước tháng cuối (VNĐ)</label>
                      <input
                        type="number"
                        min={0}
                        value={checkoutForm.finalUtilityFee}
                        onChange={(e) => setCheckoutForm({ ...checkoutForm, finalUtilityFee: e.target.value })}
                        className="w-full border border-neutral-300 rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">Phí vệ sinh / Hư hỏng</label>
                      <input
                        type="number"
                        min={0}
                        value={checkoutForm.damageFee}
                        onChange={(e) => setCheckoutForm({ ...checkoutForm, damageFee: e.target.value })}
                        className="w-full border border-neutral-300 rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span>Tiền cọc ban đầu:</span>
                      <strong>{formatVND(baseDeposit)}</strong>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>Khấu trừ điện nước + hư hỏng:</span>
                      <strong>- {formatVND(utilFee + dmgFee)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 pt-1.5 text-sm font-extrabold text-emerald-700">
                      <span>Số tiền hoàn trả khách:</span>
                      <span>{formatVND(refund)}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Ghi chú thanh lý</label>
                    <textarea
                      rows={2}
                      value={checkoutForm.note}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, note: e.target.value })}
                      placeholder="VD: Đã nhận lại 2 bộ chìa khóa, phòng sạch sẽ..."
                      className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setCheckoutContract(null)} className="px-4 py-2 rounded-xl border border-neutral-300 text-xs font-semibold cursor-pointer">
                      Hủy
                    </button>
                    <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer">
                      Xác nhận Trả phòng &amp; Mở lại phòng
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Modal Xem trước & Tải Hóa đơn PDF */}
        {receiptModalData && (
          <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
                <div className="font-bold text-sm text-neutral-900">
                  Hóa đơn Đặt cọc / Hợp đồng {receiptModalData.contractCode}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printDepositReceiptPdf(receiptModalData)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white border border-indigo-500/30 shadow-sm shadow-indigo-500/20 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> In / Lưu PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptModalData(null)}
                    className="p-1.5 hover:bg-neutral-200 rounded-xl cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto bg-neutral-100">
                <iframe
                  title="Hóa đơn đặt cọc PDF"
                  srcDoc={buildDepositReceiptHtml(receiptModalData)}
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
