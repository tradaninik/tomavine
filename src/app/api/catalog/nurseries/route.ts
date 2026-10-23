import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Pincode-prefix delivery verdicts (no lat/lng in the schema, so this is
// deterministic postal-circle logic):
//   INDIA        -> always delivers ("Ships across India")
//   STATE        -> first 2 digits match (56xxxx vs 56xxxx)
//   CITY/RADIUS  -> first 3 digits match (560103 vs 560088 = same sorting area)
// No match -> nursery stays listed with a pickup-only verdict.
// NOTE: helpers in route files must NOT be exported — Next.js only allows
// HTTP handlers and route config as exports here.

const PIN_RE = /^[1-9]\d{5}$/;

type Verdict = { delivers: boolean; label: string };

function deliveryVerdict(
  nursery: { pincode: string; city: string; scope: string; scopeKm: number | null },
  pincode: string,
): Verdict {
  if (nursery.scope === "INDIA") {
    return { delivers: true, label: "Ships across India" };
  }
  if (nursery.scope === "STATE") {
    if (pincode.slice(0, 2) === nursery.pincode.slice(0, 2)) {
      return { delivers: true, label: "Delivers across your state" };
    }
    return { delivers: false, label: "Pickup only for your pincode" };
  }
  if (pincode.slice(0, 3) === nursery.pincode.slice(0, 3)) {
    if (nursery.scope === "RADIUS" && nursery.scopeKm) {
      return { delivers: true, label: `Local delivery ~${nursery.scopeKm} km around ${nursery.city}` };
    }
    return { delivers: true, label: `Delivers within ${nursery.city}` };
  }
  return { delivers: false, label: `Ships within ${nursery.city} — pickup only for your pincode` };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pincodeParam = url.searchParams.get("pincode") ?? "";
  const pincode = PIN_RE.test(pincodeParam) ? pincodeParam : null;

  const rows = await db.nursery.findMany({
    where: { status: "VERIFIED" },
    include: { _count: { select: { products: { where: { hidden: false } } } } },
    orderBy: { ratingAvg: "desc" },
  });

  let nurseries = rows.map((n) => ({
    id: n.id,
    name: n.name,
    slug: n.slug,
    city: n.city,
    area: n.area,
    pincode: n.pincode,
    scope: n.scope,
    scopeKm: n.scopeKm,
    ratingAvg: n.ratingAvg,
    image: n.image,
    retailOk: n.retailOk,
    bulkOk: n.bulkOk,
    physVerifiedAt: n.physVerifiedAt ? n.physVerifiedAt.toISOString() : null,
    productCount: n._count.products,
    verdict: pincode ? deliveryVerdict(n, pincode) : null,
  }));

  if (pincode) {
    nurseries = nurseries.sort((a, b) => {
      const aDelivers = a.verdict ? a.verdict.delivers : false;
      const bDelivers = b.verdict ? b.verdict.delivers : false;
      if (aDelivers !== bDelivers) {
        return aDelivers ? -1 : 1;
      }
      return b.ratingAvg - a.ratingAvg;
    });
  }

  return NextResponse.json({ nurseries: nurseries, pincode: pincode });
}