import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

const Body = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(100000),
  city: z.string().min(2).max(60),
  company: z.string().min(2).max(120),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const body = parsed.data;
  const product = await db.product.findFirst({
    where: { id: body.productId, hidden: false, nursery: { status: "VERIFIED" } },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await db.bulkLead.create({
    data: {
      productId: body.productId,
      qty: body.qty,
      city: body.city,
      company: body.company,
      notes: body.notes ?? null,
      status: "new",
    },
  });
  return NextResponse.json({ ok: true });
}