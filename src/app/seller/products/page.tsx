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

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

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

  if (loading && products.length === 0) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1C3A2A]">Products</h1>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

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