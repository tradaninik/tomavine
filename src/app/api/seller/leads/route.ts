import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import { isLeadStatus } from "@/lib/quote";

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
    // Mission S3: RFQ leads carry an item list and no productId - with
    // a single verified nursery they belong to this console. Product
    // leads stay scoped to this nursery's own products.
    where: { OR: [{ productId: { in: productIds } }, { type: "RFQ" }] },
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
      product: l.productId
        ? productById.get(l.productId) ?? {
            id: l.productId,
            nameEn: "Unknown product",
            category: "unknown",
          }
        : null,
      items: Array.isArray(l.items) ? l.items : [],
      quotes: l.quotes.map((q) => ({
        id: q.id,
        amount: q.amount,
        total: q.total,
        transport: q.transport,
        status: q.status,
        validUntil: q.validUntil,
        token: q.token,
        createdAt: q.createdAt,
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
      OR: [
        { id: leadId, productId: { in: ownProducts.map((p) => p.id) } },
        { id: leadId, type: "RFQ" },
      ],
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

// Mission S4: lead pipeline. Sellers move a lead along
// new -> contacted -> quoted -> won / lost. "quoted" is also set
// automatically when a quotation is sent and "won" when the buyer
// accepts it on the public quote page.
export async function PATCH(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery, session } = auth;

  let body: { leadId?: string; status?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  const status = typeof body.status === "string" ? body.status : "";

  if (!leadId) {
    return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  }

  if (!isLeadStatus(status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }

  const ownProducts = await db.product.findMany({
    where: { nurseryId: nursery.id },
    select: { id: true },
  });

  const lead = await db.bulkLead.findFirst({
    where: {
      OR: [
        { id: leadId, productId: { in: ownProducts.map((p) => p.id) } },
        { id: leadId, type: "RFQ" },
      ],
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await db.bulkLead.update({
    where: { id: lead.id },
    data: { status: status },
  });

  await db.auditLog.create({
    data: {
      actorId: String(session.payload.sub),
      action: "lead.status",
      entity: "BulkLead:" + lead.id,
      meta: { from: lead.status, to: status, source: "seller" },
    },
  });

  return NextResponse.json({ ok: true });
}