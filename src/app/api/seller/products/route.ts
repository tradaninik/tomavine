import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";

export async function GET() {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  const products = await db.product.findMany({
    where: { nurseryId: nursery.id },
    orderBy: { createdAt: "asc" },
    include: {
      variants: true,
      rescue: true,
    },
  });

  return NextResponse.json({ products: products });
}

export async function PATCH(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: {
    id?: string;
    price?: number;
    mrp?: number;
    stock?: number;
    hidden?: boolean;
    rescue?: { pct?: number; days?: number } | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";

  if (!id) {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  const product = await db.product.findFirst({
    where: { id: id, nurseryId: nursery.id },
    include: { rescue: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const data: { priceMin?: number; mrp?: number; stock?: number; hidden?: boolean } = {};

  if (typeof body.price === "number") {
    if (!Number.isInteger(body.price) || body.price < 1) {
      return NextResponse.json({ error: "Price must be a whole number of at least ₹1" }, { status: 400 });
    }
    data.priceMin = body.price;
  }

  if (typeof body.mrp === "number") {
    if (!Number.isInteger(body.mrp) || body.mrp < 1) {
      return NextResponse.json({ error: "MRP must be a whole number of at least ₹1" }, { status: 400 });
    }
    data.mrp = body.mrp;
  }

  if (typeof body.stock === "number") {
    if (!Number.isInteger(body.stock) || body.stock < 0) {
      return NextResponse.json({ error: "Stock cannot be negative" }, { status: 400 });
    }
    data.stock = body.stock;
  }

  if (typeof body.hidden === "boolean") {
    data.hidden = body.hidden;
  }

  const finalPrice = data.priceMin ?? product.priceMin;
  const finalMrp = data.mrp ?? product.mrp;

  if (finalPrice > finalMrp) {
    return NextResponse.json({ error: "Price cannot be higher than MRP" }, { status: 400 });
  }

  if (body.rescue === null) {
    if (product.rescue) {
      await db.rescueListing.delete({
        where: { productId: product.id },
      });
    }
  } else if (typeof body.rescue === "object") {
    const pct = body.rescue.pct;
    const days = body.rescue.days;

    if (!Number.isInteger(pct) || pct < 5 || pct > 90) {
      return NextResponse.json({ error: "Rescue discount must be between 5% and 90%" }, { status: 400 });
    }

    if (!Number.isInteger(days) || days < 1 || days > 30) {
      return NextResponse.json({ error: "Rescue days must be between 1 and 30" }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await db.rescueListing.upsert({
      where: { productId: product.id },
      update: { pct: pct, expiresAt: expiresAt },
      create: { productId: product.id, pct: pct, expiresAt: expiresAt },
    });
  }

  if (Object.keys(data).length > 0) {
    await db.product.update({
      where: { id: product.id },
      data: data,
    });
  }

  const updated = await db.product.findUnique({
    where: { id: product.id },
    include: { variants: true, rescue: true },
  });

  return NextResponse.json({ ok: true, product: updated });
}