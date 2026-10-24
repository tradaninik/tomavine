import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import PrintButton from "./print-button";

export const metadata = { title: "Packing slip" };

// Address Json shape — tolerant read: checkout writes
// {name, phone, house, street, city, pincode}; seed rows write
// {name, phone, line1, city, pincode}. Same handling as the orders
// page and the customer order view.
type AddressShape = {
  name?: string;
  phone?: string;
  line1?: string;
  house?: string;
  street?: string;
  city?: string;
  pincode?: string;
};

function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  // Same ownership gate as every seller API: the logged-in SELLER must
  // own the nursery this order belongs to, or the page does not exist.
  const auth = await requireNursery();

  if (!auth) {
    notFound();
  }

  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id: id, nurseryId: auth.nursery.id },
    include: {
      items: true,
      payment: true,
      nursery: true,
      user: { select: { name: true, phone: true } },
    },
  });

  if (!order) {
    notFound();
  }

  const addr = (order.address ?? {}) as AddressShape;
  const addrLine = addr.line1 ?? [addr.house, addr.street].filter(Boolean).join(", ");
  const buyerName = addr.name ?? order.user.name ?? "Customer";
  const buyerPhone = addr.phone ?? order.user.phone;
  const meta = order.meta as { cod?: boolean } | null;
  const isCod = (meta !== null && meta.cod === true) || order.payment?.method === "cod";
  const placedOn = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div>
      {/*
        Print rules for the A4 sheet: drop the seller nav + the screen
        controls, remove the dashboard padding, and let the slip fill
        the printed page. Plain <style> tag — no globals.css changes.
      */}
      <style>{`
        @media print {
          header, nav { display: none !important; }
          .no-print { display: none !important; }
          main { max-width: none !important; padding: 0 !important; }
          body { background: #ffffff !important; }
          .slip-sheet { box-shadow: none !important; max-width: none !important; margin: 0 !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[186mm] flex-wrap items-center justify-between gap-2">
        <Link href="/seller/orders" className="text-sm font-bold text-[#2F6B3F] hover:underline">
          ← Back to orders
        </Link>
        <PrintButton />
      </div>

      {/* A4-friendly sheet: ~186mm content column, black on white,
          solid borders so it prints cleanly on any printer. */}
      <div className="slip-sheet mx-auto max-w-[186mm] bg-white p-8 text-black shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-black pb-4">
          <div>
            <p className="text-xl font-bold">{order.nursery.name}</p>
            <p className="mt-1 text-sm">
              {[order.nursery.area, order.nursery.city].filter(Boolean).join(", ")}
              {order.nursery.pincode ? ` — ${order.nursery.pincode}` : ""}
            </p>
            <p className="text-sm">Phone {order.nursery.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-black/60">Packing slip</p>
            <p className="mt-1 text-lg font-bold">{order.code}</p>
            <p className="text-sm">{placedOn}</p>
            <p className="mt-1 text-sm font-semibold">{statusText(order.status)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
              {order.mode === "PICKUP" ? "Customer" : "Deliver to"}
            </p>
            <p className="mt-1 font-semibold">{buyerName}</p>
            {order.mode === "DELIVERY" && addrLine ? <p>{addrLine}</p> : null}
            {order.mode === "DELIVERY" ? (
              <p>{[addr.city, addr.pincode].filter(Boolean).join(" — ")}</p>
            ) : null}
            <p>Phone {buyerPhone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/60">Fulfilment</p>
            <p className="mt-1 font-semibold">{order.mode === "PICKUP" ? "Nursery pickup" : "Home delivery"}</p>
            <p>{isCod ? "Cash on delivery" : "Paid online"}</p>
            {order.deliveryOtp ? (
              <p className="font-semibold">Delivery PIN {order.deliveryOtp} — collect from buyer</p>
            ) : null}
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1.5 pr-2 font-semibold">Item</th>
              <th className="w-12 py-1.5 pr-2 text-right font-semibold">Qty</th>
              <th className="w-20 py-1.5 pr-2 text-right font-semibold">Rate</th>
              <th className="w-24 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b border-black/20 align-top">
                <td className="py-1.5 pr-2">
                  {it.nameSnap}
                  {it.vlabel ? <span className="text-black/60"> · {it.vlabel}</span> : null}
                </td>
                <td className="py-1.5 pr-2 text-right">{it.qty}</td>
                <td className="py-1.5 pr-2 text-right">{inr(it.unitPrice)}</td>
                <td className="py-1.5 text-right">{inr(it.qty * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-[280px] text-sm">
          <div className="flex justify-between py-0.5">
            <span>Subtotal</span>
            <span>{inr(order.subtotal)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>Delivery</span>
            <span>{inr(order.deliveryFee)}</span>
          </div>
          {order.discount > 0 ? (
            <div className="flex justify-between py-0.5">
              <span>Discount</span>
              <span>−{inr(order.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between py-0.5">
            <span>GST</span>
            <span>{inr(order.tax)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-black pt-1.5 text-base font-bold">
            <span>Total</span>
            <span>{inr(order.total)}</span>
          </div>
        </div>

        {isCod ? (
          <div className="mt-4 border-2 border-black p-3 text-center">
            <p className="text-sm font-bold uppercase tracking-wide">Cash on delivery — collect {inr(order.total)}</p>
          </div>
        ) : null}

        <p className="mt-6 border-t border-black/20 pt-3 text-center text-sm font-semibold">Packed with care 🌱</p>
      </div>
    </div>
  );
}

// Short, print-friendly status wording (server-side only — the
// dashboard Pill/statusLabel are client-side UI kit).
function statusText(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending confirmation";
    case "CONFIRMED":
      return "Confirmed";
    case "PREPARING":
      return "Being prepared";
    case "OUT_FOR_DELIVERY":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}
