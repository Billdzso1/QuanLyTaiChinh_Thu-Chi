import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RoomViewingRecord {
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
  createdAt: string;
}

const VIEWINGS_FILE = path.join(process.cwd(), "data", "room-viewings.json");

async function readViewings(): Promise<RoomViewingRecord[]> {
  try {
    const raw = await readFile(VIEWINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveViewings(items: RoomViewingRecord[]) {
  await mkdir(path.dirname(VIEWINGS_FILE), { recursive: true });
  await writeFile(VIEWINGS_FILE, JSON.stringify(items, null, 2), "utf-8");
}

function maskPhone(phone?: string | null): string {
  const s = String(phone || "").trim();
  if (s.length <= 6) return "***";
  return `${s.slice(0, 3)}****${s.slice(-3)}`;
}

function maskIdCard(idCard?: string | null): string | null {
  const s = String(idCard || "").trim();
  if (!s) return null;
  if (s.length <= 4) return "****";
  return `****${s.slice(-4)}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isSales = user.role === "SALES";
  const customerWhere = isSales ? { salesId: user.id } : {};

  const [customers, properties, rooms, salesUsers, viewings] = await Promise.all([
    prisma.customer.findMany({
      where: customerWhere,
      include: { sales: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.property.findMany({ include: { rooms: true }, orderBy: { name: "asc" } }),
    prisma.room.findMany({
      include: {
        property: true,
        contracts: {
          where: { status: "ACTIVE" },
          orderBy: { signedDate: "desc" },
          take: 1,
          include: {
            customer: true,
            sales: { select: { id: true, fullName: true, phone: true } },
            deposits: true,
          },
        },
      },
      orderBy: { roomNumber: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "SALES", isActive: true },
      select: { id: true, fullName: true, employeeCode: true, kpiTarget: true },
    }),
    readViewings(),
  ]);

  if (isSales) {
    const safeCustomers = customers.map((c) => ({
      ...c,
      email: null,
      idCard: maskIdCard(c.idCard),
    }));
    const safeRooms = rooms.map((r) => ({
      ...r,
      contracts: r.contracts.map((ct) => {
        const isMine = ct.salesId === user.id;
        return {
          ...ct,
          companyRevenue: isMine ? ct.companyRevenue : 0,
          customer: {
            ...ct.customer,
            phone: isMine ? ct.customer.phone : maskPhone(ct.customer.phone),
            email: null,
            idCard: maskIdCard(ct.customer.idCard),
          },
        };
      }),
    }));
    const safeViewings = viewings.filter(
      (v) => v.salesId === user.id || v.onlineSalesId === user.id
    );
    return NextResponse.json({
      customers: safeCustomers,
      properties,
      rooms: safeRooms,
      salesUsers,
      viewings: safeViewings,
    });
  }

  return NextResponse.json({ customers, properties, rooms, salesUsers, viewings });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.entity === "CUSTOMER") {
    const customer = await prisma.customer.create({
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email || null,
        idCard: body.idCard || null,
        source: body.source || "FACEBOOK",
        status: body.status || "POTENTIAL",
        note: body.note || null,
        salesId: body.salesId || user.id,
      },
    });
    return NextResponse.json({ customer }, { status: 201 });
  }

  if (body.entity === "PROPERTY") {
    const property = await prisma.property.create({
      data: {
        name: body.name,
        address: body.address,
        district: body.district,
        landlordName: body.landlordName,
        landlordPhone: body.landlordPhone,
      },
    });
    return NextResponse.json({ property }, { status: 201 });
  }

  if (body.entity === "ROOM") {
    let targetPropertyId = body.propertyId;
    const requestedDistrict = String(body.district || "").trim();

    if (!targetPropertyId || targetPropertyId === "__NEW__") {
      const dist = requestedDistrict || "Bình Thạnh";
      const createdProp = await prisma.property.create({
        data: {
          name: String(body.propertyName || "").trim() || `NDAHome ${dist}`,
          address: String(body.address || "").trim() || dist,
          district: dist,
          landlordName: String(body.landlordName || "").trim() || "Chủ nhà",
          landlordPhone: String(body.landlordPhone || "").trim() || "",
        },
      });
      targetPropertyId = createdProp.id;
    } else if (requestedDistrict) {
      const existingProp = await prisma.property.findUnique({ where: { id: targetPropertyId } });
      if (existingProp && existingProp.district !== requestedDistrict) {
        const createdProp = await prisma.property.create({
          data: {
            name: String(body.propertyName || "").trim() || `${existingProp.name} (${requestedDistrict})`,
            address: String(body.address || "").trim() || existingProp.address || requestedDistrict,
            district: requestedDistrict,
            landlordName: existingProp.landlordName,
            landlordPhone: existingProp.landlordPhone,
          },
        });
        targetPropertyId = createdProp.id;
      }
    }

    const room = await prisma.room.create({
      data: {
        propertyId: targetPropertyId,
        roomNumber: body.roomNumber,
        roomType: body.roomType || "PHONG_TRO",
        floor: Number(body.floor) || 1,
        area: Number(body.area) || 25,
        price: Number(body.price),
        status: "AVAILABLE",
        amenities: body.amenities || null,
        imageUrl: body.imageUrl || null,
      } as Record<string, unknown> as never,
    });
    return NextResponse.json({ room }, { status: 201 });
  }

  if (body.entity === "VIEWING") {
    const room = await prisma.room.findUnique({
      where: { id: body.roomId },
      include: { property: true },
    });
    if (!room) {
      return NextResponse.json({ error: "Không tìm thấy phòng" }, { status: 404 });
    }

    const salesId = body.salesId || user.id;
    const salesUser = await prisma.user.findUnique({
      where: { id: salesId },
      select: { id: true, fullName: true },
    });

    let customerId = body.customerId;
    let customerName = String(body.customerName || "").trim();
    let customerPhone = String(body.customerPhone || "").trim();

    if (!customerId || customerId === "__NEW__") {
      if (!customerName || !customerPhone) {
        return NextResponse.json({ error: "Vui lòng nhập tên và SĐT khách hàng" }, { status: 400 });
      }
      const createdCust = await prisma.customer.create({
        data: {
          fullName: customerName,
          phone: customerPhone,
          source: body.source || "WALK_IN",
          status: "VIEWING",
          salesId,
          note: `Đặt lịch xem phòng ${room.property.name} - ${room.roomNumber}`,
        },
      });
      customerId = createdCust.id;
    } else {
      const existingCust = await prisma.customer.findUnique({ where: { id: customerId } });
      if (existingCust) {
        customerName = existingCust.fullName;
        customerPhone = existingCust.phone;
        if (existingCust.status === "POTENTIAL") {
          await prisma.customer.update({
            where: { id: existingCust.id },
            data: { status: "VIEWING" },
          });
        }
      }
    }

    const viewings = await readViewings();
    const now = new Date();
    const code = `LH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(viewings.length + 1).padStart(2, "0")}`;
    const newViewing: RoomViewingRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      roomId: room.id,
      roomLabel: `${room.property.name} — ${room.roomNumber}`,
      propertyName: room.property.name,
      roomNumber: room.roomNumber,
      roomImage: room.imageUrl || null,
      address: room.property.address || "",
      district: room.property.district,
      price: room.price,
      customerId,
      customerName,
      customerPhone,
      salesId,
      salesName:
        body.hybridMode === "POOL_50_50" || body.hybridMode === "POOL_40_60"
          ? "Kho lịch chờ nhận (50% / 50%)"
          : salesUser?.fullName || user.fullName,
      onlineSalesId: user.id,
      onlineSalesName: user.fullName,
      hybridMode: body.hybridMode || "SELF_100",
      reminderMinutes: Number(body.reminderMinutes) || 30,
      viewingAt: body.viewingAt || now.toISOString(),
      note: body.note || "",
      status: "SCHEDULED",
      createdAt: now.toISOString(),
    };

    viewings.unshift(newViewing);
    await saveViewings(viewings);
    return NextResponse.json({ viewing: newViewing }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (body.entity === "ROOM") {
    const room = await prisma.room.update({
      where: { id: body.id },
      data: {
        roomNumber: body.roomNumber !== undefined ? body.roomNumber : undefined,
        roomType: body.roomType !== undefined ? body.roomType : undefined,
        floor: body.floor !== undefined ? Number(body.floor) : undefined,
        area: body.area !== undefined ? Number(body.area) : undefined,
        amenities: body.amenities !== undefined ? body.amenities : undefined,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : undefined,
        status: body.status !== undefined ? body.status : undefined,
        price: body.price !== undefined ? Number(body.price) : undefined,
      } as Record<string, unknown>,
    });
    if (body.status === "AVAILABLE") {
      await prisma.contract.updateMany({
        where: { roomId: body.id, status: "ACTIVE" },
        data: { status: "COMPLETED" },
      });
    }
    return NextResponse.json({ room });
  }

  if (body.entity === "CUSTOMER") {
    const customer = await prisma.customer.update({
      where: { id: body.id },
      data: {
        fullName: body.fullName !== undefined ? body.fullName : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        email: body.email !== undefined ? body.email : undefined,
        idCard: body.idCard !== undefined ? body.idCard : undefined,
        source: body.source !== undefined ? body.source : undefined,
        status: body.status !== undefined ? body.status : undefined,
        note: body.note !== undefined ? body.note : undefined,
      },
    });
    return NextResponse.json({ customer });
  }

  if (body.entity === "VIEWING") {
    const viewings = await readViewings();
    const idx = viewings.findIndex((v) => v.id === body.id);
    if (idx === -1) return NextResponse.json({ error: "Không tìm thấy lịch hẹn" }, { status: 404 });
    viewings[idx] = { ...viewings[idx], status: body.status || viewings[idx].status };
    await saveViewings(viewings);
    return NextResponse.json({ viewing: viewings[idx] });
  }

  if (body.entity === "PROPERTY") {
    const property = await prisma.property.update({
      where: { id: body.id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        district: body.district !== undefined ? body.district : undefined,
        address: body.address !== undefined ? body.address : undefined,
        landlordName: body.landlordName !== undefined ? body.landlordName : undefined,
        landlordPhone: body.landlordPhone !== undefined ? body.landlordPhone : undefined,
      },
    });
    return NextResponse.json({ property });
  }

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity");
  const id = searchParams.get("id");
  if (!entity || !id) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  if (entity === "PROPERTY") {
    const roomCount = await prisma.room.count({ where: { propertyId: id } });
    if (roomCount > 0) {
      return NextResponse.json(
        { error: `Khu vực này đang có ${roomCount} phòng. Vui lòng xóa hết phòng trong khu vực này trước khi xóa khu vực.` },
        { status: 400 }
      );
    }
    await prisma.property.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (entity === "ROOM") {
    const count = await prisma.contract.count({ where: { roomId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: "Phòng đã có lịch sử hợp đồng, bạn hãy đổi trạng thái sang Trống hoặc Bảo trì thay vì xóa." },
        { status: 400 }
      );
    }
    await prisma.room.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}
