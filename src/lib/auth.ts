import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";

export type UserRole = "ADMIN" | "ACCOUNTANT" | "SALES" | "IT" | "MARKETING" | "LANDLORD";

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
  departmentId: string;
  departmentCode: string;
  isTeamLead: boolean;
}

const SESSION_COOKIE = "ndahome_session";

function getSecretKey() {
  const secret = process.env.JWT_SECRET || "ndahome-internal-management-super-secret-key-2026";
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const headerStore = await headers();
  const tabToken = headerStore.get("x-tab-token");
  if (tabToken) {
    const tabPayload = await verifySessionToken(tabToken);
    if (tabPayload) return tabPayload;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { department: true },
  });
  if (!user || !user.isActive) return null;
  return user;
}

export function canAccessFinance(role: UserRole): boolean {
  return role === "ADMIN" || role === "ACCOUNTANT";
}

export function canApproveProposals(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canCheckProposals(role: UserRole): boolean {
  return role === "ADMIN" || role === "ACCOUNTANT";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Giám đốc (Admin)",
  ACCOUNTANT: "Kế toán",
  SALES: "Nhân viên Sales",
  IT: "Nhân viên IT",
  MARKETING: "Nhân viên Marketing",
  LANDLORD: "Chủ trọ / Đối tác",
};

export { SESSION_COOKIE };
