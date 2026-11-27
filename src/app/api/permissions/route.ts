import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getDefaultPermissionMatrix,
  PermissionConfigData,
} from "@/lib/permissions";

const PERMISSIONS_FILE = path.join(process.cwd(), "data", "permissions-matrix.json");

async function readPermissionConfig(): Promise<PermissionConfigData> {
  try {
    const raw = await readFile(PERMISSIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PermissionConfigData>;
    return {
      matrix: parsed.matrix || getDefaultPermissionMatrix(),
      userOverrides: parsed.userOverrides || {},
    };
  } catch {
    return {
      matrix: getDefaultPermissionMatrix(),
      userOverrides: {},
    };
  }
}

async function savePermissionConfig(data: PermissionConfigData) {
  await mkdir(path.dirname(PERMISSIONS_FILE), { recursive: true });
  await writeFile(PERMISSIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await readPermissionConfig();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Giám đốc (Admin) mới được cấu hình phân quyền" }, { status: 403 });
  }

  const body = await request.json();
  const current = await readPermissionConfig();

  const next: PermissionConfigData = {
    matrix: body.matrix || current.matrix,
    userOverrides: body.userOverrides !== undefined ? body.userOverrides : current.userOverrides,
  };

  await savePermissionConfig(next);

  await logAudit({
    userId: user.id,
    action: "UPDATE_PERMISSIONS",
    entity: "Permissions",
    details: body.userId
      ? `Cập nhật quyền riêng cho nhân sự ID ${body.userId}`
      : "Cập nhật Ma trận Phân quyền (RBAC) toàn hệ thống",
  });

  return NextResponse.json({ ok: true, ...next });
}
