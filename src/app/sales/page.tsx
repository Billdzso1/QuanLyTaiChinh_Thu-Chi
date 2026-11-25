"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND, formatDate, calculateSalesCommission } from "@/lib/finance";
import { getStatusLabel } from "@/lib/labels";
import { Plus, Trophy, Building, Users, FileCheck2, Upload, Image as ImageIcon, X, User, Phone, Calendar, FileText, Pencil, Trash2 } from "lucide-react";

interface Contract {
  id: string;
  contractCode: string;
  durationMonths: number;
  monthlyRent: number;
  depositAmount: number;
  companyCommissionRate: number;
  companyRevenue: number;
  landlordPayable: number;
  signedDate: string;
  customer: { fullName: string; phone: string };
  room: { roomNumber: string; property: { name: string } };
  sales: { id: string; fullName: string };
  deposits: {
    id: string;
    totalDeposit: number;
    collectedAmount: number;
    companyShare: number;
    landlordShare: number;
    collectionStatus: string;
    landlordPayoutStatus: string;
  }[];
}

export default function SalesPage() {
  const [tab, setTab] = useState<"CONTRACTS" | "ROOMS" | "CUSTOMERS" | "LEADERBOARD">("CONTRACTS");
  const [contracts, setContracts] = useState<Contract[]>([]);
  interface RoomContractInfo {
    id: string;
    contractCode: string;
    durationMonths: number;
    monthlyRent: number;
    depositAmount: number;
    companyCommissionRate: number;
    companyRevenue: number;
    landlordPayable: number;
    signedDate: string;
    startDate: string;
    endDate: string;
    status: string;
    invoiceUrl?: string | null;
    note?: string | null;
    customer: {
      id: string;
      fullName: string;
      phone: string;
      email?: string | null;
      idCard?: string | null;
      source: string;
      status?: string;
      note?: string | null;
    };
    sales: { fullName: string; phone?: string | null };
    deposits: {
      totalDeposit: number;
      collectedAmount: number;
      remainingAmount: number;
      collectionStatus: string;
      landlordPayoutStatus: string;
    }[];
  }

  interface RoomItem {
    id: string;
    roomNumber: string;
    floor: number;
    area: number;
    price: number;
    status: string;
    amenities?: string | null;
    imageUrl?: string | null;
    property: { name: string; address?: string; district: string; landlordName?: string; landlordPhone?: string };
    contracts?: RoomContractInfo[];
  }

  const [crm, setCrm] = useState<{
    customers: { id: string; fullName: string; phone: string; email?: string | null; idCard?: string | null; source: string; status: string; note?: string | null; sales: { fullName: string } }[];
    properties: { id: string; name: string; district: string }[];
    rooms: RoomItem[];
    salesUsers: { id: string; fullName: string; kpiTarget: number }[];
  }>({ customers: [], properties: [], rooms: [], salesUsers: [] });

  const [showContractModal, setShowContractModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustForm, setNewCustForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    idCard: "",
    source: "FACEBOOK",
    status: "POTENTIAL",
    salesId: "",
    note: "",
  });
  const [selectedRoom, setSelectedRoom] = useState<RoomItem | null>(null);
  const [previewInvoiceUrl, setPreviewInvoiceUrl] = useState<string | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [editRoomForm, setEditRoomForm] = useState({
    roomNumber: "",
    floor: "1",
    area: "25",
    price: "6000000",
    amenities: "",
    status: "AVAILABLE",
  });
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editCustForm, setEditCustForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    idCard: "",
    source: "FACEBOOK",
    status: "POTENTIAL",
    note: "",
  });
  const [uploadingRoomImg, setUploadingRoomImg] = useState(false);
  const [roomForm, setRoomForm] = useState({
    propertyId: "",
    roomNumber: "",
    floor: "1",
    area: "25",
    price: "6000000",
    amenities: "Máy lạnh, tủ lạnh, wifi",
    imageUrl: "",
  });
  const [form, setForm] = useState({
    customerId: "",
    roomId: "",
    salesId: "",
    durationMonths: "12",
    monthlyRent: "6000000",
    depositAmount: "12000000",
    companyCommissionRate: "0.8",
    collectedAmount: "12000000",
  });

  async function loadData() {
    const [cRes, crmRes] = await Promise.all([fetch("/api/sales/contracts"), fetch("/api/sales/crm")]);
    if (cRes.ok) {
      const d = await cRes.json();
      setContracts(d.contracts);
    }
    if (crmRes.ok) {
      const d = await crmRes.json();
      setCrm(d);
      setForm((f) => ({
        ...f,
        customerId: f.customerId || d.customers[0]?.id || "",
        roomId: f.roomId || d.rooms.find((r: { status: string }) => r.status === "AVAILABLE")?.id || d.rooms[0]?.id || "",
        salesId: f.salesId || d.salesUsers[0]?.id || "",
      }));
      setRoomForm((rf) => ({
        ...rf,
        propertyId: rf.propertyId || d.properties?.[0]?.id || "",
      }));
      setNewCustForm((cf) => ({
        ...cf,
        salesId: cf.salesId || d.salesUsers[0]?.id || "",
      }));
    }
  }

  async function handleQuickRoomImage(roomId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch("/api/upload", { method: "POST", body: fd });
    if (up.ok) {
      const { url } = await up.json();
      await fetch("/api/sales/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "ROOM", id: roomId, imageUrl: url }),
      });
      loadData();
    }
  }

  async function handleUploadContractInvoice(contractId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInvoice(true);
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch("/api/upload", { method: "POST", body: fd });
    if (up.ok) {
      const { url } = await up.json();
      const res = await fetch("/api/sales/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPLOAD_INVOICE", contractId, invoiceUrl: url }),
      });
      if (res.ok && selectedRoom?.contracts?.[0]) {
        const updatedRoom = {
          ...selectedRoom,
          contracts: [{ ...selectedRoom.contracts[0], invoiceUrl: url }, ...selectedRoom.contracts.slice(1)],
        };
        setSelectedRoom(updatedRoom);
        loadData();
      }
    }
    setUploadingInvoice(false);
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/sales/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "ROOM", ...roomForm }),
    });
    if (res.ok) {
      setShowRoomModal(false);
      setRoomForm({ ...roomForm, roomNumber: "", imageUrl: "" });
      loadData();
    }
  }

  async function handleUpdateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom) return;
    setRoomError("");
    const res = await fetch("/api/sales/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "ROOM", id: selectedRoom.id, ...editRoomForm }),
    });
    if (res.ok) {
      setEditingRoom(false);
      setSelectedRoom(null);
      loadData();
    } else {
      const d = await res.json();
      setRoomError(d.error || "Không thể cập nhật phòng");
    }
  }

  async function handleDeleteRoom(roomId: string) {
    if (!window.confirm("Bạn chắc chắn muốn xóa phòng trọ này?")) return;
    setRoomError("");
    const res = await fetch(`/api/sales/crm?entity=ROOM&id=${roomId}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedRoom(null);
      loadData();
    } else {
      const d = await res.json();
      setRoomError(d.error || "Không thể xóa phòng");
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/sales/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "CUSTOMER", ...newCustForm }),
    });
    if (res.ok) {
      const { customer } = await res.json();
      setShowCustomerModal(false);
      setNewCustForm({ ...newCustForm, fullName: "", phone: "", email: "", idCard: "", note: "" });
      if (customer?.id) {
        setForm((f) => ({ ...f, customerId: customer.id }));
      }
      loadData();
    }
  }

  async function handleUpdateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCustomerId) return;
    const res = await fetch("/api/sales/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "CUSTOMER", id: editingCustomerId, ...editCustForm }),
    });
    if (res.ok) {
      setEditingCustomerId(null);
      setSelectedRoom(null);
      loadData();
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/sales/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowContractModal(false);
      loadData();
    }
  }

  async function handleDepositAction(depositId: string, action: "COLLECT_DEPOSIT" | "PAY_LANDLORD") {
    await fetch("/api/sales/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depositId, action }),
    });
    loadData();
  }

  // Leaderboard aggregation
  const leaderboard = crm.salesUsers
    .map((su) => {
      const myContracts = contracts.filter((c) => c.sales.id === su.id);
      const rev = myContracts.reduce((s, c) => s + c.companyRevenue, 0);
      const comm = calculateSalesCommission(rev);
      return {
        ...su,
        contractCount: myContracts.length,
        revenue: rev,
        commission: comm.commissionAmount,
        totalIncome: comm.grossIncome,
        rate: comm.rate,
        kpiPercent: su.kpiTarget > 0 ? Math.min(100, Math.round((rev / su.kpiTarget) * 100)) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const previewRate = form.durationMonths === "6" ? 0.5 : Number(form.companyCommissionRate);
  const previewCompanyRev = Math.round(Number(form.depositAmount || 0) * previewRate);
  const previewLandlord = Math.max(0, Number(form.depositAmount || 0) - previewCompanyRev);

  const totalCompanyRevenue = contracts.reduce((s, c) => s + c.companyRevenue, 0);
  const totalDepositAmount = contracts.reduce((s, c) => s + c.depositAmount, 0);
  const totalLandlordPayable = contracts.reduce((s, c) => s + c.landlordPayable, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Sales, Hợp đồng & Tiền cọc</h1>
            <p className="text-sm text-neutral-500">
              Tách biệt tiền cọc thu hộ chủ trọ và doanh thu hoa hồng công ty (6 tháng: 50%, 12 tháng: 70–100%)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCustomerModal(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tạo Khách hàng mới
            </button>
            <button
              onClick={() => setShowContractModal(true)}
              className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tạo Hợp đồng mới
            </button>
          </div>
        </div>

        {/* Thống kê tổng doanh thu Sales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-white to-emerald-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-emerald-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600 font-medium">Tổng doanh thu công ty (Hoa hồng)</div>
            <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">{formatVND(totalCompanyRevenue)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-amber-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-amber-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600 font-medium">Tổng tiền cọc hợp đồng</div>
            <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">{formatVND(totalDepositAmount)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-orange-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-orange-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600 font-medium">Tổng tiền trả chủ trọ</div>
            <div className="text-xl font-bold text-orange-700 mt-1 tabular-nums">{formatVND(totalLandlordPayable)}</div>
          </div>
          <div className="bg-gradient-to-br from-white to-sky-50/70 p-5 rounded-xl border border-neutral-200 border-l-4 border-l-sky-500 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg active:translate-y-0">
            <div className="text-xs text-neutral-600 font-medium">Tổng số hợp đồng</div>
            <div className="text-xl font-bold text-sky-700 mt-1 tabular-nums">{contracts.length} hợp đồng</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "CONTRACTS", label: "Hợp đồng & Tiền cọc", icon: <FileCheck2 className="w-4 h-4" /> },
            { id: "LEADERBOARD", label: "Bảng xếp hạng & KPI Sales", icon: <Trophy className="w-4 h-4" /> },
            { id: "ROOMS", label: "Quản lý Phòng trọ", icon: <Building className="w-4 h-4" /> },
            { id: "CUSTOMERS", label: "Khách hàng", icon: <Users className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                tab === t.id
                  ? "bg-neutral-950 text-amber-400 border border-amber-500"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "CONTRACTS" && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3">Mã HĐ / Ngày</th>
                    <th className="px-4 py-3">Khách hàng & Phòng</th>
                    <th className="px-4 py-3">Sales</th>
                    <th className="px-4 py-3 text-right">Tiền cọc</th>
                    <th className="px-4 py-3 text-right">Doanh thu CTY</th>
                    <th className="px-4 py-3 text-right">Trả chủ trọ</th>
                    <th className="px-4 py-3">Thu cọc / Trả chủ trọ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {contracts.map((c) => {
                    const dep = c.deposits[0];
                    return (
                      <tr key={c.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold text-amber-700">{c.contractCode}</div>
                          <div className="text-xs text-neutral-400">
                            {formatDate(c.signedDate)} • {c.durationMonths}T ({(c.companyCommissionRate * 100).toFixed(0)}%)
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-neutral-900">{c.customer.fullName}</div>
                          <div className="text-xs text-neutral-500">
                            {c.room.property.name} - {c.room.roomNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-neutral-700">{c.sales.fullName}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{formatVND(c.depositAmount)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">
                          {formatVND(c.companyRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-orange-600 tabular-nums">
                          {formatVND(c.landlordPayable)}
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          {dep && (
                            <div className="flex flex-wrap gap-1.5">
                              {dep.collectionStatus === "COLLECTED" ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-medium">
                                  Đã thu đủ cọc
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleDepositAction(dep.id, "COLLECT_DEPOSIT")}
                                  className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-medium cursor-pointer"
                                >
                                  Xác nhận thu cọc
                                </button>
                              )}
                              {dep.landlordPayoutStatus === "PAID" ? (
                                <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700 text-[11px] font-medium">
                                  Đã trả chủ trọ
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleDepositAction(dep.id, "PAY_LANDLORD")}
                                  className="px-2 py-0.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-800 text-[11px] font-medium cursor-pointer"
                                >
                                  Trả chủ trọ
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "LEADERBOARD" && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Hạng</th>
                  <th className="px-4 py-3">Nhân viên Sales</th>
                  <th className="px-4 py-3 text-center">Số HĐ</th>
                  <th className="px-4 py-3 text-right">Doanh số CTY</th>
                  <th className="px-4 py-3 text-center">Mức hoa hồng</th>
                  <th className="px-4 py-3 text-right">Thu nhập dự kiến</th>
                  <th className="px-4 py-3">KPI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {leaderboard.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-bold text-amber-600">#{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{s.fullName}</td>
                    <td className="px-4 py-3 text-center">{s.contractCount}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatVND(s.revenue)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
                        {(s.rate * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">
                      {formatVND(s.totalIncome)}
                    </td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${s.kpiPercent}%` }} />
                        </div>
                        <span className="text-xs font-medium text-neutral-600">{s.kpiPercent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-950 text-white font-bold border-t-2 border-amber-500">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-amber-400">
                    Tổng cộng ({leaderboard.length} nhân sự Sales)
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {leaderboard.reduce((s, x) => s + x.contractCount, 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-400">
                    {formatVND(leaderboard.reduce((s, x) => s + x.revenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-neutral-400">—</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                    {formatVND(leaderboard.reduce((s, x) => s + x.totalIncome, 0))}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    CTY giữ lại:{" "}
                    <span className="text-white">
                      {formatVND(
                        leaderboard.reduce((s, x) => s + x.revenue, 0) -
                          leaderboard.reduce((s, x) => s + x.totalIncome, 0)
                      )}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === "ROOMS" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowRoomModal(true)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm Phòng trọ
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {crm.rooms.map((r) => {
                const activeContract =
                  r.status === "RENTED" || r.status === "RESERVED" ? r.contracts?.[0] : undefined;
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRoom(r);
                      setEditingRoom(false);
                      setRoomError("");
                      setEditRoomForm({
                        roomNumber: r.roomNumber,
                        floor: String(r.floor),
                        area: String(r.area),
                        price: String(r.price),
                        amenities: r.amenities || "",
                        status: r.status,
                      });
                    }}
                    className="bg-white rounded-xl border border-neutral-200 overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-amber-400"
                  >
                    <div className="relative h-40 bg-neutral-100 flex items-center justify-center">
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt={`${r.property.name} ${r.roomNumber}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-neutral-400 text-xs gap-1">
                          <ImageIcon className="w-8 h-8" />
                          <span>Chưa có ảnh phòng</span>
                        </div>
                      )}
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-neutral-950/85 hover:bg-neutral-950 text-amber-400 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" /> {r.imageUrl ? "Đổi ảnh" : "Tải ảnh"}
                        <input type="file" accept="image/*" onChange={(e) => handleQuickRoomImage(r.id, e)} className="hidden" />
                      </label>
                      <span
                        className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.status === "AVAILABLE"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.status === "RENTED"
                            ? "bg-neutral-950 text-amber-400"
                            : r.status === "MAINTENANCE"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status === "AVAILABLE"
                          ? "Trống"
                          : r.status === "RENTED"
                          ? "Đã thuê"
                          : r.status === "MAINTENANCE"
                          ? "Bảo trì"
                          : "Đặt cọc"}
                      </span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="font-semibold text-neutral-900">
                          {r.property.name} — {r.roomNumber}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {r.property.district} • Tầng {r.floor} • {r.area}m²
                        </div>
                        {activeContract && (
                          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-neutral-800">
                            {r.status === "RESERVED" ? "Đặt cọc:" : "Người thuê:"}{" "}
                            <strong>{activeContract.customer.fullName}</strong> ({activeContract.customer.phone})
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100">
                        <div className="text-sm font-bold text-amber-600">{formatVND(r.price)}/tháng</div>
                        <span className="text-[11px] font-medium text-neutral-500">Bấm xem chi tiết →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "CUSTOMERS" && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">SĐT</th>
                  <th className="px-4 py-3">Nguồn</th>
                  <th className="px-4 py-3">Sales phụ trách</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {crm.customers.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{c.fullName}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.phone}</td>
                    <td className="px-4 py-3 text-xs">{c.source}</td>
                    <td className="px-4 py-3 text-xs">{c.sales?.fullName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.status === "SIGNED"
                            ? "bg-emerald-100 text-emerald-700"
                            : c.status === "LOST"
                            ? "bg-rose-100 text-rose-700"
                            : c.status === "POTENTIAL"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {getStatusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditingCustomerId(c.id);
                          setEditCustForm({
                            fullName: c.fullName,
                            phone: c.phone,
                            email: c.email || "",
                            idCard: c.idCard || "",
                            source: c.source,
                            status: c.status,
                            note: c.note || "",
                          });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 hover:bg-amber-100 text-neutral-800 text-xs cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" /> Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showContractModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-neutral-900">Tạo Hợp đồng thuê phòng mới</h3>
              <form onSubmit={handleCreateContract} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Khách hàng</label>
                    <select
                      value={form.customerId}
                      onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {crm.customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Phòng trọ</label>
                    <select
                      value={form.roomId}
                      onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {crm.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.property.name} - {r.roomNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Nhân viên Sales</label>
                    <select
                      value={form.salesId}
                      onChange={(e) => setForm({ ...form, salesId: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {crm.salesUsers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Thời hạn hợp đồng</label>
                    <select
                      value={form.durationMonths}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          durationMonths: e.target.value,
                          companyCommissionRate: e.target.value === "6" ? "0.5" : "0.8",
                        })
                      }
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="6">6 tháng (50% tiền cọc)</option>
                      <option value="12">12 tháng (70–100% tiền cọc)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Tiền cọc (VNĐ)</label>
                    <input
                      type="number"
                      required
                      value={form.depositAmount}
                      onChange={(e) => setForm({ ...form, depositAmount: e.target.value, collectedAmount: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Tỷ lệ CTY (0.5 - 1)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.5"
                      max="1"
                      disabled={form.durationMonths === "6"}
                      value={form.durationMonths === "6" ? "0.5" : form.companyCommissionRate}
                      onChange={(e) => setForm({ ...form, companyCommissionRate: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Đã thu cọc</label>
                    <input
                      type="number"
                      value={form.collectedAmount}
                      onChange={(e) => setForm({ ...form, collectedAmount: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs flex justify-between">
                  <span>
                    Doanh thu CTY: <strong className="text-emerald-700">{formatVND(previewCompanyRev)}</strong>
                  </span>
                  <span>
                    Phải trả chủ trọ: <strong className="text-orange-700">{formatVND(previewLandlord)}</strong>
                  </span>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowContractModal(false)}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-sm cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm font-medium cursor-pointer"
                  >
                    Lưu hợp đồng
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showRoomModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-neutral-900">Thêm Phòng trọ mới</h3>
              <form onSubmit={handleCreateRoom} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Tòa nhà / Khu trọ</label>
                  <select
                    value={roomForm.propertyId}
                    onChange={(e) => setRoomForm({ ...roomForm, propertyId: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {crm.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.district})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    required
                    placeholder="Số phòng (VD: P305)"
                    value={roomForm.roomNumber}
                    onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Tầng"
                    value={roomForm.floor}
                    onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Diện tích (m²)"
                    value={roomForm.area}
                    onChange={(e) => setRoomForm({ ...roomForm, area: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <input
                  type="number"
                  required
                  placeholder="Giá thuê / tháng (VNĐ)"
                  value={roomForm.price}
                  onChange={(e) => setRoomForm({ ...roomForm, price: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  placeholder="Tiện ích (Máy lạnh, tủ lạnh...)"
                  value={roomForm.amenities}
                  onChange={(e) => setRoomForm({ ...roomForm, amenities: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 text-amber-400 text-xs font-medium cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingRoomImg ? "Đang tải..." : "Tải ảnh phòng"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingRoomImg(true);
                        const fd = new FormData();
                        fd.append("file", file);
                        const up = await fetch("/api/upload", { method: "POST", body: fd });
                        if (up.ok) {
                          const { url } = await up.json();
                          setRoomForm((rf) => ({ ...rf, imageUrl: url }));
                        }
                        setUploadingRoomImg(false);
                      }}
                      className="hidden"
                    />
                  </label>
                  {roomForm.imageUrl && (
                    <img src={roomForm.imageUrl} alt="Phòng" className="w-12 h-12 rounded object-cover border border-amber-400" />
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowRoomModal(false)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    Lưu phòng
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Chi tiết Phòng trọ, Người thuê & Hợp đồng thuê nhà */}
        {selectedRoom && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedRoom(null)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-neutral-950">
                      {selectedRoom.property.name} — {selectedRoom.roomNumber}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedRoom.status === "AVAILABLE"
                          ? "bg-emerald-100 text-emerald-700"
                          : selectedRoom.status === "RENTED"
                          ? "bg-neutral-950 text-amber-400"
                          : selectedRoom.status === "MAINTENANCE"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selectedRoom.status === "AVAILABLE"
                        ? "Đang trống"
                        : selectedRoom.status === "RENTED"
                        ? "Đang thuê"
                        : selectedRoom.status === "MAINTENANCE"
                        ? "Bảo trì"
                        : "Đặt cọc"}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {selectedRoom.property.address ? `${selectedRoom.property.address}, ` : ""}
                    {selectedRoom.property.district} • Tầng {selectedRoom.floor} • {selectedRoom.area}m²
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingRoom((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> {editingRoom ? "Đóng sửa" : "Sửa phòng"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRoom(selectedRoom.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                  <button onClick={() => setSelectedRoom(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {roomError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{roomError}</div>
              )}

              {editingRoom && (
                <form onSubmit={handleUpdateRoom} className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 space-y-3">
                  <div className="font-bold text-xs text-neutral-900">Chỉnh sửa thông tin & trạng thái phòng</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-0.5">Số phòng</label>
                      <input
                        required
                        value={editRoomForm.roomNumber}
                        onChange={(e) => setEditRoomForm({ ...editRoomForm, roomNumber: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-0.5">Trạng thái</label>
                      <select
                        value={editRoomForm.status}
                        onChange={(e) => setEditRoomForm({ ...editRoomForm, status: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      >
                        <option value="AVAILABLE">Trống (trả phòng)</option>
                        <option value="RESERVED">Đặt cọc</option>
                        <option value="RENTED">Đã thuê</option>
                        <option value="MAINTENANCE">Bảo trì</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-0.5">Tầng</label>
                      <input
                        type="number"
                        value={editRoomForm.floor}
                        onChange={(e) => setEditRoomForm({ ...editRoomForm, floor: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-0.5">Diện tích (m²)</label>
                      <input
                        type="number"
                        value={editRoomForm.area}
                        onChange={(e) => setEditRoomForm({ ...editRoomForm, area: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-0.5">Giá thuê / tháng (VNĐ)</label>
                      <input
                        type="number"
                        required
                        value={editRoomForm.price}
                        onChange={(e) => setEditRoomForm({ ...editRoomForm, price: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-0.5">Tiện ích</label>
                      <input
                        value={editRoomForm.amenities}
                        onChange={(e) => setEditRoomForm({ ...editRoomForm, amenities: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingRoom(false)} className="px-3 py-1.5 rounded-lg border text-xs bg-white cursor-pointer">
                      Hủy
                    </button>
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-xs font-bold cursor-pointer">
                      Lưu thay đổi
                    </button>
                  </div>
                </form>
              )}

              {selectedRoom.imageUrl && (
                <img
                  src={selectedRoom.imageUrl}
                  alt={selectedRoom.roomNumber}
                  className="w-full h-52 object-cover rounded-xl border border-neutral-200"
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div>
                  <span className="text-neutral-500">Giá thuê:</span>{" "}
                  <strong className="text-amber-700 text-sm">{formatVND(selectedRoom.price)}/tháng</strong>
                </div>
                <div>
                  <span className="text-neutral-500">Tiện ích:</span>{" "}
                  <span className="text-neutral-800">{selectedRoom.amenities || "Đầy đủ cơ bản"}</span>
                </div>
                {selectedRoom.property.landlordName && (
                  <div>
                    <span className="text-neutral-500">Chủ trọ:</span>{" "}
                    <strong className="text-neutral-900">{selectedRoom.property.landlordName}</strong>
                  </div>
                )}
                {selectedRoom.property.landlordPhone && (
                  <div>
                    <span className="text-neutral-500">SĐT Chủ trọ:</span>{" "}
                    <strong className="text-neutral-900">{selectedRoom.property.landlordPhone}</strong>
                  </div>
                )}
              </div>

              {(selectedRoom.status === "RENTED" || selectedRoom.status === "RESERVED") && selectedRoom.contracts?.[0] ? (
                (() => {
                  const ct = selectedRoom.contracts[0];
                  const dep = ct.deposits?.[0];
                  return (
                    <div className="space-y-4">
                      {/* Thông tin người thuê / người đặt cọc */}
                      <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-sm text-neutral-950">
                            <User className="w-4 h-4 text-amber-600" />{" "}
                            {selectedRoom.status === "RESERVED" ? "Thông tin Người đặt cọc" : "Thông tin Người đang thuê"}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomerId(ct.customer.id);
                              setEditCustForm({
                                fullName: ct.customer.fullName,
                                phone: ct.customer.phone,
                                email: ct.customer.email || "",
                                idCard: ct.customer.idCard || "",
                                source: ct.customer.source,
                                status: ct.customer.status || "SIGNED",
                                note: ct.customer.note || "",
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-amber-100 border border-amber-300 text-[11px] font-medium text-neutral-800 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" /> Sửa thông tin khách
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-neutral-500">Họ và tên:</span>{" "}
                            <strong className="text-neutral-900">{ct.customer.fullName}</strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-neutral-500" />
                            <span className="text-neutral-500">SĐT:</span>{" "}
                            <strong className="text-neutral-900">{ct.customer.phone}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500">CCCD / CMND:</span>{" "}
                            <strong className="text-neutral-900">{ct.customer.idCard || "Chưa cập nhật"}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500">Email:</span>{" "}
                            <span className="text-neutral-800">{ct.customer.email || "—"}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Nguồn khách:</span>{" "}
                            <span className="text-neutral-800">{ct.customer.source}</span>
                          </div>
                          {ct.customer.note && (
                            <div className="sm:col-span-2">
                              <span className="text-neutral-500">Ghi chú:</span>{" "}
                              <span className="text-neutral-800">{ct.customer.note}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Thông tin hợp đồng thuê nhà */}
                      <div className="p-4 rounded-xl border border-neutral-200 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-sm text-neutral-950">
                            <FileText className="w-4 h-4 text-emerald-600" /> Hợp đồng thuê nhà — {ct.contractCode}
                          </div>
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            {ct.durationMonths} tháng ({(ct.companyCommissionRate * 100).toFixed(0)}% HH)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                            <span className="text-neutral-500">Thời hạn:</span>{" "}
                            <strong>{formatDate(ct.startDate)} → {formatDate(ct.endDate)}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500">Ngày ký:</span> <strong>{formatDate(ct.signedDate)}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500">Tổng tiền cọc:</span>{" "}
                            <strong className="text-neutral-900">{formatVND(ct.depositAmount)}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500">Sales phụ trách:</span>{" "}
                            <strong className="text-neutral-900">{ct.sales.fullName}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500">Hoa hồng công ty:</span>{" "}
                            <strong className="text-emerald-700">{formatVND(ct.companyRevenue)}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500">Trả chủ trọ:</span>{" "}
                            <strong className="text-orange-700">{formatVND(ct.landlordPayable)}</strong>
                          </div>
                          {dep && (
                            <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Đã thu cọc: <strong>{formatVND(dep.collectedAmount)}</strong> / {formatVND(dep.totalDeposit)}
                              </span>
                              {dep.remainingAmount > 0 && (
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  Còn thiếu: <strong>{formatVND(dep.remainingAmount)}</strong>
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                                Chủ trọ: {dep.landlordPayoutStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ảnh hóa đơn / chứng từ minh chứng thuê phòng */}
                      <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold text-xs text-neutral-900">
                            <ImageIcon className="w-4 h-4 text-amber-600" /> Ảnh hóa đơn / Chứng từ minh chứng
                          </div>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-xs font-medium cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />
                            {uploadingInvoice ? "Đang tải..." : ct.invoiceUrl ? "Đổi ảnh hóa đơn" : "Tải ảnh hóa đơn"}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleUploadContractInvoice(ct.id, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                        {ct.invoiceUrl ? (
                          <div className="flex items-center gap-3">
                            <img
                              src={ct.invoiceUrl}
                              alt="Hóa đơn minh chứng"
                              onClick={() => setPreviewInvoiceUrl(ct.invoiceUrl || null)}
                              className="w-28 h-20 object-cover rounded-lg border border-amber-400 cursor-pointer hover:opacity-90"
                              title="Bấm để phóng to"
                            />
                            <button
                              type="button"
                              onClick={() => setPreviewInvoiceUrl(ct.invoiceUrl || null)}
                              className="text-xs font-medium text-amber-700 hover:underline cursor-pointer"
                            >
                              Bấm vào ảnh để xem phóng to →
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-neutral-500">
                            Chưa có ảnh chụp hóa đơn / biên lai chuyển khoản cho hợp đồng này.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : selectedRoom.status === "MAINTENANCE" ? (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 text-xs text-rose-800">
                  Phòng này hiện đang trong trạng thái <strong>Bảo trì / Sửa chữa</strong> — Tạm ngưng nhận khách và tạo hợp đồng mới. Sau khi sửa xong, hãy bấm <strong>Sửa phòng</strong> để chuyển về trạng thái <strong>Trống</strong>.
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-emerald-900">
                    {selectedRoom.status === "AVAILABLE"
                      ? "Phòng này hiện đang trống và chưa có hợp đồng thuê hiệu lực."
                      : "Phòng này chưa có thông tin hợp đồng / đặt cọc liên kết."}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        roomId: selectedRoom.id,
                        monthlyRent: String(selectedRoom.price),
                      }));
                      setSelectedRoom(null);
                      setShowContractModal(true);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-xs font-bold cursor-pointer"
                  >
                    + Tạo hợp đồng / đặt cọc cho phòng này
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Tạo Khách hàng mới */}
        {showCustomerModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-neutral-900">Tạo Khách hàng mới</h3>
              <form onSubmit={handleCreateCustomer} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Họ và tên</label>
                    <input
                      required
                      value={newCustForm.fullName}
                      onChange={(e) => setNewCustForm({ ...newCustForm, fullName: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="VD: Nguyễn Văn A"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Số điện thoại</label>
                    <input
                      required
                      value={newCustForm.phone}
                      onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="09..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">CCCD / CMND</label>
                    <input
                      value={newCustForm.idCard}
                      onChange={(e) => setNewCustForm({ ...newCustForm, idCard: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={newCustForm.email}
                      onChange={(e) => setNewCustForm({ ...newCustForm, email: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Nguồn khách</label>
                    <select
                      value={newCustForm.source}
                      onChange={(e) => setNewCustForm({ ...newCustForm, source: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="FACEBOOK">Facebook</option>
                      <option value="TIKTOK">TikTok</option>
                      <option value="ZALO">Zalo</option>
                      <option value="REFERRAL">Giới thiệu</option>
                      <option value="WALK_IN">Vãng lai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Sales phụ trách</label>
                    <select
                      value={newCustForm.salesId}
                      onChange={(e) => setNewCustForm({ ...newCustForm, salesId: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {crm.salesUsers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Ghi chú</label>
                  <textarea
                    value={newCustForm.note}
                    onChange={(e) => setNewCustForm({ ...newCustForm, note: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Nhu cầu phòng, khu vực quan tâm..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCustomerModal(false)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    Tạo khách hàng
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Chỉnh sửa thông tin khách hàng / người thuê */}
        {editingCustomerId && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-neutral-900">Chỉnh sửa thông tin Khách hàng / Người thuê</h3>
              <form onSubmit={handleUpdateCustomer} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Họ và tên</label>
                    <input
                      required
                      value={editCustForm.fullName}
                      onChange={(e) => setEditCustForm({ ...editCustForm, fullName: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Số điện thoại</label>
                    <input
                      required
                      value={editCustForm.phone}
                      onChange={(e) => setEditCustForm({ ...editCustForm, phone: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">CCCD / CMND</label>
                    <input
                      value={editCustForm.idCard}
                      onChange={(e) => setEditCustForm({ ...editCustForm, idCard: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Nhập số CCCD"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={editCustForm.email}
                      onChange={(e) => setEditCustForm({ ...editCustForm, email: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Nguồn khách</label>
                    <select
                      value={editCustForm.source}
                      onChange={(e) => setEditCustForm({ ...editCustForm, source: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="FACEBOOK">Facebook</option>
                      <option value="TIKTOK">TikTok</option>
                      <option value="ZALO">Zalo</option>
                      <option value="REFERRAL">Giới thiệu</option>
                      <option value="WALK_IN">Vãng lai</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Trạng thái</label>
                    <select
                      value={editCustForm.status}
                      onChange={(e) => setEditCustForm({ ...editCustForm, status: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="POTENTIAL">Tiềm năng</option>
                      <option value="VIEWING">Đang xem phòng</option>
                      <option value="DEPOSITED">Đã đặt cọc</option>
                      <option value="SIGNED">Đã ký HĐ</option>
                      <option value="LOST">Đã hủy</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Ghi chú</label>
                  <textarea
                    value={editCustForm.note}
                    onChange={(e) => setEditCustForm({ ...editCustForm, note: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditingCustomerId(null)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm cursor-pointer">
                    Lưu thông tin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Lightbox xem ảnh hóa đơn phóng to */}
        {previewInvoiceUrl && (
          <div className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4" onClick={() => setPreviewInvoiceUrl(null)}>
            <div className="bg-white rounded-2xl max-w-xl w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-neutral-900">Ảnh hóa đơn / Chứng từ minh chứng</div>
                <button onClick={() => setPreviewInvoiceUrl(null)} className="p-1 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img src={previewInvoiceUrl} alt="Hóa đơn" className="w-full max-h-[75vh] object-contain rounded-lg border border-neutral-200" />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
