import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/finance";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [projects, tasks, devices, itUsers] = await Promise.all([
    prisma.project.findMany({
      include: { manager: { select: { id: true, fullName: true } }, department: true, _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      include: {
        assignee: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
        department: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.device.findMany({
      include: { assignedTo: { select: { id: true, fullName: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, role: true, departmentId: true },
    }),
  ]);

  return NextResponse.json({ projects, tasks, devices, users: itUsers });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.entity === "PROJECT") {
    const project = await prisma.project.create({
      data: {
        code: generateCode("PRJ"),
        name: body.name,
        description: body.description || null,
        departmentId: body.departmentId || user.departmentId,
        managerId: body.managerId || user.id,
        budget: Number(body.budget) || 0,
        status: user.role === "ADMIN" ? "IN_PROGRESS" : "PENDING_APPROVAL",
      },
    });
    return NextResponse.json({ project }, { status: 201 });
  }

  if (body.entity === "TASK") {
    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        priority: body.priority || "MEDIUM",
        status: "TODO",
        projectId: body.projectId || null,
        departmentId: body.departmentId || user.departmentId,
        assigneeId: body.assigneeId || user.id,
        createdById: user.id,
      },
    });
    return NextResponse.json({ task }, { status: 201 });
  }

  if (body.entity === "DEVICE") {
    const device = await prisma.device.create({
      data: {
        code: generateCode("DEV"),
        name: body.name,
        category: body.category || "LAPTOP",
        serialNumber: body.serialNumber || null,
        purchaseCost: Number(body.purchaseCost) || 0,
        status: body.assignedToId ? "IN_USE" : "AVAILABLE",
        assignedToId: body.assignedToId || null,
      },
    });
    return NextResponse.json({ device }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (body.entity === "TASK") {
    const task = await prisma.task.update({
      where: { id: body.id },
      data: { status: body.status },
    });
    return NextResponse.json({ task });
  }

  if (body.entity === "PROJECT") {
    const project = await prisma.project.update({
      where: { id: body.id },
      data: {
        status: body.status,
        progress: body.progress !== undefined ? Number(body.progress) : undefined,
      },
    });
    return NextResponse.json({ project });
  }

  return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
}
