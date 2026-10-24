import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { districtByCode, deliveryEta, haversineKm } from "@/lib/geo";

// Delivery verdicts + proximity sorting (Location Backbone v1).
//
// Three independent inputs:
//   ?pincode=XXXXXX  -> verdict logic: an explicit NurseryServiceArea
//                       match wins first (mission F — the nursery admin's
//                       own list), otherwise the postal-circle scope logic
//                       (unchanged from the original implementation)
//   ?district=CODE   -> proximity: distance from the district
//                       centroid to each nursery's geo binding
//                       (Nursery.districtCode/lat/lng, backfilled by
//                       scripts/backfill-nursery-geo.mjs), nearest
//                       first with rating as tiebreaker. Both params
//                       can be combined.
//
// NOTE: helpers in route files must NOT be exported — Next.js only
// allows HTTP handlers and route config as exports here.

const PIN_RE = /^[1-9]\d{5}$/;

type Verdict = { delivers: boolean; label: string };

function deliveryVerdict(
  nursery: { pincode: string; city: string; scope: string; scopeKm: number | null },
  pincode: string,
  served: boolean,
): Verdict {
  // The nursery's own service-area list is the most specific truth —
  // a linked pincode delivers even when the scope heuristic wouldn't.
  if (served) {
    return { delivers: true, label: "Delivers to your pincode" };
  }
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

  const districtParam = url.searchParams.get("district") ?? "";
  const district = districtByCode(districtParam);

  const rows = await db.nursery.findMany({
    where: { status: "VERIFIED" },
    include: {
      _count: { select: { products: { where: { hidden: false } } } },
      serviceAreas: { include: { location: { select: { pincode: true, active: true } } } },
    },
    orderBy: { ratingAvg: "desc" },
  });

  const userPoint = district ? { lat: district.lat, lng: district.lng } : null;

  let nurseries = rows.map((n) => {
    const nurseryPoint = n.lat !== null && n.lng !== null ? { lat: n.lat, lng: n.lng } : null;
    const distanceKm = userPoint && nurseryPoint ? haversineKm(userPoint, nurseryPoint) : null;
    const eta = district
      ? deliveryEta({
          userCode: district.code,
          userLatLng: null,
          nurseryCode: n.districtCode,
          nurseryLatLng: nurseryPoint,
        })
      : null;
    const served = pincode
      ? n.serviceAreas.some((sa) => sa.location.active && sa.location.pincode === pincode)
      : false;
    return {
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
      districtCode: n.districtCode,
      productCount: n._count.products,
      serviceAreaCount: n.serviceAreas.length,
      distanceKm: distanceKm,
      eta: eta ? { band: eta.band, minDays: eta.minDays, maxDays: eta.maxDays } : null,
      verdict: pincode ? deliveryVerdict(n, pincode, served) : null,
    };
  });

  if (district) {
    // Nearest first; nurseries without a geo binding keep their spot
    // at the end (rating-ordered) instead of disappearing.
    nurseries = nurseries.sort((a, b) => {
      const aKm = a.distanceKm;
      const bKm = b.distanceKm;
      if (aKm === null && bKm !== null) return 1;
      if (bKm === null && aKm !== null) return -1;
      if (aKm !== null && bKm !== null && aKm !== bKm) return aKm - bKm;
      return b.ratingAvg - a.ratingAvg;
    });
  } else if (pincode) {
    nurseries = nurseries.sort((a, b) => {
      const aDelivers = a.verdict ? a.verdict.delivers : false;
      const bDelivers = b.verdict ? b.verdict.delivers : false;
      if (aDelivers !== bDelivers) {
        return aDelivers ? -1 : 1;
      }
      return b.ratingAvg - a.ratingAvg;
    });
  }

  return NextResponse.json({
    nurseries: nurseries,
    pincode: pincode,
    district: district ? district.code : null,
  });
}
