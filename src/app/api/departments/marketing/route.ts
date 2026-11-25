import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [campaigns, leads, mktUsers] = await Promise.all([
    prisma.marketingCampaign.findMany({
      include: { manager: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { source: { in: ["FACEBOOK", "TIKTOK"] } },
      include: { sales: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "MARKETING", isActive: true },
      select: { id: true, fullName: true },
    }),
  ]);

  return NextResponse.json({ campaigns, leads, mktUsers });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const campaign = await prisma.marketingCampaign.create({
    data: {
      code: generateCode("MKT"),
      name: body.name,
      channel: body.channel || "FACEBOOK_ADS",
      budget: Number(body.budget) || 0,
      spent: Number(body.spent) || 0,
      leadsCount: Number(body.leadsCount) || 0,
      conversions: Number(body.conversions) || 0,
      status: "RUNNING",
      managerId: body.managerId || user.id,
      note: body.note || null,
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
