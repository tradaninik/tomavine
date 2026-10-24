import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import { nurseryFeatureOn } from "@/lib/nursery-features";

// DELETE /api/seller/locations/[id] — unlink ONE service area from
// MY nursery ([id] = ServiceLocation id). Only ever touches this
// nursery's link row: the master location row stays for everyone
// else, and other nurseries' areas are untouchable from here.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireNursery();
  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }
  const { nursery, session } = auth;

  if (!nurseryFeatureOn(nursery.features, "locations")) {
    return NextResponse.json(
      { error: "Your service locations are managed by Tomavine — contact support to change them." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const dropped = await db.nurseryServiceArea.deleteMany({
    where: { nurseryId: nursery.id, locationId: id },
  });

  if (dropped.count === 0) {
    return NextResponse.json({ error: "That pincode is not in your service areas." }, { status: 404 });
  }

  await db.auditLog.create({
    data: {
      actorId: String(session.payload.sub),
      action: "nursery.location.remove",
      entity: `Nursery:${nursery.id}`,
      meta: { locationId: id, source: "seller" },
    },
  });

  return NextResponse.json({ ok: true });
}
