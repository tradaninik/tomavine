"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { Btn, Card, Pill, inr } from "../ui";
import { displayPriceOf } from "@/lib/cart";
import { subOptionsFor, subLabel } from "@/lib/subcategories";
import type { CategoryNode, CategoryTop, CategoryTree } from "@/lib/category-tree";

type Variant = {
  id: string;
  label: string;
  price: number;
  sku: string;
};

type Rescue = {
  pct: number;
  expiresAt: string;
};

type Product = {
  id: string;
  category: string;
  subCategory: string | null;
  nameEn: string;
  priceMin: number;
  mrp: number;
  stock: number;
  hidden: boolean;
  image: string | null;
  care: Record<string, string> | null;
  variants: Variant[];
  rescue: Rescue | null;
};

type TaxTerm = {
  id: string;
  kind: string;
  label: string;
  names: Record<string, string> | null;
  groupName: string | null;
  note: string | null;
  meta: Record<string, unknown> | null;
};

type FormState = {
  name: string;
  price: string;
  mrp: string;
  stock: string;
  sub: string;
  careSun: string;
  careSoil: string;
  careWater: string;
  hidden: boolean;
  rescueOn: boolean;
  rescuePct: string;
  rescueDays: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  price: "",
  mrp: "",
  stock: "",
  sub: "",
  careSun: "",
  careSoil: "",
  careWater: "",
  hidden: false,
  rescueOn: false,
  rescuePct: "30",
  rescueDays: "3",
};

const REGIONAL_LANGS: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ta", label: "Tamil" },
  { code: "mr", label: "Marathi" },
];

const AGRI_LABELS: Record<string, string> = {
  spacing: "Spacing",
  plantsPerAcre: "Plants/acre",
  season: "Season",
  traySize: "Tray",
  form: "Form",
};

const ALL_CATS: { v: string; label: string; plain: string }[] = [
  { v: "plants", label: "🪴 Plants", plain: "plants" },
  { v: "saplings", label: "🌾 Saplings", plain: "saplings" },
  { v: "inputs", label: "🧪 Inputs", plain: "organic inputs" },
  { v: "pots", label: "🏺 Pots", plain: "pots" },
  { v: "tools", label: "🛠️ Tools", plain: "tools" },
];

const CARE_CATS = ["plants", "saplings"];

// English display name for a tree node (label = emoji + this).
function enOf(node: { names: Record<string, string> | null; slug: string }): string {
  return node.names && typeof node.names.en === "string" && node.names.en.length > 0 ? node.names.en : node.slug;
}

function trayLabel(traySize: string): string {
  const m = /(\d+)/.exec(traySize);
  return m ? `Tray of ${m[1]}` : traySize;
}

function groupTerms(terms: TaxTerm[]): { name: string; items: TaxTerm[] }[] {
  const groups: { name: string; items: TaxTerm[] }[] = [];
  for (const t of terms) {
    const name = t.groupName ?? "Other";
    const bucket = groups.find((g) => g.name === name);
    if (bucket) {
      bucket.items.push(t);
    } else {
      groups.push({ name: name, items: [t] });
    }
  }
  return groups;
}

// Client-side compression guardrail: resize to max 800px and re-encode
// as JPEG (~60–150 KB typically) before uploading to Vercel Blob.
function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 800;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Could not process image"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Could not process image"));
            }
          },
          "image/jpeg",
          0.72
        );
      } catch {
        URL.revokeObjectURL(url);
        reject(new Error("Could not process image"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [taxTerms, setTaxTerms] = useState<TaxTerm[]>([]);
  const [taxLoaded, setTaxLoaded] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newCat, setNewCat] = useState("plants");
  const [newSub, setNewSub] = useState("");
  const [newName, setNewName] = useState("");
  const [newBotanical, setNewBotanical] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newMrp, setNewMrp] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newCareSun, setNewCareSun] = useState("");
  const [newCareSoil, setNewCareSoil] = useState("");
  const [newCareWater, setNewCareWater] = useState("");
  const [newVariety, setNewVariety] = useState("");
  const [newPlantType, setNewPlantType] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newInputTerm, setNewInputTerm] = useState("");
  const [inputNote, setInputNote] = useState("");
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [newAgri, setNewAgri] = useState<Record<string, unknown> | null>(null);
  const [newVariants, setNewVariants] = useState<{ label: string; price: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createOk, setCreateOk] = useState("");
  const [allowedCats, setAllowedCats] = useState<string[] | null>(null);
  // Mission F: franchise switches from the super admin — products off =
  // read-only catalog, rescue off = no discount-center editor.
  const [canManage, setCanManage] = useState({ products: true, rescue: true });
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  // Category tree (2c) — powers the grouped tree picker in the New
  // product form; falls back to the legacy 5-category select.
  const [catTree, setCatTree] = useState<CategoryTree | null>(null);
  const [newCategoryId, setNewCategoryId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/seller/products");

      if (!res.ok) throw new Error("failed");

      const data = await res.json();
      setProducts(data.products);
      setAllowedCats(Array.isArray(data.allowedCategories) ? data.allowedCategories : null);
      const cm = data.canManage;
      setCanManage({
        products: !cm || cm.products !== false,
        rescue: !cm || cm.rescue !== false,
      });
      setError("");
    } catch {
      setError("Could not load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // If the nursery's allow-list was restricted while the form was
  // open and no longer covers the selected category, fall back to
  // the first allowed category.
  useEffect(() => {
    if (allowedCats !== null && allowedCats.length > 0 && !allowedCats.includes(newCat)) {
      setNewCat(allowedCats[0]);
      setNewCategoryId("");
      setNewSub("");
      setNewVariety("");
      setNewPlantType("");
      setNewSize("");
      setNewInputTerm("");
      setNewNames({});
      setNewAgri(null);
    }
  }, [allowedCats, newCat]);

  // Category tree (2c) — one fetch while the form is closed/open;
  // optional: if it can't be fetched, the legacy selects stay.
  useEffect(() => {
    if (catTree !== null) {
      return;
    }
    fetch("/api/catalog/categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.categories) && data.categories.length > 0) {
          setCatTree(data.categories as CategoryTree);
        }
      })
      .catch(() => {
        // tree is optional help — the legacy category inputs remain
      });
  }, [catTree]);

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    setError("");

    try {
      const res = await fetch("/api/seller/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, ...payload }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Save failed");
      }

      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function quickStock(p: Product, delta: number) {
    await patch(p.id, { stock: Math.max(0, p.stock + delta) });
  }

  function startEdit(p: Product) {
    const c: Record<string, string> = p.care && typeof p.care === "object" ? p.care : {};
    setEditingId(p.id);
    setForm({
      name: p.nameEn,
      price: String(p.priceMin),
      mrp: String(p.mrp),
      stock: String(p.stock),
      sub: p.subCategory ?? "",
      careSun: typeof c.sun === "string" ? c.sun : "",
      careSoil: typeof c.soil === "string" ? c.soil : "",
      careWater: typeof c.water === "string" ? c.water : "",
      hidden: p.hidden,
      rescueOn: p.rescue !== null,
      rescuePct: p.rescue ? String(p.rescue.pct) : "30",
      rescueDays: "3",
    });
  }

  async function saveEdit(p: Product) {
    const payload: Record<string, unknown> = {
      nameEn: form.name.trim(),
      price: Number(form.price),
      mrp: Number(form.mrp),
      stock: Number(form.stock),
      hidden: form.hidden,
      subCategory: form.sub,
    };

    if (form.rescueOn) {
      payload.rescue = { pct: Number(form.rescuePct), days: Number(form.rescueDays) };
    } else if (p.rescue) {
      payload.rescue = null;
    }

    // Care: send when something is entered, or when the product
    // already had care (so emptying the fields clears it).
    const careClean: Record<string, string> = {};
    if (form.careSun.trim()) careClean.sun = form.careSun.trim();
    if (form.careSoil.trim()) careClean.soil = form.careSoil.trim();
    if (form.careWater.trim()) careClean.water = form.careWater.trim();
    const hadCare = p.care !== null && typeof p.care === "object" && Object.keys(p.care).length > 0;
    if (Object.keys(careClean).length > 0 || hadCare) {
      payload.care = Object.keys(careClean).length > 0 ? careClean : null;
    }

    const ok = await patch(p.id, payload);

    if (ok) {
      setEditingId(null);
    }
  }

  async function openNew() {
    if (newOpen) {
      setNewOpen(false);
      return;
    }
    setNewOpen(true);
    if (!taxLoaded) {
      try {
        const res = await fetch("/api/catalog/taxonomy");
        const data = await res.json();
        if (res.ok && data && Array.isArray(data.terms)) {
          setTaxTerms(data.terms);
          setTaxLoaded(true);
        }
      } catch {
        // taxonomy is optional help — the free-form fields still work without it
      }
    }
  }

  function changeCat(c: string) {
    setNewCat(c);
    setNewSub("");
    setNewVariety("");
    setNewPlantType("");
    setNewSize("");
    setNewInputTerm("");
    setInputNote("");
    setNewNames({});
    setNewAgri(null);
    setNewCareSun("");
    setNewCareSoil("");
    setNewCareWater("");
  }

  // ── Tree picker (2c) ────────────────────────────────────────
  // Visible when the tree loaded. The selection writes categoryId;
  // newCat is kept in sync with the node's TOP (legacyKey for the
  // 5 legacy tops, else the slug) so the helper sections below
  // (variety, plant type, care…) keep working untouched. The
  // legacy selects stay as the fallback.
  const treePickerActive = catTree !== null && catTree.length > 0;
  const treeTops =
    catTree === null
      ? []
      : allowedCats === null
        ? catTree
        : catTree.filter(
            (top) =>
              allowedCats.includes(top.slug) ||
              (top.legacyKey !== null && allowedCats.includes(top.legacyKey)),
          );

  function treeSelection(id: string): { top: CategoryTop; sub: CategoryNode | null } | null {
    if (!catTree) {
      return null;
    }
    for (const top of catTree) {
      if (top.id === id) {
        return { top: top, sub: null };
      }
      const sub = top.subs.find((s) => s.id === id);
      if (sub) {
        return { top: top, sub: sub };
      }
    }
    return null;
  }

  function pickTreeCategory(id: string) {
    setNewCategoryId(id);
    const found = treeSelection(id);
    const topKey = found ? (found.top.legacyKey ?? found.top.slug) : "";
    // Same resets as the legacy changeCat() so no stale helper data
    // follows the product across categories.
    setNewCat(topKey);
    setNewSub("");
    setNewVariety("");
    setNewPlantType("");
    setNewSize("");
    setNewInputTerm("");
    setInputNote("");
    setNewNames({});
    setNewAgri(null);
    setNewCareSun("");
    setNewCareSoil("");
    setNewCareWater("");
  }

  function pickVariety(id: string) {
    setNewVariety(id);
    const t = taxTerms.find((x) => x.id === id);
    if (!t) {
      setNewAgri(null);
      setNewNames({});
      return;
    }
    setNewName(t.label);
    setNewNames(t.names ? { ...t.names } : {});
    setNewAgri(t.meta ? { ...t.meta } : null);
    const tray = t.meta && typeof t.meta.traySize === "string" ? t.meta.traySize : "";
    if (tray && newVariants.length === 0) {
      setNewVariants([{ label: trayLabel(tray), price: "" }]);
    }
  }

  function pickPlantType(id: string) {
    setNewPlantType(id);
    const t = taxTerms.find((x) => x.id === id);
    if (!t) {
      return;
    }
    if (newName.trim() === "") {
      setNewName(t.label);
    }
    setNewNames(t.names ? { ...t.names } : {});
  }

  function pickSize(id: string) {
    setNewSize(id);
    const t = taxTerms.find((x) => x.id === id);
    if (!t) {
      return;
    }
    if (newVariants.length === 0) {
      setNewVariants([{ label: t.label, price: "" }]);
    }
  }

  function pickInput(id: string) {
    setNewInputTerm(id);
    const t = taxTerms.find((x) => x.id === id);
    if (!t) {
      setInputNote("");
      setNewNames({});
      return;
    }
    setNewName(t.label);
    setNewNames(t.names ? { ...t.names } : {});
    setInputNote(t.note ?? "");
  }

  function resetNew() {
    setNewName("");
    setNewSub("");
    setNewBotanical("");
    setNewPrice("");
    setNewMrp("");
    setNewStock("");
    setNewCareSun("");
    setNewCareSoil("");
    setNewCareWater("");
    setNewVariety("");
    setNewPlantType("");
    setNewSize("");
    setNewInputTerm("");
    setInputNote("");
    setNewNames({});
    setNewAgri(null);
    setNewVariants([]);
    setCreateError("");
  }

  async function onPhotoPick(p: Product, e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    input.value = "";
    if (!file) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp" && file.type !== "image/heic" && file.type !== "image/heif") {
      setPhotoError("That file is not a photo — pick a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError("That photo is too large — pick one under 8 MB.");
      return;
    }
    setPhotoError("");
    setPhotoBusyId(p.id);
    try {
      const compressed = await compressPhoto(file);
      const fd = new FormData();
      fd.append("file", compressed, "photo.jpg");
      const res = await fetch(`/api/seller/products/${p.id}/image`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data && typeof data.error === "string" ? data.error : "Upload failed");
      }
      await load();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPhotoBusyId(null);
    }
  }

  async function createProduct() {
    setCreateError("");
    setCreateOk("");

    // Tree picker is the source of truth once loaded — a node must
    // be picked so the server can write categoryId.
    if (treePickerActive && !newCategoryId) {
      setCreateError("Pick a category.");
      return;
    }

    const name = newName.trim();
    if (name.length < 2) {
      setCreateError("Product name must be at least 2 characters.");
      return;
    }

    const price = Number(newPrice);
    if (!Number.isInteger(price) || price < 1) {
      setCreateError("Price must be a whole number of at least ₹1.");
      return;
    }

    const mrp = newMrp.trim() === "" ? price : Number(newMrp);
    if (!Number.isInteger(mrp) || mrp < 1) {
      setCreateError("MRP must be a whole number of at least ₹1.");
      return;
    }
    if (price > mrp) {
      setCreateError("Price cannot be higher than MRP.");
      return;
    }

    const stock = newStock.trim() === "" ? 0 : Number(newStock);
    if (!Number.isInteger(stock) || stock < 0) {
      setCreateError("Stock cannot be negative.");
      return;
    }

    const variants: { label: string; price: number }[] = [];
    for (const v of newVariants) {
      const label = v.label.trim();
      if (!label) {
        setCreateError("Every variant needs a label.");
        return;
      }
      const vp = Number(v.price);
      if (!Number.isInteger(vp) || vp < 1) {
        setCreateError("Every variant needs a whole-number price of at least ₹1.");
        return;
      }
      variants.push({ label: label, price: vp });
    }

    const names: Record<string, string> = {};
    for (const l of REGIONAL_LANGS) {
      const val = (newNames[l.code] ?? "").trim();
      if (val) {
        names[l.code] = val;
      }
    }

    const payload: Record<string, unknown> = {
      category: newCat,
      nameEn: name,
      priceMin: price,
      mrp: mrp,
      stock: stock,
    };
    if (newCategoryId) {
      // Tree picker selection (2c) — the server re-validates the
      // node and keeps the legacy category string in sync.
      payload.categoryId = newCategoryId;
    }
    if (newSub) {
      payload.subCategory = newSub;
    }
    if (newBotanical.trim()) {
      payload.botanical = newBotanical.trim();
    }
    if (Object.keys(names).length > 0) {
      payload.names = names;
    }
    if (variants.length > 0) {
      payload.variants = variants;
    }
    if (newCat === "saplings" && newAgri) {
      payload.agri = newAgri;
    }
    if (CARE_CATS.includes(newCat)) {
      const care: Record<string, string> = {};
      if (newCareSun.trim()) care.sun = newCareSun.trim();
      if (newCareSoil.trim()) care.soil = newCareSoil.trim();
      if (newCareWater.trim()) care.water = newCareWater.trim();
      if (Object.keys(care).length > 0) {
        payload.care = care;
      }
    }

    setCreating(true);
    try {
      const res = await fetch("/api/seller/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Create failed");
      }

      setCreateOk(`Added "${name}".`);
      resetNew();
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  const catOptions = allowedCats === null ? ALL_CATS : ALL_CATS.filter((c) => allowedCats.includes(c.v));

  if (loading && products.length === 0) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[#1C3A2A]">Products</h1>
        {canManage.products ? (
          <Btn onClick={openNew}>{newOpen ? "Close form" : "+ New product"}</Btn>
        ) : null}
      </div>

      {!canManage.products ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          🔒 Your product catalog is managed by Tomavine — contact support to add or change plants. Everything below
          stays visible; you just can&apos;t edit it from here.
        </div>
      ) : null}

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}
      {photoError ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">📷 {photoError}</p> : null}

      {newOpen ? (
        <Card>
          <p className="font-bold text-[#1C3A2A]">New product</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {treePickerActive ? (
              <label className="text-sm font-medium text-[#1C3A2A]">
                Category
                <select
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                  value={newCategoryId}
                  onChange={(e) => pickTreeCategory(e.target.value)}
                >
                  <option value="">— pick a category —</option>
                  {treeTops.map((top) => (
                    <optgroup key={top.slug} label={`${top.emoji ?? "🌱"} ${enOf(top)}`}>
                      {top.subs.map((s) => (
                        <option key={s.slug} value={s.id}>
                          {`${s.emoji ?? top.emoji ?? "🌱"} ${enOf(s)}`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {allowedCats !== null ? (
                  <span className="mt-1 block text-xs text-[#66735F]">
                    Your nursery currently lists: {treeTops.map((top) => enOf(top)).join(", ")}.
                  </span>
                ) : null}
              </label>
            ) : (
              <label className="text-sm font-medium text-[#1C3A2A]">
                Category
                <select
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                  value={newCat}
                  onChange={(e) => changeCat(e.target.value)}
                >
                  {catOptions.map((c) => (
                    <option key={c.v} value={c.v}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {allowedCats !== null ? (
                  <span className="mt-1 block text-xs text-[#66735F]">
                    Your nursery currently lists: {catOptions.map((c) => c.plain).join(", ")}.
                  </span>
                ) : null}
              </label>
            )}

            <label className="text-sm font-medium text-[#1C3A2A]">
              Product name
              <input
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={120}
                placeholder={newCat === "saplings" ? "Pick a variety or type a name" : "e.g. Jade Plant"}
              />
            </label>
          </div>

          {/* With the tree picker the sub position lives in categoryId;
              the legacy subCategory string select stays as fallback only. */}
          {!treePickerActive ? (
            <div className="mt-3 sm:max-w-md">
              <label className="text-sm font-medium text-[#1C3A2A]">
                Subcategory (optional — helps buyers browse)
                <select
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                >
                  <option value="">— none —</option>
                  {subOptionsFor(newCat).map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {newCat === "saplings" ? (
            <div className="mt-3">
              <label className="text-sm font-medium text-[#1C3A2A]">
                Variety (autofills name, regional names and per-acre guidance)
                <select
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                  value={newVariety}
                  onChange={(e) => pickVariety(e.target.value)}
                >
                  <option value="">— pick a variety —</option>
                  {groupTerms(taxTerms.filter((t) => t.kind === "saplingVariety")).map((g) => (
                    <optgroup key={g.name} label={g.name}>
                      {g.items.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {newAgri ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(newAgri).map(([k, v]) => (
                    <span key={k} className="rounded-full bg-[#EDF2E6] px-2.5 py-0.5 text-xs font-medium text-[#24562F]">
                      {AGRI_LABELS[k] ?? k}: {String(v)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {newCat === "plants" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-[#1C3A2A]">
                Plant type
                <select
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                  value={newPlantType}
                  onChange={(e) => pickPlantType(e.target.value)}
                >
                  <option value="">— pick a type —</option>
                  {taxTerms.filter((t) => t.kind === "plantType").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-[#1C3A2A]">
                Size / stage (suggests a variant label)
                <select
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                  value={newSize}
                  onChange={(e) => pickSize(e.target.value)}
                >
                  <option value="">— pick a size —</option>
                  {taxTerms.filter((t) => t.kind === "size").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {newCat === "inputs" ? (
            <div className="mt-3">
              <label className="text-sm font-medium text-[#1C3A2A]">
                Soil / compost (autofills name and regional names)
                <select
                  className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                  value={newInputTerm}
                  onChange={(e) => pickInput(e.target.value)}
                >
                  <option value="">— pick a product type —</option>
                  {groupTerms([...taxTerms.filter((t) => t.kind === "soil"), ...taxTerms.filter((t) => t.kind === "compost")]).map((g) => (
                    <optgroup key={g.name} label={g.name}>
                      {g.items.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {inputNote ? <p className="mt-1 text-xs text-[#8A5A14]">💡 {inputNote}</p> : null}
            </div>
          ) : null}

          <div className="mt-3">
            <p className="text-sm font-medium text-[#1C3A2A]">Regional names (optional — shown to customers in their language)</p>
            <div className="mt-1 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {REGIONAL_LANGS.map((l) => (
                <label key={l.code} className="text-sm font-medium text-[#1C3A2A]">
                  {l.label}
                  <input
                    className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                    value={newNames[l.code] ?? ""}
                    onChange={(e) => setNewNames((p) => ({ ...p, [l.code]: e.target.value }))}
                    maxLength={120}
                    placeholder="Optional"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-[#1C3A2A]">
              Price (₹)
              <input
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                value={newPrice}
                inputMode="numeric"
                onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, ""))}
                placeholder="50"
              />
            </label>
            <label className="text-sm font-medium text-[#1C3A2A]">
              MRP (₹) — defaults to price
              <input
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                value={newMrp}
                inputMode="numeric"
                onChange={(e) => setNewMrp(e.target.value.replace(/\D/g, ""))}
                placeholder="Optional"
              />
            </label>
            <label className="text-sm font-medium text-[#1C3A2A]">
              Stock
              <input
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                value={newStock}
                inputMode="numeric"
                onChange={(e) => setNewStock(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
              />
            </label>
            <label className="text-sm font-medium text-[#1C3A2A]">
              Botanical name (optional)
              <input
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                value={newBotanical}
                onChange={(e) => setNewBotanical(e.target.value)}
                maxLength={120}
                placeholder="e.g. Crassula ovata"
              />
            </label>
          </div>

          {CARE_CATS.includes(newCat) ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-[#1C3A2A]">Care guide (optional — shown on the buyer's cart and order page)</p>
              <div className="mt-1 grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-medium text-[#1C3A2A]">
                  ☀️ Sunlight
                  <input
                    className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                    value={newCareSun}
                    onChange={(e) => setNewCareSun(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. Bright indirect light"
                  />
                </label>
                <label className="text-sm font-medium text-[#1C3A2A]">
                  💧 Watering
                  <input
                    className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                    value={newCareWater}
                    onChange={(e) => setNewCareWater(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. Every 2–3 days"
                  />
                </label>
                <label className="text-sm font-medium text-[#1C3A2A]">
                  🪴 Soil
                  <input
                    className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                    value={newCareSoil}
                    onChange={(e) => setNewCareSoil(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. Well-draining mix"
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className="mt-3">
            <p className="text-sm font-medium text-[#1C3A2A]">Variants / pack sizes (optional — SKUs are generated automatically)</p>
            {newVariants.map((v, i) => (
              <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="min-w-40 flex-1 rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2 text-sm text-[#1C3A2A]"
                  value={v.label}
                  onChange={(e) => setNewVariants((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  maxLength={80}
                  placeholder="e.g. Tray of 104"
                />
                <input
                  className="w-28 rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2 text-sm text-[#1C3A2A]"
                  value={v.price}
                  inputMode="numeric"
                  onChange={(e) => setNewVariants((p) => p.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/\D/g, "") } : x)))}
                  placeholder="₹"
                />
                <Btn kind="ghost" onClick={() => setNewVariants((p) => p.filter((_, j) => j !== i))}>
                  Remove
                </Btn>
              </div>
            ))}
            <div className="mt-2">
              <Btn kind="ghost" onClick={() => setNewVariants((p) => [...p, { label: "", price: "" }])} disabled={newVariants.length >= 10}>
                + Add variant
              </Btn>
            </div>
          </div>

          {createError ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{createError}</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Btn onClick={createProduct} disabled={creating}>
              {creating ? "Creating…" : "+ Create product"}
            </Btn>
            {createOk ? <Pill tone="green">✓ {createOk}</Pill> : null}
          </div>
        </Card>
      ) : null}

      {products.map((p) => {
        const busy = busyId === p.id;
        const dp = displayPriceOf(p, null);

        return (
          <Card key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-[#1C3A2A]">{p.nameEn}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Pill tone="green">{p.category}</Pill>
                  {p.subCategory ? <Pill tone="blue">{subLabel(p.category, p.subCategory)}</Pill> : null}
                  {p.rescue ? <Pill tone="amber">Discount {p.rescue.pct}% off</Pill> : null}
                  {p.hidden ? <Pill tone="gray">Hidden</Pill> : null}
                </div>
              </div>
              {canManage.products ? (
                <Btn kind="ghost" onClick={() => (editingId === p.id ? setEditingId(null) : startEdit(p))}>
                  {editingId === p.id ? "Close" : "Edit"}
                </Btn>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt={p.nameEn} className="h-14 w-14 rounded-xl border border-[#1C3A2A]/10 object-cover" />
              ) : null}
              {canManage.products ? (
                <label
                  className={`cursor-pointer rounded-xl border border-[#D6D2BC] bg-white px-3 py-2 text-sm font-semibold text-[#1C3A2A] transition hover:border-[#2F6B3F] ${
                    photoBusyId === p.id ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  📷 {p.image ? "Replace photo" : "Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPhotoPick(p, e)}
                  />
                </label>
              ) : null}
              {photoBusyId === p.id ? <span className="text-xs font-medium text-[#66735F]">Uploading…</span> : null}
            </div>

            <p className="mt-3 text-sm text-[#1C3A2A]/70">
              From {inr(dp.now)}
              {dp.before > dp.now ? (
                <>
                  {" · was "}
                  <span className="line-through">{inr(dp.before)}</span>
                </>
              ) : null}{" "}
              · MRP {inr(p.mrp)}
            </p>

            {p.variants.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-[#1C3A2A]/70">
                {p.variants.map((v) => (
                  <li key={v.id}>
                    {v.label} — {inr(v.price)}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-[#1C3A2A]/60">
                Stock: <b className="text-[#1C3A2A]">{p.stock}</b>
              </span>
              {canManage.products ? (
                <>
                  <Btn kind="ghost" onClick={() => quickStock(p, -1)} disabled={busy}>
                    -1
                  </Btn>
                  <Btn kind="ghost" onClick={() => quickStock(p, 1)} disabled={busy}>
                    +1
                  </Btn>
                  <Btn kind="ghost" onClick={() => quickStock(p, -10)} disabled={busy}>
                    -10
                  </Btn>
                  <Btn kind="ghost" onClick={() => quickStock(p, 10)} disabled={busy}>
                    +10
                  </Btn>
                  <Btn kind="ghost" onClick={() => patch(p.id, { hidden: !p.hidden })} disabled={busy}>
                    {p.hidden ? "Unhide" : "Hide"}
                  </Btn>
                </>
              ) : null}
            </div>

            {editingId === p.id ? (
              <div className="mt-4 space-y-3 rounded-xl bg-[#F7F3E8] p-4">
                <label className="block text-sm font-medium text-[#1C3A2A]">
                  Product name
                  <input
                    className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={120}
                  />
                </label>

                <label className="block text-sm font-medium text-[#1C3A2A]">
                  Subcategory
                  <select
                    className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                    value={form.sub}
                    onChange={(e) => setForm({ ...form, sub: e.target.value })}
                  >
                    <option value="">— none —</option>
                    {subOptionsFor(p.category).map((s) => (
                      <option key={s.v} value={s.v}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-medium text-[#1C3A2A]">
                    Price (₹)
                    <input
                      className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                      value={form.price}
                      inputMode="numeric"
                      onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#1C3A2A]">
                    MRP (₹)
                    <input
                      className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                      value={form.mrp}
                      inputMode="numeric"
                      onChange={(e) => setForm({ ...form, mrp: e.target.value.replace(/\D/g, "") })}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#1C3A2A]">
                    Stock
                    <input
                      className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                      value={form.stock}
                      inputMode="numeric"
                      onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, "") })}
                    />
                  </label>
                </div>

                {CARE_CATS.includes(p.category) ? (
                  <div>
                    <p className="text-sm font-medium text-[#1C3A2A]">Care guide (shown on the buyer's cart and order page)</p>
                    <div className="mt-1 grid gap-3 sm:grid-cols-3">
                      <label className="text-sm font-medium text-[#1C3A2A]">
                        ☀️ Sunlight
                        <input
                          className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                          value={form.careSun}
                          onChange={(e) => setForm({ ...form, careSun: e.target.value })}
                          maxLength={80}
                        />
                      </label>
                      <label className="text-sm font-medium text-[#1C3A2A]">
                        💧 Watering
                        <input
                          className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                          value={form.careWater}
                          onChange={(e) => setForm({ ...form, careWater: e.target.value })}
                          maxLength={80}
                        />
                      </label>
                      <label className="text-sm font-medium text-[#1C3A2A]">
                        🪴 Soil
                        <input
                          className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                          value={form.careSoil}
                          onChange={(e) => setForm({ ...form, careSoil: e.target.value })}
                          maxLength={80}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                <label className="flex items-center gap-2 text-sm font-medium text-[#1C3A2A]">
                  <input
                    type="checkbox"
                    checked={form.hidden}
                    onChange={(e) => setForm({ ...form, hidden: e.target.checked })}
                  />
                  Hidden from storefront
                </label>

                {canManage.rescue ? (
                  <label className="flex items-center gap-2 text-sm font-medium text-[#1C3A2A]">
                    <input
                      type="checkbox"
                      checked={form.rescueOn}
                      onChange={(e) => setForm({ ...form, rescueOn: e.target.checked })}
                    />
                    Discount Center listing (discounted, limited days)
                  </label>
                ) : null}

                {form.rescueOn ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-[#1C3A2A]">
                      Discount %
                      <input
                        className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                        value={form.rescuePct}
                        inputMode="numeric"
                        onChange={(e) => setForm({ ...form, rescuePct: e.target.value.replace(/\D/g, "") })}
                      />
                    </label>
                    <label className="text-sm font-medium text-[#1C3A2A]">
                      Days visible
                      <input
                        className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                        value={form.rescueDays}
                        inputMode="numeric"
                        onChange={(e) => setForm({ ...form, rescueDays: e.target.value.replace(/\D/g, "") })}
                      />
                    </label>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Btn onClick={() => saveEdit(p)} disabled={busy}>
                    Save
                  </Btn>
                  <Btn kind="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Btn>
                </div>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}