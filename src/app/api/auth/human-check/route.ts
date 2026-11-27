import { NextResponse } from "next/server";
import {
  GUARD_ICONS,
  signChallengeToken,
  verifyChallengeToken,
  signHumanVerifiedToken,
} from "@/lib/humanGuard";

export async function GET() {
  const shuffled = [...GUARD_ICONS].sort(() => Math.random() - 0.5);
  const target = shuffled[Math.floor(Math.random() * shuffled.length)];
  const challengeToken = await signChallengeToken(target.id);

  return NextResponse.json({
    challengeToken,
    targetId: target.id,
    targetLabel: target.label,
    options: shuffled,
  });
}

export async function POST(request: Request) {
  try {
    const { challengeToken, selectedId } = await request.json();
    if (!challengeToken || !selectedId) {
      return NextResponse.json({ error: "Thiếu dữ liệu xác thực." }, { status: 400 });
    }

    const expectedId = await verifyChallengeToken(String(challengeToken));
    if (!expectedId) {
      return NextResponse.json(
        { error: "Phiên xác thực đã hết hạn, vui lòng thử lại." },
        { status: 400 }
      );
    }

    if (expectedId !== selectedId) {
      return NextResponse.json(
        { error: "Biểu tượng chưa đúng, vui lòng chọn lại." },
        { status: 400 }
      );
    }

    const humanToken = await signHumanVerifiedToken();
    return NextResponse.json({ verified: true, humanToken });
  } catch {
    return NextResponse.json({ error: "Lỗi xác thực AI Guard." }, { status: 500 });
  }
}
