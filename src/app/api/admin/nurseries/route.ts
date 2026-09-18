import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || String(session.payload.role) !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const nurseries = await db.nursery.findMany({
    where: status === "PENDING" || status === "VERIFIED" || status === "REJECTED" ? { status: status } : {},
    include: {
      owner: { select: { name: true, phone: true } },
      _count: { select: { products: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({
    nurseries: nurseries.map((n) => ({
      id: n.id,
      name: n.name,
      slug: n.slug,
      phone: n.phone,
      gstin: n.gstin,
      city: n.city,
      area: n.area,
      pincode: n.pincode,
      scope: n.scope,
      scopeKm: n.scopeKm,
      bulkOk: n.bulkOk,
      retailOk: n.retailOk,
      status: n.status,
      physVerifiedAt: n.physVerifiedAt ? n.physVerifiedAt.toISOString() : null,
      growArea: n.growArea,
      ratingAvg: n.ratingAvg,
      productCount: n._count.products,
      ownerName: n.owner.name,
      ownerPhone: n.owner.phone,
    })),
  });
}