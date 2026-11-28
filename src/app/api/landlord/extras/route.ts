import { NextResponse } from "next/server";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissionsServer";
import { getKvJsonWithFallback, setKvJson } from "@/lib/dbStore";

export interface UtilityBillRecord {
  id: string;
  roomId: string;
  roomLabel: string;
  monthKey: string; // YYYY-MM
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
  updatedAt: string;
}

export interface MaintenanceIssueRecord {
  id: string;
  roomId: string;
  roomLabel: string;
  title: string;
  cost: number;
  status: "OPEN" | "DONE";
  createdAt: string;
}

export interface VacatingNoticeRecord {
  roomId: string;
  roomLabel: string;
  expectedVacateDate: string;
  note?: string;
  reportedAt: string;
}

export interface ResidentRecord {
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

export interface PropertyRateRecord {
  propertyId: string;
  propertyName: string;
  electricRate: number;
  waterRate: number;
  serviceFee: number;
  parkingFee: number;
}

export interface OperatingExpenseRecord {
  id: string;
  propertyId: string;
  propertyName: string;
  monthKey: string;
  title: string;
  amount: number;
  createdAt: string;
}

const UTILITIES_FILE = path.join(process.cwd(), "data", "landlord-utilities.json");
const ISSUES_FILE = path.join(process.cwd(), "data", "landlord-issues.json");
const VACATING_FILE = path.join(process.cwd(), "data", "landlord-vacating.json");
const RESIDENTS_FILE = path.join(process.cwd(), "data", "landlord-residents.json");
const RATES_FILE = path.join(process.cwd(), "data", "landlord-rates.json");
const EXPENSES_FILE = path.join(process.cwd(), "data", "landlord-expenses.json");

function getLandlordKvKey(filePath: string): string {
  return `landlord_${path.basename(filePath, ".json")}`;
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  return getKvJsonWithFallback<T[]>(getLandlordKvKey(filePath), filePath, []);
}

async function writeJsonArray<T>(filePath: string, data: T[]) {
  await setKvJson(getLandlordKvKey(filePath), data);
}

export async function GET() {
  const user = await getCurrentUser();
  const denied = await requirePermission(user, "landlord", "view");
  if (denied) return denied;
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [utilities, issues, vacatingNotices, residents, propertyRates, operatingExpenses] = await Promise.all([
    readJsonArray<UtilityBillRecord>(UTILITIES_FILE),
    readJsonArray<MaintenanceIssueRecord>(ISSUES_FILE),
    readJsonArray<VacatingNoticeRecord>(VACATING_FILE),
    readJsonArray<ResidentRecord>(RESIDENTS_FILE),
    readJsonArray<PropertyRateRecord>(RATES_FILE),
    readJsonArray<OperatingExpenseRecord>(EXPENSES_FILE),
  ]);

  return NextResponse.json({
    utilities,
    issues,
    vacatingNotices,
    residents,
    propertyRates,
    operatingExpenses,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const denied = await requirePermission(user, "landlord", "create");
  if (denied) return denied;
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.type === "UTILITY") {
    const list = await readJsonArray<UtilityBillRecord>(UTILITIES_FILE);
    const oldElectric = Number(body.oldElectric || 0);
    const newElectric = Number(body.newElectric || 0);
    const electricRate = Number(body.electricRate ?? 3800);
    const oldWater = Number(body.oldWater || 0);
    const newWater = Number(body.newWater || 0);
    const waterRate = Number(body.waterRate ?? 20000);
    const serviceFee = Number(body.serviceFee || 0);
    const roomRent = Number(body.roomRent || 0);

    const elecCost = Math.max(0, newElectric - oldElectric) * electricRate;
    const waterCost = Math.max(0, newWater - oldWater) * waterRate;
    const totalAmount = roomRent + elecCost + waterCost + serviceFee;

    const recordId = `${body.roomId}_${body.monthKey}`;
    const record: UtilityBillRecord = {
      id: recordId,
      roomId: String(body.roomId),
      roomLabel: String(body.roomLabel || ""),
      monthKey: String(body.monthKey),
      roomRent,
      oldElectric,
      newElectric,
      electricRate,
      oldWater,
      newWater,
      waterRate,
      serviceFee,
      totalAmount,
      isPaid: Boolean(body.isPaid),
      note: body.note ? String(body.note) : undefined,
      updatedAt: new Date().toISOString(),
    };

    const idx = list.findIndex((x) => x.id === recordId);
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);

    await writeJsonArray(UTILITIES_FILE, list);
    return NextResponse.json({ utility: record }, { status: 201 });
  }

  if (body.type === "ISSUE") {
    const list = await readJsonArray<MaintenanceIssueRecord>(ISSUES_FILE);
    const record: MaintenanceIssueRecord = {
      id: `ISS-${Date.now()}`,
      roomId: String(body.roomId),
      roomLabel: String(body.roomLabel || ""),
      title: String(body.title || "").trim(),
      cost: Number(body.cost || 0),
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };
    list.unshift(record);
    await writeJsonArray(ISSUES_FILE, list);
    return NextResponse.json({ issue: record }, { status: 201 });
  }

  if (body.type === "REPORT_VACATING") {
    const list = await readJsonArray<VacatingNoticeRecord>(VACATING_FILE);
    const record: VacatingNoticeRecord = {
      roomId: String(body.roomId),
      roomLabel: String(body.roomLabel || ""),
      expectedVacateDate: String(body.expectedVacateDate || ""),
      note: body.note ? String(body.note) : undefined,
      reportedAt: new Date().toISOString(),
    };
    const filtered = list.filter((x) => x.roomId !== record.roomId);
    filtered.unshift(record);
    await writeJsonArray(VACATING_FILE, filtered);

    // Gửi thông báo cho toàn bộ đội Sales & Admin biết phòng sắp trống
    const recipients = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["SALES", "ADMIN"] } },
      select: { id: true },
    });
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          title: "Chủ trọ báo phòng sắp trống",
          message: `Phòng ${record.roomLabel} dự kiến trống ngày ${record.expectedVacateDate}. Sales có thể đăng tìm khách trước!`,
          type: "INFO",
          link: "/sales",
        })),
      });
    }

    return NextResponse.json({ vacating: record }, { status: 201 });
  }

  if (body.type === "RESIDENT") {
    const list = await readJsonArray<ResidentRecord>(RESIDENTS_FILE);
    const record: ResidentRecord = {
      id: `RES-${Date.now()}`,
      roomId: String(body.roomId),
      roomLabel: String(body.roomLabel || ""),
      fullName: String(body.fullName || "").trim(),
      phone: String(body.phone || "").trim(),
      idCard: body.idCard ? String(body.idCard).trim() : undefined,
      vehiclePlate: body.vehiclePlate ? String(body.vehiclePlate).trim().toUpperCase() : undefined,
      keyCardCode: body.keyCardCode ? String(body.keyCardCode).trim() : undefined,
      tempResidenceDone: Boolean(body.tempResidenceDone),
      createdAt: new Date().toISOString(),
    };
    list.unshift(record);
    await writeJsonArray(RESIDENTS_FILE, list);
    return NextResponse.json({ resident: record }, { status: 201 });
  }

  if (body.type === "PROPERTY_RATES") {
    const list = await readJsonArray<PropertyRateRecord>(RATES_FILE);
    const record: PropertyRateRecord = {
      propertyId: String(body.propertyId),
      propertyName: String(body.propertyName || ""),
      electricRate: Number(body.electricRate ?? 3800),
      waterRate: Number(body.waterRate ?? 20000),
      serviceFee: Number(body.serviceFee ?? 150000),
      parkingFee: Number(body.parkingFee ?? 100000),
    };
    const idx = list.findIndex((x) => x.propertyId === record.propertyId);
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);
    await writeJsonArray(RATES_FILE, list);
    return NextResponse.json({ rate: record }, { status: 201 });
  }

  if (body.type === "OPERATING_EXPENSE") {
    const list = await readJsonArray<OperatingExpenseRecord>(EXPENSES_FILE);
    const record: OperatingExpenseRecord = {
      id: `EXP-${Date.now()}`,
      propertyId: String(body.propertyId),
      propertyName: String(body.propertyName || ""),
      monthKey: String(body.monthKey || "2026-11"),
      title: String(body.title || "").trim(),
      amount: Number(body.amount || 0),
      createdAt: new Date().toISOString(),
    };
    list.unshift(record);
    await writeJsonArray(EXPENSES_FILE, list);
    return NextResponse.json({ expense: record }, { status: 201 });
  }

  if (body.type === "SEND_SUPPORT_REQUEST") {
    const category = String(body.category || "OTHER");
    const targetRoles =
      category === "REMIND_PAYOUT"
        ? ["ADMIN", "ACCOUNTANT"]
        : category === "BOOST_EMPTY_ROOM"
          ? ["ADMIN", "SALES"]
          : ["ADMIN", "SALES", "ACCOUNTANT"];
    const recipients = await prisma.user.findMany({
      where: { isActive: true, role: { in: targetRoles } },
      select: { id: true },
    });
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          title: `Yêu cầu từ Chủ trọ (${user.fullName})`,
          message: String(body.message || "").trim(),
          type: "WARNING",
          link: category === "REMIND_PAYOUT" ? "/sales" : "/sales",
        })),
      });
    }
    return NextResponse.json({ sentCount: recipients.length }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.type === "TOGGLE_UTILITY_PAID") {
    const list = await readJsonArray<UtilityBillRecord>(UTILITIES_FILE);
    const item = list.find((x) => x.id === body.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    item.isPaid = !item.isPaid;
    item.updatedAt = new Date().toISOString();
    await writeJsonArray(UTILITIES_FILE, list);
    return NextResponse.json({ utility: item });
  }

  if (body.type === "TOGGLE_ISSUE_STATUS") {
    const list = await readJsonArray<MaintenanceIssueRecord>(ISSUES_FILE);
    const item = list.find((x) => x.id === body.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    item.status = item.status === "OPEN" ? "DONE" : "OPEN";
    await writeJsonArray(ISSUES_FILE, list);
    return NextResponse.json({ issue: item });
  }

  if (body.type === "TOGGLE_RESIDENT_TEMP_RES") {
    const list = await readJsonArray<ResidentRecord>(RESIDENTS_FILE);
    const item = list.find((x) => x.id === body.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    item.tempResidenceDone = !item.tempResidenceDone;
    await writeJsonArray(RESIDENTS_FILE, list);
    return NextResponse.json({ resident: item });
  }

  if (body.type === "DELETE_RESIDENT") {
    const list = await readJsonArray<ResidentRecord>(RESIDENTS_FILE);
    const next = list.filter((x) => x.id !== body.id);
    await writeJsonArray(RESIDENTS_FILE, next);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
