import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { classify, seasonsForMonth, SOIL_CHOICES, type AdvisorCandidate, type SoilChoice } from "@/lib/advisor";

// GET /api/advisor?month=10&soil=loamy&city=Hyderabad — public, read-only.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const monthRaw = Number(sp.get("month"));
  const month = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : new Date().getMonth() + 1;
  const soilParam = sp.get("soil") ?? "unsure";
  const soil = (SOIL_CHOICES as string[]).includes(soilParam) ? (soilParam as SoilChoice) : "unsure";
  const city = (sp.get("city") ?? "").slice(0, 60);

  const rows = await db.product.findMany({
    where: { hidden: false },
    select: {
      id: true, nameEn: true, names: true, category: true, priceMin: true, mrp: true,
      stock: true, image: true, care: true, agri: true,
      variants: { select: { id: true, price: true } },
      rescue: { select: { pct: true, expiresAt: true } },
      nursery: { select: { name: true, slug: true, city: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const input = { month, soil, city };
  const scored = rows.map((r) => {
    const v = classify(r as AdvisorCandidate, input);
    return { ...(r as AdvisorCandidate), reasons: v.reasons, score: v.score, plantNow: v.plantNow };
  });
  scored.sort((a, b) => b.score - a.score);
  const strip = ({ score: _s, plantNow: _p, ...rest }: typeof scored[number]) => rest;

  return NextResponse.json({
    month,
    seasons: seasonsForMonth(month),
    plantNow: scored.filter((x) => x.plantNow).map(strip),
    later: scored.filter((x) => !x.plantNow).map(strip),
  });
}