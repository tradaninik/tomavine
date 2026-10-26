import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";

export async function GET() {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  const products = await db.product.findMany({
    where: { nurseryId: nursery.id },
    select: { id: true, nameEn: true, category: true },
  });

  const productIds = products.map((p) => p.id);

  const leads = await db.bulkLead.findMany({
    where: { productId: { in: productIds } },
    orderBy: { id: "desc" },
    include: {
      quotes: { where: { nurseryId: nursery.id } },
    },
  });

  const productById = new Map(products.map((p) => [p.id, p]));

  return NextResponse.json({
    leads: leads.map((l) => ({
      id: l.id,
      qty: l.qty,
      city: l.city,
      company: l.company,
      phone: l.phone,
      pincode: l.pincode,
      state: l.state,
      neededBy: l.neededBy,
      type: l.type,
      notes: l.notes,
      status: l.status,
      product: productById.get(l.productId) ?? {
        id: l.productId,
        nameEn: "Unknown product",
        category: "unknown",
      },
      quotes: l.quotes.map((q) => ({
        id: q.id,
        amount: q.amount,
        status: q.status,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: { leadId?: string; amount?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  const amount = body.amount;

  if (!leadId) {
    return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  }

  if (amount === undefined || !Number.isInteger(amount) || amount < 1) {
    return NextResponse.json({ error: "Enter a valid quote amount in rupees" }, { status: 400 });
  }

  const ownProducts = await db.product.findMany({
    where: { nurseryId: nursery.id },
    select: { id: true },
  });

  const lead = await db.bulkLead.findFirst({
    where: {
      id: leadId,
      productId: { in: ownProducts.map((p) => p.id) },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await db.quote.create({
    data: {
      leadId: lead.id,
      nurseryId: nursery.id,
      amount: amount,
    },
  });

  await db.bulkLead.update({
    where: { id: lead.id },
    data: { status: "quoted" },
  });

  return NextResponse.json({ ok: true });
}