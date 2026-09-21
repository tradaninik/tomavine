"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Pill, inr } from "../ui";

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
  nameEn: string;
  priceMin: number;
  mrp: number;
  stock: number;
  hidden: boolean;
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
  price: string;
  mrp: string;
  stock: string;
  hidden: boolean;
  rescueOn: boolean;
  rescuePct: string;
  rescueDays: string;
};

const EMPTY_FORM: FormState = {
  price: "",
  mrp: "",
  stock: "",
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
  const [newName, setNewName] = useState("");
  const [newBotanical, setNewBotanical] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newMrp, setNewMrp] = useState("");
  const [newStock, setNewStock] = useState("");
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

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/seller/products");

      if (!res.ok) throw new Error("failed");

      const data = await res.json();
      setProducts(data.products);
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
    setEditingId(p.id);
    setForm({
      price: String(p.priceMin),
      mrp: String(p.mrp),
      stock: String(p.stock),
      hidden: p.hidden,
      rescueOn: p.rescue !== null,
      rescuePct: p.rescue ? String(p.rescue.pct) : "30",
      rescueDays: "3",
    });
  }

  async function saveEdit(p: Product) {
    const payload: Record<string, unknown> = {
      price: Number(form.price),
      mrp: Number(form.mrp),
      stock: Number(form.stock),
      hidden: form.hidden,
    };

    if (form.rescueOn) {
      payload.rescue = { pct: Number(form.rescuePct), days: Number(form.rescueDays) };
    } else if (p.rescue) {
      payload.rescue = null;
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
    setNewVariety("");
    setNewPlantType("");
    setNewSize("");
    setNewInputTerm("");
    setInputNote("");
    setNewNames({});
    setNewAgri(null);
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
    setNewBotanical("");
    setNewPrice("");
    setNewMrp("");
    setNewStock("");
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

  async function createProduct() {
    setCreateError("");
    setCreateOk("");

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

      setCreateOk(`Added “${name}”.`);
      resetNew();
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  if (loading && products.length === 0) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[#1C3A2A]">Products</h1>
        <Btn onClick={openNew}>{newOpen ? "Close form" : "+ New product"}</Btn>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      {newOpen ? (
        <Card>
          <p className="font-bold text-[#1C3A2A]">New product</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#1C3A2A]">
              Category
              <select
                className="mt-1 w-full rounded-lg border border-[#1C3A2A]/20 bg-white px-3 py-2"
                value={newCat}
                onChange={(e) => changeCat(e.target.value)}
              >
                <option value="plants">🪴 Plants</option>
                <option value="saplings">🌾 Saplings</option>
                <option value="inputs">🧪 Inputs</option>
                <option value="pots">🏺 Pots</option>
                <option value="tools">🛠️ Tools</option>
              </select>
            </label>

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

        return (
          <Card key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-[#1C3A2A]">{p.nameEn}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Pill tone="green">{p.category}</Pill>
                  {p.rescue ? <Pill tone="amber">Rescue {p.rescue.pct}% off</Pill> : null}
                  {p.hidden ? <Pill tone="gray">Hidden</Pill> : null}
                </div>
              </div>
              <Btn kind="ghost" onClick={() => (editingId === p.id ? setEditingId(null) : startEdit(p))}>
                {editingId === p.id ? "Close" : "Edit"}
              </Btn>
            </div>

            <p className="mt-3 text-sm text-[#1C3A2A]/70">
              From {inr(p.priceMin)} · MRP {inr(p.mrp)}
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
            </div>

            {editingId === p.id ? (
              <div className="mt-4 space-y-3 rounded-xl bg-[#F7F3E8] p-4">
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

                <label className="flex items-center gap-2 text-sm font-medium text-[#1C3A2A]">
                  <input
                    type="checkbox"
                    checked={form.hidden}
                    onChange={(e) => setForm({ ...form, hidden: e.target.checked })}
                  />
                  Hidden from storefront
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-[#1C3A2A]">
                  <input
                    type="checkbox"
                    checked={form.rescueOn}
                    onChange={(e) => setForm({ ...form, rescueOn: e.target.checked })}
                  />
                  Rescue Corner listing (discounted, limited days)
                </label>

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