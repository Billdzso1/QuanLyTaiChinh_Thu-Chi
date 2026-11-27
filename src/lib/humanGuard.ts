import { SignJWT, jwtVerify } from "jose";

const GUARD_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ndahome-secret-key-change-in-production-2026"
);

export type GuardIconId = "HOME" | "KEY" | "SHIELD" | "STAR";

export const GUARD_ICONS: { id: GuardIconId; label: string }[] = [
  { id: "HOME", label: "Ngôi nhà" },
  { id: "KEY", label: "Chìa khóa" },
  { id: "SHIELD", label: "Khiên bảo vệ" },
  { id: "STAR", label: "Ngôi sao" },
];

export async function signChallengeToken(targetId: GuardIconId): Promise<string> {
  return new SignJWT({ purpose: "human-challenge", targetId, nonce: Math.random().toString(36).slice(2) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(GUARD_SECRET);
}

export async function verifyChallengeToken(token: string): Promise<GuardIconId | null> {
  try {
    const { payload } = await jwtVerify(token, GUARD_SECRET);
    if (payload.purpose !== "human-challenge" || typeof payload.targetId !== "string") return null;
    return payload.targetId as GuardIconId;
  } catch {
    return null;
  }
}

export async function signHumanVerifiedToken(): Promise<string> {
  return new SignJWT({ purpose: "human-verified", verified: true, nonce: Math.random().toString(36).slice(2) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(GUARD_SECRET);
}

export async function verifyHumanToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, GUARD_SECRET);
    return payload.purpose === "human-verified" && payload.verified === true;
  } catch {
    return false;
  }
}
