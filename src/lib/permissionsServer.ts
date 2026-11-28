import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  getDefaultPermissionMatrix,
  ModuleKey,
  PermissionAction,
  PermissionConfigData,
  PermissionSet,
  PERMISSION_MODULES,
  RoleKey,
} from "./permissions";

const PERMISSIONS_FILE = path.join(process.cwd(), "data", "permissions-matrix.json");

export async function readPermissionConfig(): Promise<PermissionConfigData> {
  const defaults = getDefaultPermissionMatrix();
  try {
    const raw = await readFile(PERMISSIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PermissionConfigData>;
    return {
      matrix: { ...defaults, ...(parsed.matrix || {}) },
      userOverrides: parsed.userOverrides || {},
    };
  } catch {
    return {
      matrix: defaults,
      userOverrides: {},
    };
  }
}

export async function getEffectivePermissions(
  userId: string,
  role: string,
  employmentType?: string | null
): Promise<Record<ModuleKey, PermissionSet>> {
  const config = await readPermissionConfig();
  const defaults = getDefaultPermissionMatrix();
  const rawKey = employmentType === "INTERN" ? "INTERN" : role;
  const roleKey = (rawKey in defaults ? rawKey : "SALES") as RoleKey;
  const roleMap = config.matrix[roleKey] || defaults[roleKey];
  const userMap = config.userOverrides[userId] || {};

  const result = {} as Record<ModuleKey, PermissionSet>;
  for (const m of PERMISSION_MODULES) {
    result[m.key] = userMap[m.key] || roleMap[m.key] || defaults[roleKey][m.key];
  }

  // Đảm bảo Admin luôn truy cập được trang Nhân sự & Ma trận phân quyền để không bị tự khóa
  if (role === "ADMIN") {
    result.employees = { ...result.employees, view: true, edit: true };
  }

  return result;
}

export async function hasPermission(
  userId: string,
  role: string,
  moduleKey: ModuleKey,
  action: PermissionAction,
  employmentType?: string | null
): Promise<boolean> {
  const perms = await getEffectivePermissions(userId, role, employmentType);
  return Boolean(perms[moduleKey]?.[action]);
}

const ACTION_VI: Record<PermissionAction, string> = {
  view: "xem",
  create: "thêm mới",
  edit: "chỉnh sửa",
  delete: "xóa",
};

export async function requirePermission(
  user: { id: string; role: string; employmentType?: string | null } | null,
  moduleKey: ModuleKey,
  action: PermissionAction
): Promise<NextResponse | null> {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ok = await hasPermission(user.id, user.role, moduleKey, action, user.employmentType);
  if (!ok) {
    return NextResponse.json(
      { error: `Bạn không có quyền ${ACTION_VI[action]} ở phân hệ này (theo Ma trận Phân quyền).` },
      { status: 403 }
    );
  }
  return null;
}
