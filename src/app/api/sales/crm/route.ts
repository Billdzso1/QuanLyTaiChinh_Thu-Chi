import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [customers, properties, rooms, salesUsers] = await Promise.all([
    prisma.customer.findMany({
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
  ]);

  return NextResponse.json({ customers, properties, rooms, salesUsers });
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
    const room = await prisma.room.create({
      data: {
        propertyId: body.propertyId,
        roomNumber: body.roomNumber,
        floor: Number(body.floor) || 1,
        area: Number(body.area) || 25,
        price: Number(body.price),
        status: "AVAILABLE",
        amenities: body.amenities || null,
        imageUrl: body.imageUrl || null,
      },
    });
    return NextResponse.json({ room }, { status: 201 });
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
        floor: body.floor !== undefined ? Number(body.floor) : undefined,
        area: body.area !== undefined ? Number(body.area) : undefined,
        amenities: body.amenities !== undefined ? body.amenities : undefined,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : undefined,
        status: body.status !== undefined ? body.status : undefined,
        price: body.price !== undefined ? Number(body.price) : undefined,
      },
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

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity");
  const id = searchParams.get("id");
  if (!entity || !id) return NextResponse.json({ error: "Missing params" }, { status: 400 });

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
