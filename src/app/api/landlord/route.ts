import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/permissionsServer";

function normalizeText(s?: string | null): string {
  return String(s || "").trim().toLowerCase();
}

function isOwnedByLandlord(
  prop: { landlordPhone: string; landlordName: string },
  user: { phone?: string | null; fullName: string }
): boolean {
  const uPhone = normalizeText(user.phone);
  const pPhone = normalizeText(prop.landlordPhone);
  if (uPhone && pPhone && uPhone === pPhone) return true;
  const uName = normalizeText(user.fullName);
  const pName = normalizeText(prop.landlordName);
  if (uName && pName && (pName === uName || pName.includes(uName) || uName.includes(pName))) {
    return true;
  }
  return false;
}

export async function GET() {
  const user = await getCurrentUser();
  const denied = await requirePermission(user, "landlord", "view");
  if (denied) return denied;
  if (!user || (user.role !== "LANDLORD" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Chỉ tài khoản Chủ trọ mới được truy cập" }, { status: 403 });
  }

  const allProperties = await prisma.property.findMany({
    include: {
      rooms: {
        orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
        include: {
          contracts: {
            where: { status: { in: ["RESERVED", "ACTIVE", "FORFEITED", "CLOSED"] } },
            orderBy: { signedDate: "desc" },
            include: {
              customer: { select: { fullName: true, phone: true, idCard: true, email: true } },
              sales: { select: { fullName: true } },
              deposits: true,
            },
          },
        },
      },
    },
    orderBy: [{ district: "asc" }, { name: "asc" }],
  });

  const properties = allProperties;

  const rooms = properties.flatMap((p) =>
    p.rooms.map((r) => ({
      ...r,
      propertyName: p.name,
      district: p.district,
      address: p.address,
      landlordName: p.landlordName,
      landlordPhone: p.landlordPhone,
    }))
  );

  const contracts = rooms.flatMap((r) =>
    r.contracts.map((c) => ({
      ...c,
      roomNumber: r.roomNumber,
      propertyName: r.propertyName,
      district: r.district,
      landlordName: r.landlordName,
      landlordPhone: r.landlordPhone,
    }))
  );

  const deposits = contracts.flatMap((c) => c.deposits);
  const totalLandlordShare = deposits.reduce((s, d) => s + d.landlordShare, 0);
  const paidToLandlord = deposits
    .filter((d) => d.landlordPayoutStatus === "PAID")
    .reduce((s, d) => s + d.landlordPaidAmount, 0);
  const unpaidToLandlord = Math.max(0, totalLandlordShare - paidToLandlord);

  return NextResponse.json({
    properties,
    rooms,
    contracts,
    stats: {
      totalProperties: properties.length,
      totalRooms: rooms.length,
      availableRooms: rooms.filter((r) => r.status === "AVAILABLE").length,
      reservedRooms: rooms.filter((r) => r.status === "RESERVED").length,
      rentedRooms: rooms.filter((r) => r.status === "RENTED").length,
      maintenanceRooms: rooms.filter((r) => r.status === "MAINTENANCE").length,
      totalLandlordShare,
      paidToLandlord,
      unpaidToLandlord,
    },
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

  if (body.entity === "PROPERTY") {
    const name = String(body.name || "").trim();
    const district = String(body.district || "").trim();
    const address = String(body.address || "").trim();
    if (!name || !district || !address) {
      return NextResponse.json({ error: "Vui lòng nhập tên khu nhà, quận và địa chỉ" }, { status: 400 });
    }

    const created = await prisma.property.create({
      data: {
        name,
        district,
        address,
        landlordName: String(body.landlordName || user.fullName).trim(),
        landlordPhone: String(body.landlordPhone || user.phone || "").trim(),
        note: body.note ? String(body.note) : null,
      },
    });

    await logAudit({
      userId: user.id,
      action: "LANDLORD_CREATE_PROPERTY",
      entity: "Property",
      entityId: created.id,
      details: `${user.fullName} thêm khu nhà: ${created.name} (${created.district})`,
    });

    return NextResponse.json({ property: created }, { status: 201 });
  }

  if (body.entity === "ROOM") {
    const prop = await prisma.property.findUnique({ where: { id: String(body.propertyId) } });
    if (!prop) return NextResponse.json({ error: "Không tìm thấy khu nhà" }, { status: 404 });

    const created = await prisma.room.create({
      data: {
        propertyId: prop.id,
        roomNumber: String(body.roomNumber || "").trim(),
        roomType: String(body.roomType || "PHONG_TRO"),
        floor: Number(body.floor || 1),
        area: Number(body.area || 25),
        price: Number(body.price ?? body.monthlyPrice ?? 0),
        amenities: body.amenities ? String(body.amenities) : null,
        imageUrl: body.imageUrl ? String(body.imageUrl) : null,
        status: body.status === "MAINTENANCE" ? "MAINTENANCE" : "AVAILABLE",
      },
    });

    await logAudit({
      userId: user.id,
      action: "LANDLORD_CREATE_ROOM",
      entity: "Room",
      entityId: created.id,
      details: `${user.fullName} thêm phòng ${created.roomNumber} (${prop.name})`,
    });

    return NextResponse.json({ room: created }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  const denied = await requirePermission(user, "landlord", "edit");
  if (denied) return denied;
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.entity === "PROPERTY") {
    const prop = await prisma.property.findUnique({ where: { id: String(body.id) } });
    if (!prop) return NextResponse.json({ error: "Không tìm thấy khu nhà" }, { status: 404 });

    const updated = await prisma.property.update({
      where: { id: prop.id },
      data: {
        name: body.name !== undefined ? String(body.name).trim() : prop.name,
        district: body.district !== undefined ? String(body.district).trim() : prop.district,
        address: body.address !== undefined ? String(body.address).trim() : prop.address,
        landlordName: body.landlordName !== undefined ? String(body.landlordName).trim() : prop.landlordName,
        landlordPhone: body.landlordPhone !== undefined ? String(body.landlordPhone).trim() : prop.landlordPhone,
        note: body.note !== undefined ? (body.note ? String(body.note) : null) : prop.note,
      },
    });
    return NextResponse.json({ property: updated });
  }

  if (body.entity === "ROOM") {
    const room = await prisma.room.findUnique({
      where: { id: String(body.id) },
      include: { property: true },
    });
    if (!room) return NextResponse.json({ error: "Không tìm thấy phòng" }, { status: 404 });

    const allowedStatus =
      body.status && ["AVAILABLE", "MAINTENANCE"].includes(body.status) ? body.status : room.status;

    const updated = await prisma.room.update({
      where: { id: room.id },
      data: {
        roomNumber: body.roomNumber !== undefined ? String(body.roomNumber).trim() : room.roomNumber,
        roomType: body.roomType !== undefined ? String(body.roomType) : room.roomType,
        floor: body.floor !== undefined ? Number(body.floor) : room.floor,
        area: body.area !== undefined ? Number(body.area) : room.area,
        price:
          body.price !== undefined
            ? Number(body.price)
            : body.monthlyPrice !== undefined
              ? Number(body.monthlyPrice)
              : room.price,
        amenities: body.amenities !== undefined ? (body.amenities ? String(body.amenities) : null) : room.amenities,
        imageUrl: body.imageUrl !== undefined ? (body.imageUrl ? String(body.imageUrl) : null) : room.imageUrl,
        status: allowedStatus,
      },
    });
    return NextResponse.json({ room: updated });
  }

  if (body.entity === "CHECKOUT_CONTRACT") {
    const contract = await prisma.contract.findUnique({
      where: { id: String(body.contractId) },
      include: { deposits: true, room: true, customer: true },
    });
    if (!contract) return NextResponse.json({ error: "Không tìm thấy hợp đồng" }, { status: 404 });

    const finalUtilityFee = Math.max(0, Number(body.finalUtilityFee || 0));
    const damageFee = Math.max(0, Number(body.damageFee || 0));
    const baseDeposit = contract.deposits[0]?.collectedAmount || contract.depositAmount;
    const refundAmount = Math.max(0, baseDeposit - finalUtilityFee - damageFee);

    const summary = `Thanh lý trả phòng: Cọc ${baseDeposit.toLocaleString("vi-VN")}đ - Điện nước cuối ${finalUtilityFee.toLocaleString("vi-VN")}đ - Phí hư hỏng ${damageFee.toLocaleString("vi-VN")}đ = Hoàn khách ${refundAmount.toLocaleString("vi-VN")}đ`;
    const extraNote = [String(body.note || "").trim(), summary].filter(Boolean).join(" • ");
    const nextNote = [contract.note, extraNote].filter(Boolean).join(" • ");

    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: "CLOSED", note: nextNote },
    });
    await prisma.room.update({
      where: { id: contract.roomId },
      data: { status: "AVAILABLE" },
    });
    await prisma.customer.update({
      where: { id: contract.customerId },
      data: { status: "POTENTIAL" },
    });

    await logAudit({
      userId: user.id,
      action: "LANDLORD_CHECKOUT_CONTRACT",
      entity: "Contract",
      entityId: contract.id,
      details: `${contract.contractCode}: ${summary}`,
    });

    return NextResponse.json({ refundAmount, summary });
  }

  if (body.entity === "RENEW_CONTRACT") {
    const contract = await prisma.contract.findUnique({ where: { id: String(body.contractId) } });
    if (!contract) return NextResponse.json({ error: "Không tìm thấy hợp đồng" }, { status: 404 });

    const addMonths = Number(body.addMonths) === 6 ? 6 : 12;
    const nextEnd = new Date(contract.endDate);
    nextEnd.setMonth(nextEnd.getMonth() + addMonths);

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        endDate: nextEnd,
        durationMonths: contract.durationMonths + addMonths,
        note: [contract.note, `Gia hạn thêm ${addMonths} tháng đến ${nextEnd.toLocaleDateString("vi-VN")}`]
          .filter(Boolean)
          .join(" • "),
      },
    });

    await logAudit({
      userId: user.id,
      action: "LANDLORD_RENEW_CONTRACT",
      entity: "Contract",
      entityId: contract.id,
      details: `Gia hạn HĐ ${contract.contractCode} thêm ${addMonths} tháng`,
    });

    return NextResponse.json({ contract: updated });
  }

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}
