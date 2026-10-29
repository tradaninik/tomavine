import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  classify,
  parseLocQuery,
  seasonsForMonth,
  SOIL_CHOICES,
  type AdvisorCandidate,
  type SoilChoice,
  type SvcLocLite,
} from "@/lib/advisor";
import { hiddenCategoryWhere } from "@/lib/catalog";

// GET /api/advisor?month=10&soil=loamy&loc=500001 (pincode, state or town; ?city= still works) — public, read-only.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const monthRaw = Number(sp.get("month"));
  const month = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : new Date().getMonth() + 1;
  const soilParam = sp.get("soil") ?? "unsure";
  const soil = (SOIL_CHOICES as string[]).includes(soilParam) ? (soilParam as SoilChoice) : "unsure";
  const locRaw = (sp.get("loc") ?? sp.get("city") ?? "").slice(0, 60);

  // S6-D: the pincode -> city/state dictionary (active rows only),
  // resolved once per request and shared by every candidate.
  const svcLocs: SvcLocLite[] = await db.serviceLocation.findMany({
    where: { active: true },
    select: { pincode: true, city: true, state: true },
  });

  const hidden = await hiddenCategoryWhere();
  const rows = await db.product.findMany({
    where: { hidden: false, ...(hidden === null ? {} : hidden) },
    select: {
      id: true, nameEn: true, names: true, category: true, priceMin: true, mrp: true,
      stock: true, image: true, care: true, agri: true,
      variants: { select: { id: true, price: true } },
      rescue: { select: { pct: true, expiresAt: true } },
      nursery: {
        select: {
          name: true,
          slug: true,
          city: true,
          area: true,
          pincode: true,
          districtCode: true,
          scope: true,
          serviceAreas: { select: { location: { select: { pincode: true, active: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const loc = parseLocQuery(locRaw, svcLocs);
  const pinState = new Map(svcLocs.map((l) => [l.pincode, l.state]));
  const input = { month, soil, loc, pinState };
  const scored = rows.map((r) => {
    const cand: AdvisorCandidate = {
      ...r,
      nursery: {
        name: r.nursery.name,
        slug: r.nursery.slug,
        city: r.nursery.city,
        area: r.nursery.area,
        pincode: r.nursery.pincode,
        districtCode: r.nursery.districtCode,
        scope: r.nursery.scope,
        servicePincodes: r.nursery.serviceAreas
          .filter((sa) => sa.location.active)
          .map((sa) => sa.location.pincode),
      },
    };
    const v = classify(cand, input);
    return { ...cand, reasons: v.reasons, score: v.score, plantNow: v.plantNow };
  });
  scored.sort((a, b) => b.score - a.score);
  const strip = ({
    score: _s,
    plantNow: _p,
    nursery: { servicePincodes: _sp, ...nursery },
    ...rest
  }: typeof scored[number]) => ({ ...rest, nursery });

  return NextResponse.json({
    month,
    seasons: seasonsForMonth(month),
    location: { echo: loc.echo },
    plantNow: scored.filter((x) => x.plantNow).map(strip),
    later: scored.filter((x) => !x.plantNow).map(strip),
  });
}