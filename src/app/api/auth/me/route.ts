import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  const userId = session.payload.sub;
  if (!userId) {
    return NextResponse.json({ user: null });
  }

  async function load() {
    return db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, role: true, city: true, pincode: true, permissions: true },
    });
  }

  try {
    const user = await load();
    return NextResponse.json({ user: user });
  } catch {
    // Neon free tier sleeps — wait a moment and try once more (known gotcha)
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const user = await load();
      return NextResponse.json({ user: user });
    } catch {
      return NextResponse.json({ user: null });
    }
  }
}