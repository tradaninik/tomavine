import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quoteIsExpired } from "@/lib/quote";

// POST /api/quote/[token] - the buyer answers a public quotation.
// No login: the unguessable token IS the authorization. Answering a
// lapsed or already-answered quote is refused; accepting also moves
// the underlying lead to "won" for the seller pipeline.
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
    include: { lead: { select: { id: true, status: true } } },
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

  await db.quote.update({
    where: { id: quote.id },
    data: { status: status },
  });

  if (status === "accepted" && quote.lead.status !== "won") {
    await db.bulkLead.update({
      where: { id: quote.leadId },
      data: { status: "won" },
    });
  }

  return NextResponse.json({ ok: true, status: status });
}