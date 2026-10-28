import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { readTrustMeta } from "@/lib/trust";
import OrderView from "./order-view";
import type { OrderViewProps } from "./order-view";

export const metadata = {
  title: "Tomavine - Order tracking",
  description: "Track your bulk order and confirm delivery.",
};

// Mission S6-A: public buyer order page. No login - the unguessable
// trackToken in the URL is the authorization (quote-page pattern).
// Quote-based orders carry their lines in meta.bulk.items; the
// buyer's single platform action is confirming receipt (order-view
// posts to /api/order/[token]). First read does not mutate anything:
// the timeline is live on every request.
export default async function OrderTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const order = await db.order.findUnique({
    where: { trackToken: token },
    include: {
      nursery: { select: { name: true, phone: true, city: true } },
      user: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    notFound();
  }

  const meta = (order.meta ?? {}) as Record<string, unknown>;
  const bulk =
    meta.bulk !== null && typeof meta.bulk === "object" && !Array.isArray(meta.bulk)
      ? (meta.bulk as Record<string, unknown>)
      : {};
  const rawItems = Array.isArray(bulk.items) ? bulk.items : [];
  const items = rawItems.map((x, ix) => {
    const r = (x !== null && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return {
      name: typeof r.name === "string" ? r.name : "-",
      qty: Number(r.qty) || 0,
      unit: Number(r.unit) || 0,
      note: typeof r.note === "string" && r.note.length > 0 ? r.note : null,
    };
  });

  const addr = (order.address ?? {}) as Record<string, unknown>;
  const trust = readTrustMeta(order.meta);

  const props: OrderViewProps = {
    token: String(token),
    code: order.code,
    status: order.status,
    nurseryName: order.nursery.name,
    nurseryPhone: order.nursery.phone,
    buyerName: typeof addr.name === "string" ? addr.name : (order.user.name ?? ""),
    city: typeof addr.city === "string" ? addr.city : "",
    placedAt: order.createdAt.toISOString(),
    promisedDate: trust.promisedDate ?? null,
    deliveryOtp: order.deliveryOtp,
    items: items,
    transport: order.deliveryFee,
    subtotal: order.subtotal,
    total: order.total,
    note: typeof bulk.quoteNote === "string" ? bulk.quoteNote : null,
    buyerConfirmedAt: typeof meta.buyerConfirmedAt === "string" ? meta.buyerConfirmedAt : null,
    events: order.events.map((ev) => ({
      id: ev.id,
      status: ev.status,
      note: ev.note,
      actorRole: ev.actorRole,
      createdAt: ev.createdAt.toISOString(),
    })),
  };

  return <OrderView order={props} />;
}