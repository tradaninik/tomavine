import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";

export async function GET() {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  const reviews = await db.review.findMany({
    where: { product: { nurseryId: nursery.id } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { nameEn: true } },
      user: { select: { name: true, phone: true } },
    },
  });

  return NextResponse.json({ reviews: reviews });
}

export async function POST(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: { reviewId?: string; reply?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reviewId = typeof body.reviewId === "string" ? body.reviewId : "";
  const reply = typeof body.reply === "string" ? body.reply.trim() : "";

  if (!reviewId) {
    return NextResponse.json({ error: "Missing review id" }, { status: 400 });
  }

  if (reply.length < 1 || reply.length > 500) {
    return NextResponse.json({ error: "Reply must be between 1 and 500 characters" }, { status: 400 });
  }

  const review = await db.review.findFirst({
    where: { id: reviewId, product: { nurseryId: nursery.id } },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  await db.review.update({
    where: { id: review.id },
    data: { reply: reply },
  });

  return NextResponse.json({ ok: true });
}