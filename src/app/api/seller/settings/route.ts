import { NextResponse } from "next/server";
import { Scope } from "@prisma/client";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import { getSettings, sanitizeSettings, SETTINGS_KEY } from "@/lib/settings";

// Mission S3: optional site-wide configuration payload (bulk tiers,
// max qty, pre-order switch, WhatsApp number) stored in SiteSetting.
type SiteConfigBody = {
  tiers?: unknown;
  maxQty?: unknown;
  preorderEnabled?: unknown;
  whatsappNumber?: unknown;
};

export async function GET() {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  // Mission S3: include site-wide settings so the console can edit
  // bulk tiers, max qty, the pre-order switch and the WhatsApp number.
  const site = await getSettings();
  return NextResponse.json({ nursery: nursery, site: site });
}

export async function PATCH(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: { scope?: string; scopeKm?: number | null; bulkOk?: boolean; retailOk?: boolean; siteConfig?: SiteConfigBody };

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

  // Mission S3: optional site-wide settings. Strictly validated, then
  // upserted into SiteSetting - changes apply to new checkouts
  // immediately, with no deploy.
  if (body.siteConfig && typeof body.siteConfig === "object") {
    const sc: SiteConfigBody = body.siteConfig;
    let tiersOk = Array.isArray(sc.tiers) && (sc.tiers as unknown[]).length >= 1 && (sc.tiers as unknown[]).length <= 6;
    const tiers: { minQty: number; pct: number }[] = [];
    if (tiersOk) {
      for (const entry of sc.tiers as unknown[]) {
        if (typeof entry !== "object" || entry === null) { tiersOk = false; break; }
        const e = entry as Record<string, unknown>;
        const minQty = Number(e.minQty);
        const pct = Number(e.pct);
        if (!Number.isInteger(minQty) || minQty < 2 || minQty > 10000) { tiersOk = false; break; }
        if (!Number.isFinite(pct) || pct < 0 || pct > 90) { tiersOk = false; break; }
        tiers.push({ minQty: minQty, pct: pct });
      }
    }
    const maxQty = Number(sc.maxQty);
    const maxOk = Number.isInteger(maxQty) && maxQty >= 1 && maxQty <= 1000;
    const preOk = typeof sc.preorderEnabled === "boolean";
    const waRaw = typeof sc.whatsappNumber === "string" ? sc.whatsappNumber : "";
    const waDigits = waRaw.replace(/\D+/g, "");
    const waOk = waDigits.length === 0 || (waDigits.length >= 10 && waDigits.length <= 15);
    if (!tiersOk || !maxOk || !preOk || !waOk) {
      return NextResponse.json({ error: "Invalid site settings" }, { status: 400 });
    }
    const value = JSON.parse(JSON.stringify({
      tiers: tiers.sort((a, b) => a.minQty - b.minQty),
      maxQty: maxQty,
      preorderEnabled: sc.preorderEnabled === true,
      whatsappNumber: waDigits.length >= 10 ? waDigits : null,
    }));
    await db.siteSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: value },
      update: { value: value },
    });
  }

  const updated = await db.nursery.update({
    where: { id: nursery.id },
    data: data,
  });

  return NextResponse.json({ nursery: updated });
}