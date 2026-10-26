import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";
import { DELIVERY_STATE_OPTIONS } from "@/lib/states";

// Mission S2 (scope A2/B): the upgraded quote / pre-order request.
// phone is stored canonically as +91XXXXXXXXXX (accepted with or
// without the +91 prefix so both keyboard shapes work), state is a
// fixed dropdown list, neededBy is an optional date, and type splits
// BULK (in-stock, big qty → quote) from PREORDER (out-of-stock line
// → nursery confirms by call/WhatsApp; no payment is ever taken).
const Body = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(100000),
  city: z.string().min(2).max(60),
  company: z.string().min(2).max(120),
  notes: z.string().max(1000).optional(),
  phone: z.string().regex(/^(\+91)?[6-9]\d{9}$/),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  state: z.enum([...DELIVERY_STATE_OPTIONS] as [string, ...string[]]),
  neededBy: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: z.enum(["BULK", "PREORDER"]).default("BULK"),
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
      phone: "+91" + body.phone.replace(/\D/g, "").slice(-10),
      pincode: body.pincode,
      state: body.state,
      neededBy: body.neededBy ? new Date(body.neededBy + "T00:00:00.000Z") : null,
      type: body.type,
      status: "new",
    },
  });
  return NextResponse.json({ ok: true, type: body.type });
}
