import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";
import { isValidSub } from "@/lib/subcategories";

export async function GET() {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  const settingsRow = await db.nursery.findUnique({
    where: { id: nursery.id },
    select: { categories: true },
  });
  const rawCats = settingsRow ? settingsRow.categories : null;
  const allowedCategories = Array.isArray(rawCats) ? (rawCats as string[]) : null;

  const products = await db.product.findMany({
    where: { nurseryId: nursery.id },
    orderBy: { createdAt: "asc" },
    include: {
      variants: true,
      rescue: true,
    },
  });

  return NextResponse.json({ products: products, allowedCategories: allowedCategories });
}

export async function PATCH(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: {
    id?: string;
    nameEn?: string;
    price?: number;
    mrp?: number;
    stock?: number;
    hidden?: boolean;
    subCategory?: string;
    rescue?: { pct: number; days: number } | null;
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

  const data: { nameEn?: string; priceMin?: number; mrp?: number; stock?: number; hidden?: boolean; subCategory?: string | null } = {};

  if (typeof body.nameEn === "string") {
    const name = body.nameEn.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Product name must be 2–120 characters" }, { status: 400 });
    }
    data.nameEn = name;
  }

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
    if (body.stock > 9999) {
      return NextResponse.json({ error: "Stock cannot be more than 9,999" }, { status: 400 });
    }
    data.stock = body.stock;
  }

  if (typeof body.hidden === "boolean") {
    data.hidden = body.hidden;
  }

  if (typeof body.subCategory === "string") {
    if (body.subCategory === "") {
      data.subCategory = null;
    } else if (!isValidSub(product.category, body.subCategory)) {
      return NextResponse.json({ error: "Unknown subcategory for this category" }, { status: 400 });
    } else {
      data.subCategory = body.subCategory;
    }
  }

  const finalPrice = data.priceMin ?? product.priceMin;
  const finalMrp = data.mrp ?? product.mrp;

  if (finalPrice > finalMrp) {
    return NextResponse.json({ error: "Price cannot be higher than MRP" }, { status: 400 });
  }

  if (Object.keys(data).length === 0 && body.rescue === undefined) {
    return NextResponse.json({ error: "Nothing to update — change at least one field" }, { status: 400 });
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

// ─────────────────────────────────────────────────────────────
// Product creation (Phase 3b). nurseryId ALWAYS comes from the
// requireNursery() session — never from the body. Variant SKUs
// are generated server-side (ProductVariant.sku is globally
// unique) — client SKUs are never trusted. care/agri/provenance
// accept flat JSON objects only, matching the taxonomy meta
// convention (string | number | boolean values).
// ─────────────────────────────────────────────────────────────

const CREATE_CATEGORIES = ["plants", "saplings", "inputs", "pots", "tools"];

type FlatJson = Record<string, string | number | boolean>;

function readFlatJson(value: unknown, name: string): FlatJson | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  const src = value as Record<string, unknown>;
  const flat: FlatJson = {};
  for (const [key, val] of Object.entries(src)) {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      flat[key] = val;
    } else {
      throw new Error(`${name} values must be text, numbers or booleans`);
    }
  }
  return Object.keys(flat).length > 0 ? flat : undefined;
}

export async function POST(request: Request) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  let body: {
    category?: string;
    subCategory?: string;
    nameEn?: string;
    names?: unknown;
    botanical?: string;
    priceMin?: number;
    mrp?: number;
    stock?: number;
    care?: unknown;
    agri?: unknown;
    provenance?: unknown;
    variants?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category : "";

  if (!CREATE_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Category must be plants, saplings, inputs, pots or tools" }, { status: 400 });
  }

  // Category allow-list (4c-2): null means the nursery may sell in
  // every category; an explicit array is an exact allow-list set by
  // the super admin in the nursery settings editor.
  const allowedRow = await db.nursery.findUnique({
    where: { id: nursery.id },
    select: { categories: true },
  });
  const rawAllowed = allowedRow ? allowedRow.categories : null;
  const allowed = Array.isArray(rawAllowed) ? (rawAllowed as string[]) : null;

  if (allowed !== null && !allowed.includes(category)) {
    return NextResponse.json({ error: "Your nursery does not sell in this category yet — contact Tomavine support to enable it" }, { status: 400 });
  }

  const subCategory = typeof body.subCategory === "string" ? body.subCategory : "";

  if (subCategory !== "" && !isValidSub(category, subCategory)) {
    return NextResponse.json({ error: "Unknown subcategory for this category" }, { status: 400 });
  }

  const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";

  if (nameEn.length < 2 || nameEn.length > 120) {
    return NextResponse.json({ error: "Product name must be 2–120 characters" }, { status: 400 });
  }

  let names: FlatJson | undefined;

  if (body.names !== undefined && body.names !== null) {
    if (typeof body.names !== "object" || Array.isArray(body.names)) {
      return NextResponse.json({ error: "Names must be an object of language to name" }, { status: 400 });
    }
    const src = body.names as Record<string, unknown>;
    const clean: Record<string, string> = {};
    for (const [lang, val] of Object.entries(src)) {
      const key = lang.trim().toLowerCase().slice(0, 8);
      const text = typeof val === "string" ? val.trim() : "";
      if (!key || !text || text.length > 120) {
        return NextResponse.json({ error: "Regional names must be non-empty text" }, { status: 400 });
      }
      clean[key] = text;
    }
    if (Object.keys(clean).length > 0) {
      names = clean;
    }
  }

  const botanical = typeof body.botanical === "string" ? body.botanical.trim() : "";

  if (botanical.length > 120) {
    return NextResponse.json({ error: "Botanical name is too long" }, { status: 400 });
  }

  const priceMin = body.priceMin;

  if (typeof priceMin !== "number" || !Number.isInteger(priceMin) || priceMin < 1) {
    return NextResponse.json({ error: "Price must be a whole number of at least ₹1" }, { status: 400 });
  }

  const mrp = body.mrp;

  if (typeof mrp !== "number" || !Number.isInteger(mrp) || mrp < 1) {
    return NextResponse.json({ error: "MRP must be a whole number of at least ₹1" }, { status: 400 });
  }

  if (priceMin > mrp) {
    return NextResponse.json({ error: "Price cannot be higher than MRP" }, { status: 400 });
  }

  const stock = body.stock === undefined || body.stock === null ? 0 : body.stock;

  if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
    return NextResponse.json({ error: "Stock cannot be negative" }, { status: 400 });
  }

  let care: FlatJson | undefined;
  let agri: FlatJson | undefined;
  let provenance: FlatJson | undefined;

  try {
    care = readFlatJson(body.care, "Care");
    agri = readFlatJson(body.agri, "Agri");
    provenance = readFlatJson(body.provenance, "Provenance");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid JSON fields" }, { status: 400 });
  }

  const variants: { label: string; price: number }[] = [];

  if (body.variants !== undefined && body.variants !== null) {
    if (!Array.isArray(body.variants)) {
      return NextResponse.json({ error: "Variants must be a list" }, { status: 400 });
    }
    if (body.variants.length > 10) {
      return NextResponse.json({ error: "At most 10 variants per product" }, { status: 400 });
    }
    for (const v of body.variants) {
      if (typeof v !== "object" || v === null) {
        return NextResponse.json({ error: "Every variant must be an object" }, { status: 400 });
      }
      const item = v as { label?: unknown; price?: unknown };
      const label = typeof item.label === "string" ? item.label.trim() : "";
      const price = item.price;
      if (label.length < 1 || label.length > 80) {
        return NextResponse.json({ error: "Variant labels must be 1–80 characters" }, { status: 400 });
      }
      if (typeof price !== "number" || !Number.isInteger(price) || price < 1) {
        return NextResponse.json({ error: "Variant prices must be whole numbers of at least ₹1" }, { status: 400 });
      }
      if (variants.some((x) => x.label === label)) {
        return NextResponse.json({ error: "Variant labels must be unique" }, { status: 400 });
      }
      variants.push({ label: label, price: price });
    }
  }

  const product = await db.product.create({
    data: {
      nurseryId: nursery.id,
      category: category,
      subCategory: subCategory === "" ? undefined : subCategory,
      nameEn: nameEn,
      names: names === undefined ? undefined : (names as Prisma.InputJsonValue),
      botanical: botanical === "" ? undefined : botanical,
      priceMin: priceMin,
      mrp: mrp,
      stock: stock,
      care: care === undefined ? undefined : (care as Prisma.InputJsonValue),
      agri: agri === undefined ? undefined : (agri as Prisma.InputJsonValue),
      provenance: provenance === undefined ? undefined : (provenance as Prisma.InputJsonValue),
    },
  });

  if (variants.length > 0) {
    await db.productVariant.createMany({
      data: variants.map((v) => ({
        productId: product.id,
        label: v.label,
        price: v.price,
        sku: "TV-" + randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase(),
      })),
    });
  }

  const created = await db.product.findUnique({
    where: { id: product.id },
    include: { variants: true, rescue: true },
  });

  return NextResponse.json({ ok: true, product: created });
}