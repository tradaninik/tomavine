import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { notifySellerNewOrder } from "@/lib/notify";
import { newQuoteToken, quoteIsExpired, quoteRef, quoteTotalOf } from "@/lib/quote";

// POST /api/quote/[token] - the buyer answers a public quotation.
// No login: the unguessable token IS the authorization. Answering a
// lapsed or already-answered quote is refused; accepting also moves
// the underlying lead to "won" for the seller pipeline.
//
// Mission S6-A: accepting now also PLACES THE ORDER REQUEST on the
// platform. A PENDING Order row is created with the quotation lines
// carried in meta.bulk.items (quote lines are free text, never
// Product-linked, so no OrderItem rows are written - stock/cancel
// bookkeeping in the seller console iterates order.items and simply
// finds none), a public tracking token for /order/<trackToken>, and
// an opening OrderEvent. The platform becomes the system of record
// for the transaction even though the nursery ships direct to the
// buyer - Tomavine remains the middle layer, never the stockist.

type LeadRow = {
  phone: string | null;
  company: string;
  city: string;
  pincode: string | null;
  state: string | null;
  status: string;
};

type QuoteRow = {
  id: string;
  leadId: string;
  nurseryId: string;
  amount: number;
  total: number;
  transport: number;
  items: Prisma.JsonValue | null;
  note: string | null;
  token: string | null;
  lead: LeadRow;
};

type PlacedOrder = { id: string; code: string; trackToken: string | null };

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  let body: { action?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const quote = await db.quote.findUnique({
    where: { token: token },
    include: { lead: true },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  if (quote.status === "accepted" || quote.status === "declined") {
    return NextResponse.json(
      { error: "This quotation was already answered", status: quote.status },
      { status: 409 },
    );
  }

  if (quoteIsExpired(quote)) {
    return NextResponse.json({ error: "This quotation has expired" }, { status: 410 });
  }

  const status = action === "accept" ? "accepted" : "declined";

  // Flip the quote BEFORE creating the order: a double-click on
  // Accept then hits the 409 guard above, so an order request can
  // never be placed twice for the same quotation.
  await db.quote.update({
    where: { id: quote.id },
    data: { status: status },
  });

  let order: PlacedOrder | null = null;

  if (status === "accepted") {
    order = await placeOrderRequest(quote);
  }

  if (status === "accepted" && quote.lead.status !== "won") {
    await db.bulkLead.update({
      where: { id: quote.leadId },
      data: { status: "won" },
    });
  }

  if (order !== null) {
    try {
      await notifySellerNewOrder(order.id);
    } catch (e) {
      console.error("seller alert failed for order " + order.code, e);
    }
  }

  return NextResponse.json({
    ok: true,
    status: status,
    order: order === null ? null : { code: order.code, trackToken: order.trackToken },
  });
}

// The order request itself. The buyer identity is the lead phone -
// upserted as a User (name = company), so the order also shows under
// /shop/orders the day that phone logs in with OTP. When the lead has
// no phone there is nothing to anchor the account to: the quote
// stays accepted, the nursery sees the lead as won and closes it
// over WhatsApp as before (no order, returns null).
async function placeOrderRequest(quote: QuoteRow): Promise<PlacedOrder | null> {
  const lead = quote.lead;

  if (!lead.phone) {
    return null;
  }

  const buyer = await db.user.upsert({
    where: { phone: lead.phone },
    update: {},
    create: {
      phone: lead.phone,
      name: lead.company.slice(0, 80),
      city: lead.city,
      pincode: lead.pincode,
    },
  });

  const total = quoteTotalOf(quote);
  const subtotal = Math.max(0, total - quote.transport);
  const items: unknown[] = Array.isArray(quote.items) ? (quote.items as unknown[]) : [];
  const trackToken = newQuoteToken();
  const placedNote = "Order request placed from quotation " + quoteRef(quote.token);

  let created: PlacedOrder | null = null;

  for (let attempt = 0; attempt < 3 && created === null; attempt += 1) {
    const code = "NH-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));

    try {
      created = await db.order.create({
        data: {
          code: code,
          userId: buyer.id,
          nurseryId: quote.nurseryId,
          status: "PENDING",
          mode: "DELIVERY",
          subtotal: subtotal,
          deliveryFee: quote.transport,
          tax: 0,
          discount: 0,
          total: total,
          address: {
            name: lead.company,
            phone: lead.phone,
            city: lead.city,
            pincode: lead.pincode,
            state: lead.state,
          } as unknown as Prisma.InputJsonValue,
          trackToken: trackToken,
          meta: {
            bulk: {
              source: "quote",
              quoteId: quote.id,
              leadId: quote.leadId,
              items: items,
              quoteNote: quote.note,
            },
          } as unknown as Prisma.InputJsonValue,
          events: {
            create: [
              {
                status: "PENDING",
                note: placedNote,
                actorRole: Role.CUSTOMER,
              },
            ],
          },
        },
      });
    } catch (e) {
      // NH-YYYY-NNNN code collision or transient failure - retry with
      // a fresh number (the quote is already marked accepted, so the
      // buyer is never asked to click twice).
      console.error("order request create failed, attempt " + (attempt + 1) + " of 3", e);
    }
  }

  if (created === null) {
    console.error("could not place order request for quote " + quote.id);
  }

  return created;
}