import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DELIVERY_STATE_OPTIONS } from "@/lib/states";

// Mission S3 (scope C): public bulk/project RFQ. No login - B2B buyers
// will not create accounts to ask for a price. Anti-spam instead of
// auth: strict zod validation + a hidden honeypot field ("website" -
// anything non-empty is a bot and gets rejected with 400).

const Item = z.object({
  productId: z.string().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(120),
  qty: z.number().int().min(1).max(100000),
  note: z.string().trim().max(200).optional(),
});

const Body = z.object({
  website: z.string().max(0).optional(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^(\+91)?[6-9]\d{9}$/),
  city: z.string().min(2).max(60),
  state: z.enum([...DELIVERY_STATE_OPTIONS] as [string, ...string[]]),
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(Item).min(1).max(50),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const b = parsed.data;

  // Free-text rows are fine; rows referencing a product must be real,
  // visible products (same visibility rule as the enquiry route).
  const ids = [...new Set(b.items.filter((i) => i.productId).map((i) => i.productId as string))];
  if (ids.length > 0) {
    const found = await db.product.findMany({ where: { id: { in: ids }, hidden: false }, select: { id: true } });
    if (found.length !== ids.length) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const items = b.items.map((i) => ({
    name: i.name,
    productId: i.productId ?? null,
    qty: i.qty,
    note: i.note ?? null,
  }));

  await db.bulkLead.create({
    data: {
      productId: null,
      qty: items.reduce((n, i) => n + i.qty, 0),
      city: b.city,
      company: b.name,
      notes: b.notes ?? null,
      phone: "+91" + b.phone.replace(/\D/g, "").slice(-10),
      pincode: b.pincode,
      state: b.state,
      neededBy: b.neededBy ? new Date(b.neededBy + "T00:00:00.000Z") : null,
      type: "RFQ",
      status: "new",
      items: JSON.parse(JSON.stringify(items)),
    },
  });

  return NextResponse.json({ ok: true });
}