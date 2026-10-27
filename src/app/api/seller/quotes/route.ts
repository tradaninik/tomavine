import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import {
  itemsTotal,
  newQuoteToken,
  quoteRef,
  sanitizeItems,
  sanitizeTransport,
  sanitizeValidDays,
} from "@/lib/quote";

// POST /api/seller/quotes - quotation builder (mission S4). The
// seller picks a visible lead, builds item rows (prefilled in the
// console from the buyer list), adds transport, a validity window
// and a note. Stores items + totals + a public token link and moves
// the lead to "quoted". Legacy single-amount quotes (the older POST
// /api/seller/leads) keep working; readers fall back to amount when
// total is 0.
export async function POST(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery, session } = auth;

  let body: {
    leadId?: string;
    items?: unknown;
    transport?: unknown;
    validDays?: unknown;
    note?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId : "";

  if (!leadId) {
    return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  }

  const items = sanitizeItems(body.items);

  if (items === null) {
    return NextResponse.json(
      { error: "Add at least one item with a name, quantity and unit price" },
      { status: 400 },
    );
  }

  const transport = sanitizeTransport(body.transport);
  const validDays = sanitizeValidDays(body.validDays);
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null;

  // Only quote leads this nursery can see (own product leads + RFQs) -
  // the same scoping the leads console itself uses.
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

  const goods = itemsTotal(items);
  const total = goods + transport;
  const token = newQuoteToken();
  const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

  const quote = await db.quote.create({
    data: {
      leadId: lead.id,
      nurseryId: nursery.id,
      amount: goods,
      items: items,
      transport: transport,
      total: total,
      validUntil: validUntil,
      token: token,
      note: note,
      status: "sent",
    },
  });

  await db.bulkLead.update({
    where: { id: lead.id },
    data: { status: "quoted" },
  });

  await db.auditLog.create({
    data: {
      actorId: String(session.payload.sub),
      action: "quote.create",
      entity: "Quote:" + quote.id,
      meta: { leadId: lead.id, items: items.length, total: total, validDays: validDays },
    },
  });

  return NextResponse.json({
    ok: true,
    quote: {
      id: quote.id,
      ref: quoteRef(token),
      total: total,
      validUntil: validUntil,
      token: token,
    },
  });
}