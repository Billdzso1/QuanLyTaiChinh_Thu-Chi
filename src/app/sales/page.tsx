"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { formatVND, formatDate, calculateSalesCommission } from "@/lib/finance";
import { getStatusLabel, SOURCE_LABELS } from "@/lib/labels";
import { buildDepositReceiptHtml, printDepositReceiptPdf, DepositReceiptData } from "@/lib/depositReceiptPrint";
import { AttachmentPreviewModal, isImageUrl } from "@/components/AttachmentPreviewModal";
import { RoomStatusFilterSelect } from "@/components/RoomStatusFilterSelect";
import { PaymentVerificationFields, PaymentMethodType } from "@/components/PaymentVerificationFields";
import { Plus, Trophy, Building, Users, FileCheck2, Upload, Image as ImageIcon, X, User, Phone, Calendar, FileText, Pencil, Trash2, MapPin, ExternalLink, Search, CheckCircle2, Sparkles, CalendarPlus, Clock, Printer, MessageCircle } from "lucide-react";

const ROOM_AMENITY_OPTIONS = [
  "Full nội thất",
  "Máy lạnh",
  "Ban công",
  "Thang máy",
  "Khóa vân tay",
  "Gác lửng",
  "Kệ bếp",
  "Tủ lạnh",
  "Máy giặt riêng",
  "Cửa sổ lớn",
  "Hầm giữ xe",
  "WiFi tốc độ cao",
  "Nuôi pet nhỏ",
];

function toggleAmenityValue(current: string, item: string): string {
  const list = current
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const exists = list.some((s) => s.toLowerCase() === item.toLowerCase());
  const next = exists
    ? list.filter((s) => s.toLowerCase() !== item.toLowerCase())
    : [...list, item];
  return next.join(", ");
}

function hasAmenityValue(current: string, item: string): boolean {
  return current
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(item.toLowerCase());
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  PHONG_TRO: "Phòng trọ",
  PHONG_THUONG: "Thuê phòng thường",
  CHUNG_CU: "Chung cư / CHDV",
  STUDIO: "Studio / Duplex",
  NHA_NGUYEN_CAN: "Nhà nguyên căn",
};

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
  status?: string;
  note?: string | null;
  invoiceUrl?: string | null;
  customer: { fullName: string; phone: string; idCard?: string | null };
  room: { roomNumber: string; property: { name: string; address?: string; district?: string } };
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
  const [salesStats, setSalesStats] = useState<Record<string, { contractCount: number; revenue: number }>>({});
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
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
    roomType?: string;
    floor: number;
    area: number;
    price: number;
    status: string;
    amenities?: string | null;
    imageUrl?: string | null;
    property: { id?: string; name: string; address?: string; district: string; landlordName?: string; landlordPhone?: string };
    contracts?: RoomContractInfo[];
  }

  interface RoomViewingItem {
    id: string;
    code: string;
    roomId: string;
    roomLabel: string;
    propertyName?: string;
    roomNumber?: string;
    roomImage?: string | null;
    address?: string;
    district: string;
    price: number;
    customerId: string;
    customerName: string;
    customerPhone: string;
    salesId: string;
    salesName: string;
    onlineSalesId?: string;
    onlineSalesName?: string;
    hybridMode?: string;
    reminderMinutes?: number;
    viewingAt: string;
    note?: string;
    status: "SCHEDULED" | "VIEWED" | "CONTRACTED" | "CANCELLED";
  }

  const [crm, setCrm] = useState<{
    customers: { id: string; fullName: string; phone: string; email?: string | null; idCard?: string | null; source: string; status: string; note?: string | null; sales: { fullName: string } }[];
    properties: { id: string; name: string; district: string; address?: string; landlordName?: string; landlordPhone?: string }[];
    rooms: RoomItem[];
    salesUsers: { id: string; fullName: string; kpiTarget: number }[];
    viewings?: RoomViewingItem[];
  }>({ customers: [], properties: [], rooms: [], salesUsers: [], viewings: [] });

  const [showContractModal, setShowContractModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [depositModalViewing, setDepositModalViewing] = useState<RoomViewingItem | null>(null);
  const [depositForm, setDepositForm] = useState({
    depositAmount: "",
    durationMonths: "12",
    moveInDate: "",
    note: "",
    customerIdCard: "",
    paymentMethod: "TRANSFER" as PaymentMethodType,
    transferAmount: "",
    cashAmount: "",
    evidenceUrl: "",
  });
  const [signRentContract, setSignRentContract] = useState<Contract | null>(null);
  const [signRentForm, setSignRentForm] = useState({
    customerIdCard: "",
    paymentMethod: "TRANSFER" as PaymentMethodType,
    transferAmount: "",
    cashAmount: "",
    evidenceUrl: "",
    note: "",
  });
  const [cancelDepositContract, setCancelDepositContract] = useState<Contract | null>(null);
  const [cancelDepositForm, setCancelDepositForm] = useState({
    holdDays: "7",
    collectedDeposit: "",
    note: "",
  });
  const [receiptModalData, setReceiptModalData] = useState<DepositReceiptData | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [viewingForm, setViewingForm] = useState({
    propertyId: "",
    roomId: "",
    customerMode: "NEW" as "EXISTING" | "NEW",
    customerId: "__NEW__",
    customerName: "",
    customerPhone: "",
    salesId: "SELF",
    hybridMode: "SELF_100" as "SELF_100" | "POOL_40_60" | "TEAM_40_60",
    reminderMinutes: 30,
    viewingAt: "",
    note: "",
  });
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
    roomType: "PHONG_TRO",
    floor: "1",
    area: "25",
    price: "6000000",
    amenities: "",
    status: "AVAILABLE",
  });
  const [roomSearch, setRoomSearch] = useState("");
  const [roomDistrict, setRoomDistrict] = useState("ALL");
  const [roomPropertyFilter, setRoomPropertyFilter] = useState("ALL");
  const [roomPriceRange, setRoomPriceRange] = useState("ALL");
  const [roomTypeFilter, setRoomTypeFilter] = useState("ALL");
  const [roomStatusFilter, setRoomStatusFilter] = useState("ALL");
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    district: "Bình Thạnh",
    address: "",
    landlordName: "",
    landlordPhone: "",
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
    propertyName: "",
    district: "",
    address: "",
    roomNumber: "",
    roomType: "PHONG_TRO",
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
    const [cRes, crmRes, meRes] = await Promise.all([
      fetch("/api/sales/contracts"),
      fetch("/api/sales/crm"),
      fetch("/api/auth/me"),
    ]);
    if (meRes.ok) {
      const meData = await meRes.json();
      setCurrentUserRole(meData.user?.role || "");
    }
    if (cRes.ok) {
      const d = await cRes.json();
      setContracts(d.contracts || []);
      setSalesStats(d.salesStats || {});
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
        district: rf.district || d.properties?.[0]?.district || "",
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

  async function handleCreateProperty(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/sales/crm", {
      method: editingPropertyId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingPropertyId
          ? { entity: "PROPERTY", id: editingPropertyId, ...propertyForm }
          : { entity: "PROPERTY", ...propertyForm }
      ),
    });
    if (res.ok) {
      const saved = await res.json();
      setShowPropertyModal(false);
      setEditingPropertyId(null);
      setRoomDistrict(propertyForm.district);
      if (saved.property?.id) {
        setRoomPropertyFilter(saved.property.id);
      }
      setPropertyForm({ name: "", district: propertyForm.district, address: "", landlordName: "", landlordPhone: "" });
      loadData();
    }
  }

  async function handleDeleteProperty(propId: string, propName: string) {
    if (!window.confirm(`Xóa khu vực "${propName}"?`)) return;
    const res = await fetch(`/api/sales/crm?entity=PROPERTY&id=${propId}`, { method: "DELETE" });
    if (res.ok) {
      setRoomPropertyFilter("ALL");
      loadData();
    } else {
      const d = await res.json().catch(() => ({}));
      window.alert(d.error || "Không thể xóa khu vực này");
    }
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

  async function handleCreateViewing(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/sales/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "VIEWING",
        ...viewingForm,
        customerId: viewingForm.customerMode === "NEW" ? "__NEW__" : viewingForm.customerId,
        salesId: viewingForm.salesId === "SELF" || viewingForm.salesId === "POOL" ? undefined : viewingForm.salesId,
      }),
    });
    if (res.ok) {
      setShowViewingModal(false);
      setViewingForm((vf) => ({ ...vf, customerName: "", customerPhone: "", note: "" }));
      loadData();
    }
  }

  async function handleUpdateViewingStatus(id: string, status: string) {
    await fetch("/api/sales/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "VIEWING", id, status }),
    });
    loadData();
  }

  async function handleConfirmDepositFromViewing(e: React.FormEvent) {
    e.preventDefault();
    if (!depositModalViewing) return;
    const v = depositModalViewing;
    const depAmount = Number(depositForm.depositAmount) || v.price;
    const durMonths = Number(depositForm.durationMonths) === 6 ? 6 : 12;
    const rate = durMonths === 6 ? 0.5 : 0.8;

    const res = await fetch("/api/sales/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: v.customerId,
        roomId: v.roomId,
        salesId: v.salesId,
        onlineSalesId: v.onlineSalesId,
        hybridMode: v.hybridMode,
        durationMonths: durMonths,
        monthlyRent: v.price,
        depositAmount: depAmount,
        companyCommissionRate: rate,
        collectedAmount: depAmount,
        isDepositOnly: true,
        signedDate: depositForm.moveInDate || undefined,
        note: depositForm.note,
        customerIdCard: depositForm.customerIdCard,
        paymentMethod: depositForm.paymentMethod,
        transferAmount: depositForm.transferAmount,
        cashAmount: depositForm.cashAmount,
        evidenceUrl: depositForm.evidenceUrl,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      await handleUpdateViewingStatus(v.id, "CONTRACTED");
      setDepositModalViewing(null);
      setReceiptModalData({
        contractCode: created.contract?.contractCode || v.code,
        customerName: v.customerName,
        customerPhone: v.customerPhone,
        customerIdCard: depositForm.customerIdCard || undefined,
        roomLabel: v.roomLabel,
        address: [v.address, v.district].filter(Boolean).join(", "),
        monthlyRent: v.price,
        depositAmount: depAmount,
        collectedAmount: depAmount,
        durationMonths: durMonths,
        moveInDate: depositForm.moveInDate || new Date().toISOString(),
        salesName: v.salesName,
        paymentMethodLabel:
          depositForm.paymentMethod === "TRANSFER"
            ? "Chuyển khoản"
            : depositForm.paymentMethod === "CASH"
              ? "Tiền mặt"
              : `Chuyển khoản (${formatVND(Number(depositForm.transferAmount || 0))}) + Tiền mặt (${formatVND(Number(depositForm.cashAmount || 0))})`,
        evidenceUrl: depositForm.evidenceUrl || undefined,
        note: depositForm.note,
      });
      await loadData();
    }
  }

  function openViewingModalForRoom(roomId?: string) {
    const targetRoom =
      (roomId ? crm.rooms.find((r) => r.id === roomId) : undefined) ||
      crm.rooms.find((r) => r.status === "AVAILABLE") ||
      crm.rooms[0];
    const matchedProp = targetRoom
      ? crm.properties.find((p) => p.name === targetRoom.property.name && p.district === targetRoom.property.district) ||
        crm.properties[0]
      : crm.properties[0];

    const now = new Date();
    now.setHours(now.getHours() + 2, 0, 0, 0);
    const localDt = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setViewingForm({
      propertyId: matchedProp?.id || "",
      roomId: targetRoom?.id || "",
      customerMode: "NEW",
      customerId: crm.customers[0]?.id || "__NEW__",
      customerName: "",
      customerPhone: "",
      salesId: "SELF",
      hybridMode: "SELF_100",
      reminderMinutes: 30,
      viewingAt: localDt,
      note: "",
    });
    setShowViewingModal(true);
  }

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

  function openSignRentModal(c: Contract) {
    setSignRentForm({
      customerIdCard: c.customer.idCard || "",
      paymentMethod: "TRANSFER",
      transferAmount: String(c.depositAmount || ""),
      cashAmount: "",
      evidenceUrl: c.invoiceUrl || "",
      note: "",
    });
    setSignRentContract(c);
  }

  async function handleConfirmSignAndRent(e: React.FormEvent) {
    e.preventDefault();
    if (!signRentContract) return;
    const dep = signRentContract.deposits[0];
    if (!dep) return;
    await fetch("/api/sales/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        depositId: dep.id,
        action: "SIGN_AND_RENT",
        customerIdCard: signRentForm.customerIdCard,
        paymentMethod: signRentForm.paymentMethod,
        transferAmount: signRentForm.transferAmount,
        cashAmount: signRentForm.cashAmount,
        evidenceUrl: signRentForm.evidenceUrl,
        note: signRentForm.note,
      }),
    });
    setSignRentContract(null);
    setSelectedContract(null);
    loadData();
  }

  function openCancelDepositModal(c: Contract) {
    const dep = c.deposits[0];
    const collected = dep && dep.collectedAmount > 0 ? dep.collectedAmount : c.depositAmount;
    setCancelDepositForm({
      holdDays: "7",
      collectedDeposit: String(collected),
      note: "",
    });
    setCancelDepositContract(c);
  }

  async function handleConfirmCancelDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelDepositContract) return;
    const dep = cancelDepositContract.deposits[0];
    if (!dep) return;
    await fetch("/api/sales/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        depositId: dep.id,
        action: "CANCEL_DEPOSIT",
        holdDays: Number(cancelDepositForm.holdDays || 0),
        collectedDeposit: Number(cancelDepositForm.collectedDeposit || 0),
        note: cancelDepositForm.note,
      }),
    });
    setCancelDepositContract(null);
    setSelectedContract(null);
    loadData();
  }

  async function handleDepositAction(depositId: string, action: "COLLECT_DEPOSIT" | "PAY_LANDLORD" | "SIGN_AND_RENT") {
    await fetch("/api/sales/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depositId, action }),
    });
    setSelectedContract(null);
    loadData();
  }

  // Leaderboard aggregation (hiển thị đầy đủ doanh số toàn phòng Sales)
  const leaderboard = crm.salesUsers
    .map((su) => {
      const stat = salesStats[su.id];
      const myContracts = contracts.filter(
        (c) => c.sales.id === su.id && (c.status === "ACTIVE" || c.status === "FORFEITED")
      );
      const contractCount = stat ? stat.contractCount : myContracts.length;
      const rev = stat ? stat.revenue : myContracts.reduce((s, c) => s + c.companyRevenue, 0);
      const comm = calculateSalesCommission(rev);
      const target = su.kpiTarget > 0 ? su.kpiTarget : 15_000_000;
      return {
        ...su,
        contractCount,
        revenue: rev,
        commission: comm.commissionAmount,
        totalIncome: comm.grossIncome,
        rate: comm.rate,
        kpiPercent: Math.min(100, Math.round((rev / target) * 100)),
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
                    <th className="px-4 py-3">Thu cọc / Trạng thái</th>
                    <th className="px-4 py-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {contracts.map((c) => {
                    const dep = c.deposits[0];
                    const isReserved = c.status === "RESERVED";
                    const isForfeited = c.status === "FORFEITED";
                    return (
                      <tr key={c.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-amber-700">{c.contractCode}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                isForfeited
                                  ? "bg-rose-100 text-rose-700"
                                  : isReserved
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {isForfeited ? "Hủy cọc" : isReserved ? "Đã đặt cọc" : "Đã thuê / Ký HĐ"}
                            </span>
                          </div>
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
                              {isForfeited ? (
                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[11px] font-medium">
                                  Đã hủy cọc &amp; chia 50/50
                                </span>
                              ) : isReserved ? (
                                <>
                                  <button
                                    onClick={() => openSignRentModal(c)}
                                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Thanh toán đủ &amp; Ký HĐ
                                  </button>
                                  <button
                                    onClick={() => openCancelDepositModal(c)}
                                    className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Hủy cọc
                                  </button>
                                </>
                              ) : dep.collectionStatus === "COLLECTED" ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-medium">
                                  Đã thu đủ &amp; Ký HĐ
                                </span>
                              ) : (
                                <button
                                  onClick={() => openSignRentModal(c)}
                                  className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-medium cursor-pointer"
                                >
                                  Thanh toán đủ &amp; Ký HĐ
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
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedContract(c)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-xs font-medium cursor-pointer"
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "LEADERBOARD" && (() => {
          const canViewCommissionPayroll = currentUserRole === "ADMIN" || currentUserRole === "ACCOUNTANT";
          return (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3">Hạng</th>
                  <th className="px-4 py-3">Nhân viên Sales</th>
                  <th className="px-4 py-3 text-center">Số HĐ</th>
                  <th className="px-4 py-3 text-right">Doanh số CTY</th>
                  {canViewCommissionPayroll && <th className="px-4 py-3 text-center">Mức hoa hồng</th>}
                  {canViewCommissionPayroll && <th className="px-4 py-3 text-right">Thu nhập dự kiến</th>}
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
                    {canViewCommissionPayroll && (
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
                          {(s.rate * 100).toFixed(0)}%
                        </span>
                      </td>
                    )}
                    {canViewCommissionPayroll && (
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">
                        {formatVND(s.totalIncome)}
                      </td>
                    )}
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
                  {canViewCommissionPayroll && (
                    <td className="px-4 py-3 text-center text-xs text-neutral-400">—</td>
                  )}
                  {canViewCommissionPayroll && (
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400">
                      {formatVND(leaderboard.reduce((s, x) => s + x.totalIncome, 0))}
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs text-neutral-400">
                    {canViewCommissionPayroll ? (
                      <>
                        CTY giữ lại:{" "}
                        <span className="text-white">
                          {formatVND(
                            leaderboard.reduce((s, x) => s + x.revenue, 0) -
                              leaderboard.reduce((s, x) => s + x.totalIncome, 0)
                          )}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          );
        })()}

        {tab === "ROOMS" && (
          <div className="space-y-4">
            {(() => {
              const uniqueDistricts = Array.from(
                new Set([
                  ...crm.properties.map((p) => p.district).filter(Boolean),
                  ...crm.rooms.map((r) => r.property.district).filter(Boolean),
                ])
              ).sort();
              const districtProperties =
                roomDistrict === "ALL"
                  ? crm.properties
                  : crm.properties.filter((p) => p.district === roomDistrict);
              const hasActiveFilter =
                roomSearch.trim() !== "" ||
                roomDistrict !== "ALL" ||
                roomPropertyFilter !== "ALL" ||
                roomPriceRange !== "ALL" ||
                roomTypeFilter !== "ALL" ||
                roomStatusFilter !== "ALL";
              const filteredRooms = crm.rooms.filter((r) => {
                if (roomDistrict !== "ALL" && r.property.district !== roomDistrict) return false;
                if (roomPropertyFilter !== "ALL" && r.property.id !== roomPropertyFilter) return false;
                if (roomStatusFilter !== "ALL" && r.status !== roomStatusFilter) return false;
                const rType = r.roomType || "PHONG_TRO";
                if (roomTypeFilter !== "ALL" && rType !== roomTypeFilter) return false;
                if (roomPriceRange === "UNDER_3M" && r.price >= 3_000_000) return false;
                if (roomPriceRange === "3M_5M" && (r.price < 3_000_000 || r.price > 5_000_000)) return false;
                if (roomPriceRange === "5M_8M" && (r.price <= 5_000_000 || r.price > 8_000_000)) return false;
                if (roomPriceRange === "OVER_8M" && r.price <= 8_000_000) return false;
                if (roomSearch.trim()) {
                  const q = roomSearch.toLowerCase();
                  const hay = [
                    r.roomNumber,
                    r.property.name,
                    r.property.address || "",
                    r.property.district,
                    r.amenities || "",
                  ]
                    .join(" ")
                    .toLowerCase();
                  if (!hay.includes(q)) return false;
                }
                return true;
              });

              return (
                <>
                  <div className="bg-white rounded-xl border border-neutral-200 p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-neutral-600 font-medium">
                        Hiển thị <strong className="text-neutral-950">{filteredRooms.length}</strong> / {crm.rooms.length} phòng
                      </div>
                      <div className="flex items-center gap-2">
                        {hasActiveFilter && (
                          <button
                            type="button"
                            onClick={() => {
                              setRoomSearch("");
                              setRoomDistrict("ALL");
                              setRoomPropertyFilter("ALL");
                              setRoomPriceRange("ALL");
                              setRoomTypeFilter("ALL");
                              setRoomStatusFilter("ALL");
                            }}
                            className="px-3 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-xs text-neutral-700 cursor-pointer"
                          >
                            Xóa bộ lọc
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPropertyId(null);
                            setPropertyForm({
                              name: "",
                              district: roomDistrict !== "ALL" ? roomDistrict : "Bình Thạnh",
                              address: "",
                              landlordName: "",
                              landlordPhone: "",
                            });
                            setShowPropertyModal(true);
                          }}
                          className="px-3.5 py-2 rounded-lg bg-white hover:bg-amber-50 text-neutral-900 border border-amber-400 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Building className="w-4 h-4 text-amber-600" /> + Thêm Khu vực
                        </button>
                        {roomPropertyFilter !== "ALL" && (() => {
                          const selectedProp = crm.properties.find((p) => p.id === roomPropertyFilter);
                          if (!selectedProp) return null;
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPropertyId(selectedProp.id);
                                  setPropertyForm({
                                    name: selectedProp.name,
                                    district: selectedProp.district,
                                    address: selectedProp.address || "",
                                    landlordName: selectedProp.landlordName || "",
                                    landlordPhone: selectedProp.landlordPhone || "",
                                  });
                                  setShowPropertyModal(true);
                                }}
                                className="px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                                title="Sửa tên quận / khu vực đang chọn"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Sửa khu vực
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProperty(selectedProp.id, selectedProp.name)}
                                className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                                title="Xóa khu vực đang chọn"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Xóa khu vực
                              </button>
                            </>
                          );
                        })()}
                        <button
                          onClick={() => setShowRoomModal(true)}
                          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Thêm Phòng / Nhà
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                        <input
                          value={roomSearch}
                          onChange={(e) => setRoomSearch(e.target.value)}
                          placeholder="Tìm phòng, địa chỉ, tiện ích..."
                          className="w-full pl-8 pr-2.5 py-2 border border-neutral-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <select
                        value={roomDistrict}
                        onChange={(e) => {
                          setRoomDistrict(e.target.value);
                          setRoomPropertyFilter("ALL");
                        }}
                        className="border border-neutral-300 rounded-lg px-2.5 py-2 text-xs bg-white font-medium"
                      >
                        <option value="ALL">Tất cả Quận ({uniqueDistricts.length})</option>
                        {uniqueDistricts.map((d) => {
                          const zoneCount = crm.properties.filter((p) => p.district === d).length;
                          return (
                            <option key={d} value={d}>
                              {d} ({zoneCount} khu vực)
                            </option>
                          );
                        })}
                      </select>
                      <select
                        value={roomPropertyFilter}
                        onChange={(e) => setRoomPropertyFilter(e.target.value)}
                        className="border border-amber-400 rounded-lg px-2.5 py-2 text-xs bg-amber-50/40 font-medium"
                      >
                        <option value="ALL">
                          {roomDistrict === "ALL"
                            ? `Tất cả địa điểm (${districtProperties.length})`
                            : `Tất cả địa điểm tại ${roomDistrict} (${districtProperties.length})`}
                        </option>
                        {districtProperties.map((p) => {
                          const zoneRoomCount = crm.rooms.filter((r) => r.property.id === p.id).length;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} ({zoneRoomCount} phòng)
                            </option>
                          );
                        })}
                      </select>
                      <select
                        value={roomPriceRange}
                        onChange={(e) => setRoomPriceRange(e.target.value)}
                        className="border border-neutral-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                      >
                        <option value="ALL">Tất cả mức giá</option>
                        <option value="UNDER_3M">Dưới 3 triệu</option>
                        <option value="3M_5M">3 triệu – 5 triệu</option>
                        <option value="5M_8M">5 triệu – 8 triệu</option>
                        <option value="OVER_8M">Trên 8 triệu</option>
                      </select>
                      <select
                        value={roomTypeFilter}
                        onChange={(e) => setRoomTypeFilter(e.target.value)}
                        className="border border-neutral-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                      >
                        <option value="ALL">Tất cả loại hình</option>
                        {Object.entries(ROOM_TYPE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <RoomStatusFilterSelect
                        value={roomStatusFilter}
                        onChange={setRoomStatusFilter}
                      />
                    </div>
                  </div>

                  {(() => {
                    const activeViewings = (crm.viewings || []).filter(
                      (v) => v.status !== "CANCELLED" && v.status !== "CONTRACTED"
                    );
                    if (activeViewings.length === 0) return null;
                    return (
                    <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-600" />
                          Lịch hẹn xem phòng ({activeViewings.length})
                        </div>
                        <span className="text-xs text-neutral-500">Khách xem phòng ưng ý → bấm Chốt cọc để lập phiếu &amp; tải hóa đơn PDF</span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {activeViewings
                          .slice(0, 6)
                          .map((v) => {
                            const matchedRoom = crm.rooms.find((r) => r.id === v.roomId);
                            const thumb = v.roomImage || matchedRoom?.imageUrl;
                            const isSelf = !v.hybridMode || v.hybridMode === "SELF_100";
                            const reminderText =
                              v.reminderMinutes === 15
                                ? "Trước 15 phút"
                                : v.reminderMinutes === 60
                                ? "Trước 1 tiếng"
                                : v.reminderMinutes === 1440
                                ? "Trước 1 ngày"
                                : "Trước 30 phút";
                            return (
                              <div key={v.id} className="p-4 rounded-2xl border border-amber-200 bg-white shadow-sm space-y-3">
                                {/* Top badges */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded-md bg-neutral-950 text-white text-[11px] font-mono font-bold">
                                    {v.code}
                                  </span>
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                      v.status === "CONTRACTED"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : v.status === "VIEWED"
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                        : "bg-amber-50 text-amber-800 border-amber-200"
                                    }`}
                                  >
                                    •{" "}
                                    {v.status === "CONTRACTED"
                                      ? "Đã chốt cọc / Ký HĐ"
                                      : v.status === "VIEWED"
                                      ? "Đã dẫn xem"
                                      : "Chờ dẫn xem"}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-medium">
                                    {isSelf ? "Trọn gói (100% HH)" : "Phối hợp (50% Online / 50% Offline)"}
                                  </span>
                                </div>

                                {/* Customer & Room thumbnail */}
                                <div className="flex items-start gap-3">
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={v.roomLabel}
                                      className="w-20 h-16 rounded-xl object-cover border border-neutral-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-20 h-16 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 shrink-0">
                                      <ImageIcon className="w-6 h-6" />
                                    </div>
                                  )}
                                  <div className="space-y-1 min-w-0">
                                    <div className="font-bold text-base text-neutral-950">{v.customerName}</div>
                                    <div className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                                      <Phone className="w-3.5 h-3.5" /> {v.customerPhone}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                        {v.roomNumber ? `Phòng ${v.roomNumber}` : v.roomLabel}
                                      </span>
                                      <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                                        {v.district}
                                      </span>
                                      <strong className="text-emerald-700">{formatVND(v.price)}</strong>
                                    </div>
                                    <div className="text-[11px] text-neutral-500">
                                      {v.propertyName || v.roomLabel}
                                    </div>
                                  </div>
                                </div>

                                {/* Info bar */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs">
                                  <div className="flex items-start gap-2">
                                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                      <div className="text-[11px] text-neutral-500">
                                        Giờ hẹn xem phòng • {reminderText}
                                      </div>
                                      <div className="font-bold text-neutral-900">
                                        {new Date(v.viewingAt).toLocaleString("vi-VN", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <User className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                                    <div>
                                      {isSelf ? (
                                        <>
                                          <div className="text-[11px] text-neutral-500">Trọn gói (100% HH)</div>
                                          <div className="font-bold text-neutral-900">{v.salesName}</div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="text-[11px] text-neutral-500">
                                            Online (50%): {v.onlineSalesName || "Sales Online"}
                                          </div>
                                          <div className="font-bold text-indigo-700">
                                            Offline (50%): {v.salesName}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Bottom actions */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <a
                                      href={`tel:${v.customerPhone}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-700 text-xs font-medium"
                                    >
                                      <Phone className="w-3.5 h-3.5" /> Gọi
                                    </a>
                                    <a
                                      href={`https://zalo.me/${v.customerPhone.replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50/60 hover:bg-sky-100 text-sky-700 text-xs font-medium"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" /> Zalo
                                    </a>
                                    {v.status === "SCHEDULED" && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateViewingStatus(v.id, "VIEWED")}
                                        className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-medium cursor-pointer"
                                      >
                                        Đã dẫn xem
                                      </button>
                                    )}
                                  </div>

                                  {v.status !== "CONTRACTED" ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const moveIn = new Date();
                                        moveIn.setDate(moveIn.getDate() + 3);
                                        const matchedCustomer = crm.customers.find((cust) => cust.id === v.customerId);
                                        setDepositForm({
                                          depositAmount: String(v.price),
                                          durationMonths: "12",
                                          moveInDate: moveIn.toISOString().slice(0, 10),
                                          note: v.note || "",
                                          customerIdCard: matchedCustomer?.idCard || "",
                                          paymentMethod: "TRANSFER",
                                          transferAmount: String(v.price),
                                          cashAmount: "",
                                          evidenceUrl: "",
                                        });
                                        setDepositModalViewing(v);
                                      }}
                                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" /> Chốt cọc
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReceiptModalData({
                                          contractCode: v.code,
                                          customerName: v.customerName,
                                          customerPhone: v.customerPhone,
                                          roomLabel: v.roomLabel,
                                          address: [v.address, v.district].filter(Boolean).join(", "),
                                          monthlyRent: v.price,
                                          depositAmount: v.price,
                                          collectedAmount: v.price,
                                          durationMonths: 12,
                                          moveInDate: v.viewingAt,
                                          salesName: v.salesName,
                                          note: v.note,
                                        })
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Printer className="w-3.5 h-3.5" /> Tải hóa đơn PDF
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                    );
                  })()}

                  {filteredRooms.length === 0 ? (
                    <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center text-sm text-neutral-500">
                      Không tìm thấy phòng phù hợp với tiêu chí lọc hiện tại.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredRooms.map((r) => {
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
                                roomType: r.roomType || "PHONG_TRO",
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
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/90 text-neutral-800 border border-neutral-200 text-[11px] font-medium">
                                {ROOM_TYPE_LABELS[r.roomType || "PHONG_TRO"] || "Phòng trọ"}
                              </span>
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
                        {r.status === "AVAILABLE" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openViewingModalForRoom(r.id);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-semibold cursor-pointer"
                          >
                            <CalendarPlus className="w-3 h-3" /> Đặt lịch xem
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-neutral-500">Bấm xem chi tiết →</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
                    </div>
                  )}
                </>
              );
            })()}
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
                    <td className="px-4 py-3 text-xs">{SOURCE_LABELS[c.source] || c.source}</td>
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
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 my-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900">Thêm Phòng trọ mới</h3>
                <button type="button" onClick={() => setShowRoomModal(false)} className="p-1 rounded-lg hover:bg-neutral-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateRoom} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Tòa nhà / Khu trọ</label>
                  <select
                    value={roomForm.propertyId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const prop = crm.properties.find((p) => p.id === val);
                      setRoomForm({
                        ...roomForm,
                        propertyId: val,
                        district: val === "__NEW__" ? "" : prop?.district || "",
                        address: val === "__NEW__" ? "" : prop?.address || "",
                      });
                    }}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {crm.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.district})
                      </option>
                    ))}
                    <option value="__NEW__">+ Nhập tòa nhà / khu vực mới</option>
                  </select>
                </div>
                {roomForm.propertyId === "__NEW__" && (
                  <input
                    required
                    placeholder="Tên tòa nhà / Khu trọ mới (VD: NDAHome Quận 7)"
                    value={roomForm.propertyName}
                    onChange={(e) => setRoomForm({ ...roomForm, propertyName: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      required
                      list="hcm-districts"
                      placeholder="Quận / Khu vực (VD: Bình Thạnh, Quận 7...)"
                      value={roomForm.district}
                      onChange={(e) => setRoomForm({ ...roomForm, district: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <datalist id="hcm-districts">
                      <option value="Quận 1" />
                      <option value="Quận 3" />
                      <option value="Quận 4" />
                      <option value="Quận 5" />
                      <option value="Quận 7" />
                      <option value="Quận 10" />
                      <option value="Bình Thạnh" />
                      <option value="Phú Nhuận" />
                      <option value="Gò Vấp" />
                      <option value="Tân Bình" />
                      <option value="Tân Phú" />
                      <option value="TP. Thủ Đức" />
                      <option value="Bình Tân" />
                    </datalist>
                  </div>
                  <input
                    placeholder="Địa chỉ (số nhà, đường...)"
                    value={roomForm.address}
                    onChange={(e) => setRoomForm({ ...roomForm, address: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
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
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={roomForm.roomType}
                    onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {Object.entries(ROOM_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    required
                    placeholder="Giá thuê / tháng (VNĐ)"
                    value={roomForm.price}
                    onChange={(e) => setRoomForm({ ...roomForm, price: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Tiện ích nổi bật của phòng
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROOM_AMENITY_OPTIONS.map((item) => {
                      const active = hasAmenityValue(roomForm.amenities, item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            setRoomForm({
                              ...roomForm,
                              amenities: toggleAmenityValue(roomForm.amenities, item),
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                            active
                              ? "border-amber-500 bg-amber-50 text-amber-800"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-amber-300"
                          }`}
                        >
                          {active && <CheckCircle2 className="w-3 h-3 text-amber-600" />}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    placeholder="Tiện ích khác (hoặc xem danh sách đã chọn)..."
                    value={roomForm.amenities}
                    onChange={(e) => setRoomForm({ ...roomForm, amenities: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
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
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 mt-1">
                    <span>
                      {selectedRoom.property.address ? `${selectedRoom.property.address}, ` : ""}
                      {selectedRoom.property.district} • Tầng {selectedRoom.floor} • {selectedRoom.area}m²
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [selectedRoom.property.address || selectedRoom.property.name, selectedRoom.property.district]
                          .filter(Boolean)
                          .join(", ")
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-medium"
                      title="Xem địa chỉ phòng trên Google Maps"
                    >
                      <MapPin className="w-3 h-3" /> Mở Google Maps <ExternalLink className="w-3 h-3" />
                    </a>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-0.5">Loại hình</label>
                      <select
                        value={editRoomForm.roomType}
                        onChange={(e) => setEditRoomForm({ ...editRoomForm, roomType: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                      >
                        {Object.entries(ROOM_TYPE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
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
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-200">
                  <div>
                    <span className="text-neutral-500">Địa chỉ:</span>{" "}
                    <strong className="text-neutral-900">
                      {[selectedRoom.property.address || selectedRoom.property.name, selectedRoom.property.district]
                        .filter(Boolean)
                        .join(", ")}
                    </strong>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [selectedRoom.property.address || selectedRoom.property.name, selectedRoom.property.district]
                        .filter(Boolean)
                        .join(", ")
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-xs font-medium"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Chỉ đường Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
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
                            <span className="text-neutral-800">{SOURCE_LABELS[ct.customer.source] || ct.customer.source}</span>
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

                      {/* File PDF hóa đơn / chứng từ minh chứng thuê phòng */}
                      <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold text-xs text-neutral-900">
                            <FileText className="w-4 h-4 text-amber-600" /> File PDF hóa đơn / Chứng từ minh chứng
                          </div>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-xs font-medium cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />
                            {uploadingInvoice ? "Đang tải..." : ct.invoiceUrl ? "Đổi file PDF" : "Tải file PDF hóa đơn"}
                            <input
                              type="file"
                              accept=".pdf,application/pdf,image/*"
                              onChange={(e) => handleUploadContractInvoice(ct.id, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                        {ct.invoiceUrl ? (
                          <div className="flex items-center gap-3">
                            {isImageUrl(ct.invoiceUrl) ? (
                              <img
                                src={ct.invoiceUrl}
                                alt="Hóa đơn minh chứng"
                                onClick={() => setPreviewInvoiceUrl(ct.invoiceUrl || null)}
                                className="w-28 h-20 object-cover rounded-lg border border-amber-400 cursor-pointer hover:opacity-90"
                                title="Bấm để xem"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPreviewInvoiceUrl(ct.invoiceUrl || null)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold cursor-pointer"
                              >
                                <FileText className="w-4 h-4 text-rose-600" /> Tệp PDF hóa đơn đã đính kèm
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewInvoiceUrl(ct.invoiceUrl || null)}
                              className="text-xs font-medium text-amber-700 hover:underline cursor-pointer"
                            >
                              Bấm để xem / tải file PDF →
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-neutral-500">
                            Chưa có file PDF hóa đơn / biên lai chuyển khoản cho hợp đồng này.
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const rid = selectedRoom.id;
                        setSelectedRoom(null);
                        openViewingModalForRoom(rid);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" /> Đặt lịch xem phòng
                    </button>
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
                      + Tạo hợp đồng / đặt cọc
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Đặt lịch xem phòng (Sales Hybrid) */}
        {showViewingModal && (() => {
          const selectedProp = crm.properties.find((p) => p.id === viewingForm.propertyId);
          const propRooms = selectedProp
            ? crm.rooms.filter(
                (r) => r.property.name === selectedProp.name && r.property.district === selectedProp.district
              )
            : crm.rooms;
          const previewRoom = crm.rooms.find((r) => r.id === viewingForm.roomId) || propRooms[0];
          const isSelf100 = viewingForm.hybridMode === "SELF_100";

          return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-6 max-h-[92vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                      <CalendarPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900">
                        Đặt lịch hẹn xem phòng (Sales Hybrid)
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Linh hoạt tự dẫn hưởng 100% HH hoặc chuyển đồng đội / Kho lịch chờ nhận (50% / 50%)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowViewingModal(false)}
                    className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateViewing} className="space-y-4">
                  {/* 1. Thông tin khách hàng */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-neutral-900">1. Thông tin khách hàng *</label>
                      <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setViewingForm((vf) => ({ ...vf, customerMode: "EXISTING" }))}
                          className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                            viewingForm.customerMode === "EXISTING"
                              ? "bg-white text-amber-700 shadow-sm border border-amber-300"
                              : "text-neutral-600"
                          }`}
                        >
                          Chọn khách có sẵn
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingForm((vf) => ({ ...vf, customerMode: "NEW" }))}
                          className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                            viewingForm.customerMode === "NEW"
                              ? "bg-amber-50 text-amber-800 shadow-sm border border-amber-300"
                              : "text-neutral-600"
                          }`}
                        >
                          + Nhập nhanh khách mới
                        </button>
                      </div>
                    </div>

                    {viewingForm.customerMode === "NEW" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          required
                          placeholder="Họ và tên khách hàng *"
                          value={viewingForm.customerName}
                          onChange={(e) => setViewingForm({ ...viewingForm, customerName: e.target.value })}
                          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          required
                          placeholder="Số điện thoại *"
                          value={viewingForm.customerPhone}
                          onChange={(e) => setViewingForm({ ...viewingForm, customerPhone: e.target.value })}
                          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    ) : (
                      <select
                        required
                        value={viewingForm.customerId}
                        onChange={(e) => setViewingForm({ ...viewingForm, customerId: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {crm.customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} ({c.phone})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 2. Khu trọ & Phòng khách muốn xem */}
                  <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/70 space-y-3">
                    <div className="text-xs font-bold text-neutral-900">2. Khu trọ &amp; Phòng khách muốn xem *</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">Chọn Khu trọ / Tòa nhà</label>
                        <select
                          value={viewingForm.propertyId}
                          onChange={(e) => {
                            const pid = e.target.value;
                            const p = crm.properties.find((x) => x.id === pid);
                            const matchingRooms = p
                              ? crm.rooms.filter(
                                  (r) => r.property.name === p.name && r.property.district === p.district
                                )
                              : crm.rooms;
                            const firstAvail =
                              matchingRooms.find((r) => r.status === "AVAILABLE") || matchingRooms[0];
                            setViewingForm({
                              ...viewingForm,
                              propertyId: pid,
                              roomId: firstAvail?.id || "",
                            });
                          }}
                          className="w-full border border-neutral-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                        >
                          {crm.properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.district})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">Chọn Phòng cụ thể</label>
                        <select
                          required
                          value={viewingForm.roomId}
                          onChange={(e) => setViewingForm({ ...viewingForm, roomId: e.target.value })}
                          className="w-full border border-neutral-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                        >
                          {propRooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.roomNumber} ({r.status === "AVAILABLE" ? "Trống" : getStatusLabel(r.status)}) —{" "}
                              {formatVND(r.price)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {previewRoom && (
                      <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200 flex items-center gap-3">
                        {previewRoom.imageUrl ? (
                          <img
                            src={previewRoom.imageUrl}
                            alt={previewRoom.roomNumber}
                            className="w-16 h-14 rounded-lg object-cover border border-amber-300 shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-14 rounded-lg bg-neutral-200 flex items-center justify-center text-neutral-400 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="text-xs space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <strong className="text-neutral-900">
                              Phòng {previewRoom.roomNumber} • Tầng {previewRoom.floor} • {previewRoom.area}m²
                            </strong>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                              {previewRoom.status === "AVAILABLE" ? "Trống" : getStatusLabel(previewRoom.status)}
                            </span>
                          </div>
                          <div className="font-bold text-amber-700">
                            Giá thuê: {formatVND(previewRoom.price)}/tháng
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate">
                            {previewRoom.property.address ? `${previewRoom.property.address}, ` : ""}
                            {previewRoom.property.district}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Ngày & giờ hẹn xem phòng */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-neutral-900">3. Ngày &amp; giờ hẹn xem phòng *</label>
                    <input
                      type="datetime-local"
                      required
                      value={viewingForm.viewingAt}
                      onChange={(e) => setViewingForm({ ...viewingForm, viewingAt: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>

                  {/* 4. Người dẫn khách (Sales Offline) */}
                  <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/40 space-y-2.5">
                    <label className="block text-xs font-bold text-neutral-900">
                      4. Người dẫn khách (Sales Offline) *
                    </label>
                    <select
                      value={viewingForm.salesId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const mode =
                          val === "SELF" ? "SELF_100" : val === "POOL" ? "POOL_40_60" : "TEAM_40_60";
                        setViewingForm({ ...viewingForm, salesId: val, hybridMode: mode });
                      }}
                      className="w-full border border-amber-400 rounded-lg px-3 py-2 text-xs font-medium bg-white"
                    >
                      <option value="SELF">Chính tôi — Tự tư vấn &amp; Tự dẫn khách (Hưởng 100% HH)</option>
                      <option value="POOL">Đưa vào Kho lịch chờ nhận (50% Online / 50% Offline)</option>
                      {crm.salesUsers.map((s) => (
                        <option key={s.id} value={s.id}>
                          Chuyển đồng đội: {s.fullName} (50% Online / 50% Offline)
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 font-semibold">
                        {isSelf100 ? "Trọn gói (100% HH)" : "Phối hợp (50% Online / 50% Offline)"}
                      </span>
                      <span className="text-neutral-500">
                        {isSelf100 ? "Tự động xác nhận lịch ngay" : "Gửi thông báo xác nhận lịch"}
                      </span>
                    </div>
                  </div>

                  {/* 5. Nhắc lịch tự động trước giờ hẹn */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-neutral-900">
                      5. Nhắc lịch tự động trước giờ hẹn
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Trước 15 phút", mins: 15 },
                        { label: "Trước 30 phút", mins: 30 },
                        { label: "Trước 1 tiếng", mins: 60 },
                        { label: "Trước 1 ngày", mins: 1440 },
                      ].map((opt) => (
                        <button
                          key={opt.mins}
                          type="button"
                          onClick={() => setViewingForm({ ...viewingForm, reminderMinutes: opt.mins })}
                          className={`py-2 px-2 rounded-lg text-xs font-medium border cursor-pointer ${
                            viewingForm.reminderMinutes === opt.mins
                              ? "border-amber-500 bg-amber-50 text-amber-800 font-semibold"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-amber-300"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 6. Ghi chú yêu cầu của khách */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-neutral-900">6. Ghi chú yêu cầu của khách</label>
                    <textarea
                      rows={2}
                      placeholder="Ví dụ: Khách cần xem ban công, máy lạnh, hỏi bãi giữ xe..."
                      value={viewingForm.note}
                      onChange={(e) => setViewingForm({ ...viewingForm, note: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setShowViewingModal(false)}
                      className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-medium cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      {isSelf100 ? "Xác nhận đặt lịch (100% HH)" : "Xác nhận đặt lịch (50% / 50%)"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Modal Xác nhận Chốt cọc & Lập phiếu cọc (Hình 2) */}
        {depositModalViewing && (() => {
          const v = depositModalViewing;
          const isSelf = !v.hybridMode || v.hybridMode === "SELF_100";
          return (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900">Xác nhận Chốt cọc &amp; Lập phiếu cọc</h3>
                      <p className="text-xs text-neutral-500">
                        Khách: <strong>{v.customerName}</strong> • {v.customerPhone}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDepositModalViewing(null)}
                    className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Room summary card */}
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <strong className="text-neutral-900 text-sm">{v.roomLabel}</strong>
                    <strong className="text-emerald-700 text-sm">{formatVND(v.price)}/tháng</strong>
                  </div>
                  <div className="text-neutral-500">
                    {v.district} {v.address ? `• ${v.address}` : ""}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                      {isSelf ? "Trọn gói (100% HH)" : "Phối hợp (50% Online / 50% Offline)"}
                    </span>
                    <span className="text-neutral-600">
                      Sales dẫn chốt: <strong>{v.salesName}</strong>
                    </span>
                  </div>
                </div>

                <form onSubmit={handleConfirmDepositFromViewing} className="space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-neutral-900">Số tiền khách đặt cọc (VNĐ) *</label>
                      <span className="text-[11px] text-neutral-500">Mặc định = 1 tháng tiền phòng</span>
                    </div>
                    <input
                      type="number"
                      required
                      min={100000}
                      value={depositForm.depositAmount}
                      onChange={(e) => setDepositForm({ ...depositForm, depositAmount: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-base font-bold text-emerald-700"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        { label: "100% tiền phòng (1 tháng)", val: v.price },
                        { label: "50% cọc giữ chỗ", val: Math.round(v.price * 0.5) },
                        { label: "2.000.000 đ", val: 2_000_000 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setDepositForm({ ...depositForm, depositAmount: String(preset.val) })}
                          className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-medium cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-900 mb-1">Thời hạn hợp đồng</label>
                      <select
                        value={depositForm.durationMonths}
                        onChange={(e) => setDepositForm({ ...depositForm, durationMonths: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs bg-white"
                      >
                        <option value="12">12 tháng (CTY 80%)</option>
                        <option value="6">6 tháng (CTY 50%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-900 mb-1">
                        Ngày dự kiến dọn vào / nhận phòng *
                      </label>
                      <input
                        type="date"
                        required
                        value={depositForm.moveInDate}
                        onChange={(e) => setDepositForm({ ...depositForm, moveInDate: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>

                  <PaymentVerificationFields
                    value={{
                      customerIdCard: depositForm.customerIdCard,
                      paymentMethod: depositForm.paymentMethod,
                      transferAmount: depositForm.transferAmount,
                      cashAmount: depositForm.cashAmount,
                      evidenceUrl: depositForm.evidenceUrl,
                    }}
                    totalAmount={Number(depositForm.depositAmount) || v.price}
                    qrDescription={`COC ${v.roomLabel}`}
                    onChange={(next) => setDepositForm({ ...depositForm, ...next })}
                  />

                  <div>
                    <label className="block text-xs font-bold text-neutral-900 mb-1">
                      Ghi chú phiếu đặt cọc (cam kết, thời gian bàn giao...)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="VD: Khách đã chuyển khoản VietQR MB Bank, hẹn bàn giao chìa khóa & ký HĐ chính thức..."
                      value={depositForm.note}
                      onChange={(e) => setDepositForm({ ...depositForm, note: e.target.value })}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
                    Sau khi xác nhận: Phòng tự động chuyển sang trạng thái <strong>Đã thuê / Đã cọc</strong>, khách chuyển sang danh sách đã đặt cọc và hệ thống tự cộng doanh số/hoa hồng cho Sales.
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDepositModalViewing(null)}
                      className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-medium cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Xác nhận Chốt cọc
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Modal Xem trước & Tải Hóa đơn Đặt cọc PDF */}
        {receiptModalData && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Hóa đơn / Phiếu đặt cọc — {receiptModalData.contractCode}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Bấm &quot;Tải / In Hóa đơn PDF&quot; rồi chọn &quot;Save as PDF / Lưu dưới dạng PDF&quot; để tải về máy
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printDepositReceiptPdf(receiptModalData)}
                    className="px-4 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-amber-400 border border-amber-500 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Tải / In Hóa đơn PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptModalData(null)}
                    className="p-2 rounded-lg border border-neutral-300 hover:bg-neutral-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-neutral-200 p-4">
                <iframe
                  title="Hóa đơn đặt cọc PDF"
                  srcDoc={buildDepositReceiptHtml(receiptModalData)}
                  className="w-full h-[62vh] bg-white rounded-lg shadow border border-neutral-300"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Xem chi tiết Hợp đồng & Tiền cọc */}
        {selectedContract && (() => {
          const c = selectedContract;
          const dep = c.deposits[0];
          const isReserved = c.status === "RESERVED";
          const isForfeited = c.status === "FORFEITED";
          return (
            <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4" onClick={() => setSelectedContract(null)}>
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between border-b border-neutral-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-amber-700">{c.contractCode}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isForfeited
                            ? "bg-rose-100 text-rose-700"
                            : isReserved
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {isForfeited
                          ? "Đã hủy cọc (Bỏ cọc)"
                          : isReserved
                            ? "Đã đặt cọc (Chờ ký giấy)"
                            : "Đã thanh toán đủ & Ký HĐ (Đã thuê)"}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Ngày lập: {formatDate(c.signedDate)} • Thời hạn: {c.durationMonths} tháng
                    </div>
                  </div>
                  <button onClick={() => setSelectedContract(null)} className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div>
                    <span className="text-neutral-500">Khách hàng:</span>{" "}
                    <strong className="text-neutral-900">{c.customer.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">SĐT khách:</span>{" "}
                    <strong className="text-neutral-900">{c.customer.phone}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Phòng thuê:</span>{" "}
                    <strong className="text-neutral-900">{c.room.property.name} — {c.room.roomNumber}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Sales phụ trách:</span>{" "}
                    <strong className="text-neutral-900">{c.sales.fullName}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Giá thuê / tháng:</span>{" "}
                    <strong className="text-neutral-900">{formatVND(c.monthlyRent)}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Tiền đặt cọc:</span>{" "}
                    <strong className="text-amber-700">{formatVND(c.depositAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Hoa hồng công ty ({(c.companyCommissionRate * 100).toFixed(0)}%):</span>{" "}
                    <strong className="text-emerald-700">{formatVND(c.companyRevenue)}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Tiền trả chủ trọ:</span>{" "}
                    <strong className="text-orange-700">{formatVND(c.landlordPayable)}</strong>
                  </div>
                </div>

                {c.note && (
                  <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-neutral-700">
                    <strong>Ghi chú:</strong> {c.note}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => {
                      const matchedPm = c.note?.match(/Hình thức thanh toán:\s*([^•]+)/);
                      setReceiptModalData({
                        contractCode: c.contractCode,
                        customerName: c.customer.fullName,
                        customerPhone: c.customer.phone,
                        customerIdCard: c.customer.idCard || undefined,
                        roomLabel: `${c.room.property.name} — ${c.room.roomNumber}`,
                        address: [c.room.property.address, c.room.property.district].filter(Boolean).join(", "),
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
                    className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Xem / Tải Hóa đơn PDF
                  </button>

                  {dep && isReserved && (
                    <>
                      <button
                        type="button"
                        onClick={() => openCancelDepositModal(c)}
                        className="px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        Hủy cọc (Chia 50/50 phần dư)
                      </button>
                      <button
                        type="button"
                        onClick={() => openSignRentModal(c)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Thanh toán đủ &amp; Ký HĐ (→ Đã thuê)
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal Hủy cọc & Đối soát tiền cọc (trừ tiền giữ phòng trả chủ trọ, phần dư chia 50/50) */}
        {cancelDepositContract && (() => {
          const c = cancelDepositContract;
          const holdDays = Math.max(0, Number(cancelDepositForm.holdDays || 0));
          const collectedDeposit = Math.max(0, Number(cancelDepositForm.collectedDeposit || 0));
          const rawHoldFee = Math.round((c.monthlyRent / 30) * holdDays);
          const landlordHoldFee = Math.min(collectedDeposit, rawHoldFee);
          const remainingPool = Math.max(0, collectedDeposit - landlordHoldFee);
          const salesRemainderShare = Math.round(remainingPool * 0.5);
          const landlordRemainderShare = remainingPool - salesRemainderShare;
          const totalLandlordShare = landlordHoldFee + landlordRemainderShare;

          return (
            <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-rose-700">
                      Hủy cọc &amp; Đối soát tiền cọc ({c.contractCode})
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Khách: <strong>{c.customer.fullName}</strong> • {c.room.property.name} ({c.room.roomNumber})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCancelDepositContract(null)}
                    className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleConfirmCancelDeposit} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-900 mb-1">
                        Tiền khách đã đặt cọc (VNĐ)
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={cancelDepositForm.collectedDeposit}
                        onChange={(e) =>
                          setCancelDepositForm({ ...cancelDepositForm, collectedDeposit: e.target.value })
                        }
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-900 mb-1">
                        Số ngày giữ phòng (hẹn nhận)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        required
                        value={cancelDepositForm.holdDays}
                        onChange={(e) =>
                          setCancelDepositForm({ ...cancelDepositForm, holdDays: e.target.value })
                        }
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Live calculation breakdown */}
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Giá thuê phòng / tháng:</span>
                      <span className="font-semibold">{formatVND(c.monthlyRent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">
                        Tiền phòng {holdDays} ngày giữ chỗ (trả chủ trọ):
                      </span>
                      <span className="font-bold text-orange-700">- {formatVND(landlordHoldFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 pt-1.5">
                      <span className="text-neutral-700 font-semibold">Phần cọc dư còn lại (chia 50/50):</span>
                      <span className="font-bold text-neutral-900">{formatVND(remainingPool)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 rounded-lg bg-white border border-orange-200">
                        <div className="text-[11px] text-neutral-500">Tổng trả Chủ trọ</div>
                        <div className="text-sm font-bold text-orange-700">{formatVND(totalLandlordShare)}</div>
                        <div className="text-[10px] text-neutral-400">
                          ({formatVND(landlordHoldFee)} + 50% dư)
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-emerald-200">
                        <div className="text-[11px] text-neutral-500">Phần bên Sales / CTY (50% dư)</div>
                        <div className="text-sm font-bold text-emerald-700">{formatVND(salesRemainderShare)}</div>
                        <div className="text-[10px] text-neutral-400">Cộng vào doanh số Sales</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-900 mb-1">Lý do hủy cọc</label>
                    <textarea
                      rows={2}
                      value={cancelDepositForm.note}
                      onChange={(e) => setCancelDepositForm({ ...cancelDepositForm, note: e.target.value })}
                      placeholder="VD: Quá ngày hẹn nhận phòng khách không tới nhận..."
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCancelDepositContract(null)}
                      className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-medium cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Xác nhận Hủy cọc &amp; Mở lại phòng
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Modal Thanh toán đủ & Ký Hợp đồng (CCCD + Hình thức thanh toán + Minh chứng) */}
        {signRentContract && (
          <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Xác nhận Thanh toán đủ &amp; Ký Hợp đồng
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {signRentContract.contractCode} • Khách: <strong>{signRentContract.customer.fullName}</strong> •{" "}
                    {signRentContract.room.property.name} ({signRentContract.room.roomNumber})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSignRentContract(null)}
                  className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-medium">Tổng tiền cọc / hợp đồng cần xác nhận:</span>
                <strong className="text-sm text-emerald-700">{formatVND(signRentContract.depositAmount)}</strong>
              </div>

              <form onSubmit={handleConfirmSignAndRent} className="space-y-3.5">
                <PaymentVerificationFields
                  value={{
                    customerIdCard: signRentForm.customerIdCard,
                    paymentMethod: signRentForm.paymentMethod,
                    transferAmount: signRentForm.transferAmount,
                    cashAmount: signRentForm.cashAmount,
                    evidenceUrl: signRentForm.evidenceUrl,
                  }}
                  totalAmount={signRentContract.depositAmount}
                  qrDescription={`THANH TOAN ${signRentContract.contractCode}`}
                  onChange={(next) => setSignRentForm({ ...signRentForm, ...next })}
                />

                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Ghi chú bàn giao &amp; thanh toán
                  </label>
                  <textarea
                    rows={2}
                    value={signRentForm.note}
                    onChange={(e) => setSignRentForm({ ...signRentForm, note: e.target.value })}
                    placeholder="VD: Đã thu đủ tiền, bàn giao chìa khóa & ký hợp đồng bản cứng..."
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSignRentContract(null)}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-medium cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Xác nhận Thanh toán &amp; Chuyển Đã thuê
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Thêm Khu vực / Tòa nhà mới theo Quận */}
        {showPropertyModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900">
                  {editingPropertyId ? "Chỉnh sửa Quận & Khu vực" : "Thêm Khu vực / Tòa nhà mới"}
                </h3>
                <button type="button" onClick={() => { setShowPropertyModal(false); setEditingPropertyId(null); }} className="p-1 hover:bg-neutral-100 rounded-lg cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateProperty} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Quận / Thành phố *</label>
                  <input
                    required
                    list="hcm-districts"
                    placeholder="VD: Bình Thạnh, Quận 7, TP. Thủ Đức..."
                    value={propertyForm.district}
                    onChange={(e) => setPropertyForm({ ...propertyForm, district: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tên Khu vực / Tòa nhà *</label>
                  <input
                    required
                    placeholder="VD: Khu Phan Văn Trị, Chung cư Vinhomes, Nhà trọ D2..."
                    value={propertyForm.name}
                    onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Địa chỉ cụ thể *</label>
                  <input
                    required
                    placeholder="VD: 148 Điện Biên Phủ, P.17..."
                    value={propertyForm.address}
                    onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    placeholder="Tên chủ trọ / Quản lý *"
                    value={propertyForm.landlordName}
                    onChange={(e) => setPropertyForm({ ...propertyForm, landlordName: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="SĐT chủ trọ *"
                    value={propertyForm.landlordPhone}
                    onChange={(e) => setPropertyForm({ ...propertyForm, landlordPhone: e.target.value })}
                    className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowPropertyModal(false)} className="px-4 py-2 rounded-lg border text-sm cursor-pointer">
                    Hủy
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-sm font-bold cursor-pointer">
                    Lưu khu vực
                  </button>
                </div>
              </form>
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
        <AttachmentPreviewModal
          url={previewInvoiceUrl}
          title="File PDF hóa đơn / Chứng từ minh chứng"
          onClose={() => setPreviewInvoiceUrl(null)}
        />
      </div>
    </AppShell>
  );
}
