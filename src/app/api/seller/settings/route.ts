import { NextResponse } from "next/server";
import { Scope } from "@prisma/client";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";

export async function GET() {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  return NextResponse.json({ nursery: nursery });
}

export async function PATCH(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: { scope?: string; scopeKm?: number | null; bulkOk?: boolean; retailOk?: boolean };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: {
    scope?: Scope;
    scopeKm?: number | null;
    bulkOk?: boolean;
    retailOk?: boolean;
  } = {};

  if (typeof body.scope === "string") {
    if (body.scope !== "RADIUS" && body.scope !== "CITY" && body.scope !== "STATE" && body.scope !== "INDIA") {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }
    data.scope = body.scope as Scope;
  }

  const scope = data.scope ?? nursery.scope;

  if (body.scopeKm !== undefined && body.scopeKm !== null) {
    if (!Number.isInteger(body.scopeKm) || body.scopeKm < 1 || body.scopeKm > 500) {
      return NextResponse.json({ error: "Radius must be between 1 and 500 km" }, { status: 400 });
    }
    data.scopeKm = body.scopeKm;
  }

  if (scope === "RADIUS") {
    const km = data.scopeKm ?? nursery.scopeKm;

    if (km === null || km === undefined) {
      return NextResponse.json({ error: "Choose a delivery radius in km" }, { status: 400 });
    }

    data.scopeKm = km;
  } else {
    data.scopeKm = null;
  }

  if (typeof body.bulkOk === "boolean") {
    data.bulkOk = body.bulkOk;
  }

  if (typeof body.retailOk === "boolean") {
    data.retailOk = body.retailOk;
  }

  const updated = await db.nursery.update({
    where: { id: nursery.id },
    data: data,
  });

  return NextResponse.json({ nursery: updated });
}