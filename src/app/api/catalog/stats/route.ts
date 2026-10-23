import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public platform counters for the home page stats band.
// Only visible/catalog-eligible rows are counted so numbers always
// match what a visitor can actually buy.
export async function GET() {
  const [nurseries, listings, rescue] = await Promise.all([
    db.nursery.count({ where: { status: "VERIFIED" } }),
    db.product.count({
      where: { hidden: false, nursery: { status: "VERIFIED", retailOk: true } },
    }),
    db.rescueListing.count({
      where: {
        expiresAt: { gt: new Date() },
        product: { hidden: false, nursery: { status: "VERIFIED" } },
      },
    }),
  ]);

  return NextResponse.json({
    nurseries,
    listings,
    categories: 5,
    rescue,
  });
}
