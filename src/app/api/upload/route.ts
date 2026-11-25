import { NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");
  if (!file) return new NextResponse("Missing file", { status: 400 });

  const safeName = path.basename(file);
  try {
    const bytes = await readFile(path.join(UPLOAD_DIR, safeName));
    const ext = path.extname(safeName).toLowerCase();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": MIME_MAP[ext] || "image/png",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Vui lòng chọn tệp hình ảnh" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase() || ".png";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const bytes = await file.arrayBuffer();
  await writeFile(path.join(UPLOAD_DIR, fileName), Buffer.from(bytes));

  return NextResponse.json({ url: `/api/upload?file=${fileName}` });
}
