import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { quoteIsExpired, quoteTotalOf } from "@/lib/quote";
import QuoteView from "./quote-view";
import type { QuoteViewProps } from "./quote-view";

export const metadata = {
  title: "Tomavine - Quotation",
  description: "Your plant quotation from a verified Tomavine partner nursery.",
};

// Mission S4: public buyer quote page. No login - the unguessable
// token in the URL is the authorization. First visit marks the quote
// "viewed" so the seller sees it was opened. Expired is computed at
// read time, never stored.
export default async function QuoteTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const quote = await db.quote.findUnique({
    where: { token: token },
    include: {
      nursery: { select: { name: true, phone: true } },
      lead: { select: { city: true, company: true } },
    },
  });

  if (!quote) {
    notFound();
  }

  let status = quote.status;
  let viewedAt = quote.viewedAt;

  if (status === "sent" && viewedAt === null) {
    const now = new Date();
    await db.quote.update({
      where: { id: quote.id },
      data: { status: "viewed", viewedAt: now },
    });
    status = "viewed";
    viewedAt = now;
  }

  const props = {
    token: String(token),
    ref: String(token).slice(0, 8).toUpperCase(),
    status: status,
    expired: quoteIsExpired({ validUntil: quote.validUntil, status: status }),
    nurseryName: quote.nursery.name,
    nurseryPhone: quote.nursery.phone,
    buyerName: quote.lead.company,
    city: quote.lead.city,
    createdAt: quote.createdAt.toISOString(),
    validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
    note: quote.note,
    transport: quote.transport,
    total: quoteTotalOf(quote),
    items: (Array.isArray(quote.items) ? quote.items : []) as unknown as QuoteViewProps["items"],
  };

  return <QuoteView quote={props} />;
}