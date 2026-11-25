import { NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const LOGO_DIR = path.join(process.cwd(), "data", "logo");
const CONFIG_FILE = path.join(LOGO_DIR, "config.json");

interface LogoConfig {
  fileName?: string | null;
  mimeType?: string | null;
  externalUrl?: string | null;
  updatedAt?: number;
}

async function getConfig(): Promise<LogoConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cfg = await getConfig();

  if (searchParams.get("raw") === "1") {
    if (!cfg.fileName) {
      return new NextResponse("Not found", { status: 404 });
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

  await mkdir(LOGO_DIR, { recursive: true });
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
    await writeFile(path.join(LOGO_DIR, fileName), Buffer.from(bytes));
    newConfig = { fileName, mimeType: file.type || "image/png", externalUrl: null, updatedAt };
    logoUrl = `/api/settings/logo?raw=1&v=${updatedAt}`;
  } else {
    const body = await request.json();
    const url = body.logoUrl ? String(body.logoUrl).trim() : null;
    newConfig = { fileName: null, mimeType: null, externalUrl: url, updatedAt };
    logoUrl = url;
  }

  await writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2), "utf-8");
  await logAudit({
    userId: user.id,
    action: "UPDATE_COMPANY_LOGO",
    entity: "System",
    details: logoUrl ? `Cập nhật logo công ty` : "Khôi phục logo mặc định",
  });

  return NextResponse.json({ logoUrl });
}
