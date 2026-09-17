import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";

export async function GET() {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  const leads = await db.bulkLead.findMany({
    where: { product: { nurseryId: nursery.id } },
    orderBy: { id: "desc" },
    include: {
      product: { select: { id: true, nameEn: true, category: true } },
      quotes: { where: { nurseryId: nursery.id } },
    },
  });

  return NextResponse.json({ leads: leads });
}

export async function POST(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: { leadId?: string; amount?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  const amount = body.amount;

  if (!leadId) {
    return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  }

  if (!Number.isInteger(amount) || amount === undefined || amount < 1) {
    return NextResponse.json({ error: "Enter a valid quote amount in rupees" }, { status: 400 });
  }

  const lead = await db.bulkLead.findFirst({
    where: { id: leadId, product: { nurseryId: nursery.id } },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await db.quote.create({
    data: {
      leadId: lead.id,
      nurseryId: nursery.id,
      amount: amount,
    },
  });

  await db.bulkLead.update({
    where: { id: lead.id },
    data: { status: "quoted" },
  });

  return NextResponse.json({ ok: true });
}