import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";

// Seller-gated photo upload for a product the nursery owns.
// The browser compresses to ~800px JPEG before sending; the server
// still hard-caps size and type (never trust the client). Uploading
// again replaces the photo and best-effort deletes the old Blob.

const MAX_BYTES = 600 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Photo storage is not configured yet — add BLOB_READ_WRITE_TOKEN (.env locally, Vercel for production)" },
      { status: 503 }
    );
  }

  const product = await db.product.findFirst({
    where: { id: id, nurseryId: auth.nursery.id },
    select: { id: true, image: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing photo file" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo must be under 600 KB — the app compresses automatically, so try a different photo" }, { status: 400 });
  }

  if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
    return NextResponse.json({ error: "Photo must be a JPEG, PNG or WebP image" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";

  let url: string;

  try {
    const blob = await put(`products/${product.id}-${randomUUID().slice(0, 8)}.${ext}`, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    url = blob.url;
  } catch {
    return NextResponse.json({ error: "Photo upload failed — please try again" }, { status: 500 });
  }

  if (product.image) {
    try {
      await del(product.image);
    } catch {
      // best-effort cleanup — an orphaned old photo is harmless
    }
  }

  await db.product.update({
    where: { id: product.id },
    data: { image: url },
  });

  return NextResponse.json({ ok: true, image: url });
}