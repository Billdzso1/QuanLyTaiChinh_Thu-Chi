import { prisma } from "./prisma";

let kvInitPromise: Promise<void> | null = null;
let fileInitPromise: Promise<void> | null = null;

async function ensureKvTable() {
  if (!kvInitPromise) {
    kvInitPromise = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AppKvStore" (
          "key" TEXT PRIMARY KEY,
          "value" TEXT NOT NULL,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((err) => {
        kvInitPromise = null;
        throw err;
      });
  }
  await kvInitPromise;
}

async function ensureFileTable() {
  if (!fileInitPromise) {
    fileInitPromise = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AppFileStore" (
          "fileName" TEXT PRIMARY KEY,
          "mimeType" TEXT NOT NULL,
          "contentBase64" TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined)
      .catch((err) => {
        fileInitPromise = null;
        throw err;
      });
  }
  await fileInitPromise;
}

export async function getKvJson<T>(key: string): Promise<T | null> {
  await ensureKvTable();
  const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(
    `SELECT "value" FROM "AppKvStore" WHERE "key" = $1 LIMIT 1`,
    key
  );
  if (!rows || rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].value) as T;
  } catch {
    return null;
  }
}

export async function setKvJson<T>(key: string, value: T): Promise<void> {
  await ensureKvTable();
  const serialized = JSON.stringify(value);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AppKvStore" ("key", "value", "updatedAt")
     VALUES ($1, $2, NOW())
     ON CONFLICT ("key")
     DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`,
    key,
    serialized
  );
}

export async function saveDbFile(fileName: string, mimeType: string, data: Buffer): Promise<void> {
  await ensureFileTable();
  const b64 = data.toString("base64");
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AppFileStore" ("fileName", "mimeType", "contentBase64", "createdAt")
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT ("fileName")
     DO UPDATE SET "mimeType" = EXCLUDED."mimeType", "contentBase64" = EXCLUDED."contentBase64"`,
    fileName,
    mimeType,
    b64
  );
}

export async function getDbFile(fileName: string): Promise<{ mimeType: string; data: Buffer } | null> {
  await ensureFileTable();
  const rows = await prisma.$queryRawUnsafe<{ mimeType: string; contentBase64: string }[]>(
    `SELECT "mimeType", "contentBase64" FROM "AppFileStore" WHERE "fileName" = $1 LIMIT 1`,
    fileName
  );
  if (!rows || rows.length === 0) return null;
  return {
    mimeType: rows[0].mimeType,
    data: Buffer.from(rows[0].contentBase64, "base64"),
  };
}
