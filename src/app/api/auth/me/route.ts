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
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, phone: true, role: true, city: true, pincode: true },
  });
  return NextResponse.json({ user: user });
}