import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getDbFile, getKvJsonWithFallback, saveDbFile, setKvJson } from "@/lib/dbStore";

const LOGO_DIR = path.join(process.cwd(), "data", "logo");
const CONFIG_FILE = path.join(LOGO_DIR, "config.json");
const LOGO_CONFIG_KV_KEY = "company_logo_config";

interface LogoConfig {
  fileName?: string | null;
  mimeType?: string | null;
  externalUrl?: string | null;
  updatedAt?: number;
}

async function getConfig(): Promise<LogoConfig> {
  return getKvJsonWithFallback<LogoConfig>(LOGO_CONFIG_KV_KEY, CONFIG_FILE, {});
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cfg = await getConfig();

  if (searchParams.get("raw") === "1") {
    if (!cfg.fileName) {
      return new NextResponse("Not found", { status: 404 });
    }
    try {
      const dbFile = await getDbFile(cfg.fileName);
      if (dbFile) {
        return new NextResponse(new Uint8Array(dbFile.data), {
          headers: {
            "Content-Type": dbFile.mimeType || cfg.mimeType || "image/png",
            "Cache-Control": "no-store",
          },
        });
      }
    } catch {
      // Fallback to local filesystem below
    }
    try {
      const bytes = await readFile(path.join(LOGO_DIR, cfg.fileName));
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": cfg.mimeType || "image/png",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const logoUrl = cfg.fileName
    ? `/api/settings/logo?raw=1&v=${cfg.updatedAt || 1}`
    : cfg.externalUrl || null;

  return NextResponse.json({ logoUrl });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Giám đốc mới có quyền thay đổi logo công ty" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";
  const updatedAt = Date.now();

  let newConfig: LogoConfig = { updatedAt };
  let logoUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Vui lòng chọn tệp ảnh logo" }, { status: 400 });
    }
    const ext = path.extname(file.name) || ".png";
    const fileName = `company-logo-${updatedAt}${ext}`;
    const bytes = await file.arrayBuffer();
    const mimeType = file.type || "image/png";
    await saveDbFile(fileName, mimeType, Buffer.from(bytes));
    newConfig = { fileName, mimeType, externalUrl: null, updatedAt };
    logoUrl = `/api/settings/logo?raw=1&v=${updatedAt}`;
  } else {
    const body = await request.json();
    const url = body.logoUrl ? String(body.logoUrl).trim() : null;
    newConfig = { fileName: null, mimeType: null, externalUrl: url, updatedAt };
    logoUrl = url;
  }

  await setKvJson(LOGO_CONFIG_KV_KEY, newConfig);
  await logAudit({
    userId: user.id,
    action: "UPDATE_COMPANY_LOGO",
    entity: "System",
    details: logoUrl ? `Cập nhật logo công ty` : "Khôi phục logo mặc định",
  });

  return NextResponse.json({ logoUrl });
}
