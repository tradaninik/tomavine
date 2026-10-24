"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Btn, Card, Empty, ErrBox, Loading, Pill, Stat, inputCls, inr } from "../ui";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

// ─────────────────────────────────────────────────────────────
// Mission F — the admin plant-catalog console.
//
// Answers the owner's exact complaint: "in the category section I
// can disable but I cannot add any plants." Create plants for ANY
// nursery here, mapped onto the two-level category tree (the same
// counts the Categories console shows), edit price/stock/name,
// remap a misplaced product, transfer it to another nursery, or
// hide it from the storefront. Nursery admins keep their own add
// flow in the seller console — both write the same mapping.
//
// Photos stay in the seller console (📷 per product there); this
// console is intentionally text-and-numbers.
// ─────────────────────────────────────────────────────────────

type Cat = {
  id: string;
  slug: string;
  parentId: string | null;
  names: Record<string, string> | null;
  emoji: string | null;
  active: boolean;
};

type PlantRow = {
  id: string;
  nameEn: string;
  botanical: string | null;
  priceMin: number;
  mrp: number;
  stock: number;
  hidden: boolean;
  image: string | null;
  createdAt: string;
  nurseryId: string;
  nurseryName: string;
  nurseryStatus: string;
  categoryId: string | null;
  category: string;
  top: { slug: string; label: string; emoji: string | null } | null;
  sub: { slug: string; label: string; emoji: string | null } | null;
};

type NurseryOpt = { id: string; name: string; status: string };

type CreateForm = {
  nurseryId: string;
  topId: string;
  subId: string;
  nameEn: string;
  botanical: string;
  price: string;
  mrp: string;
  stock: string;
};

type EditForm = {
  nameEn: string;
  botanical: string;
  price: string;
  mrp: string;
  stock: string;
  nurseryId: string;
  topId: string;
  subId: string;
};

const EMPTY_CREATE: CreateForm = {
  nurseryId: "",
  topId: "",
  subId: "",
  nameEn: "",
  botanical: "",
  price: "",
  mrp: "",
  stock: "0",
};

function catLabel(c: Cat): string {
  return c.names && typeof c.names.en === "string" && c.names.en.length > 0 ? c.names.en : c.slug;
}

const VIEW_TABS = ["all", "visible", "hidden"] as const;
type ViewTab = (typeof VIEW_TABS)[number];

function tabCls(active: boolean): string {
  return active
    ? "rounded-xl bg-[#2F6B3F] px-4 py-1.5 text-sm font-semibold text-white"
    : "rounded-xl px-4 py-1.5 text-sm font-semibold text-[#1C3A2A]/60 hover:bg-[#F7F3E8]";
}

function stockTone(stock: number): "leaf" | "amber" | "rose" {
  if (stock === 0) {
    return "rose";
  }
  if (stock <= 10) {
    return "amber";
  }
  return "leaf";
}

export default function AdminPlantsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  const [products, setProducts] = useState<PlantRow[]>([]);
  const [nurseries, setNurseries] = useState<NurseryOpt[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [summary, setSummary] = useState({ total: 0, hidden: 0, unmapped: 0 });

  // Filters
  const [nurseryFilter, setNurseryFilter] = useState("all");
  const [topFilter, setTopFilter] = useState("all");
  const [view, setView] = useState<ViewTab>("all");
  const [q, setQ] = useState("");

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [quickBusyId, setQuickBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    let active = true;
    // Stale-while-revalidate: no synchronous setState in the effect
    // body — loading only flips inside the async callbacks.
    Promise.all([
      fetch("/api/admin/plants").then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed")))),
      fetch("/api/admin/categories")
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
        .catch(() => ({ categories: [] })),
    ])
      .then(
        (
          parts: [
            { products?: unknown[]; nurseries?: unknown[]; summary?: { total: number; hidden: number; unmapped: number } },
            { categories?: unknown[] },
          ],
        ) => {
          if (!active) {
            return;
          }
          const plants = parts[0];
          const tree = parts[1];
          if (Array.isArray(plants.products)) {
            setProducts(plants.products as PlantRow[]);
          }
          if (Array.isArray(plants.nurseries)) {
            setNurseries(plants.nurseries as NurseryOpt[]);
          }
          if (plants.summary) {
            setSummary(plants.summary);
          }
          if (Array.isArray(tree.categories)) {
            setCats(tree.categories as Cat[]);
          }
        },
      )
      .catch(() => {
        if (active) {
          setError(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const tops = cats
    .filter((c) => c.parentId === null && c.active)
    .sort((a, b) => catLabel(a).localeCompare(catLabel(b)));
  const subsOf = (topId: string) =>
    cats.filter((c) => c.parentId === topId && c.active).sort((a, b) => catLabel(a).localeCompare(catLabel(b)));

  const filtered = products.filter((p) => {
    if (nurseryFilter !== "all" && p.nurseryId !== nurseryFilter) {
      return false;
    }
    if (topFilter !== "all" && (!p.top || p.top.slug !== topFilter)) {
      return false;
    }
    if (view === "visible" && p.hidden) {
      return false;
    }
    if (view === "hidden" && !p.hidden) {
      return false;
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const hay = `${p.nameEn} ${p.botanical ?? ""} ${p.nurseryName} ${p.sub ? p.sub.label : ""} ${p.top ? p.top.label : ""}`.toLowerCase();
      if (!hay.includes(needle)) {
        return false;
      }
    }
    return true;
  });

  function setField<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function changeTop(topId: string) {
    // A new top resets the sub — the sub list depends on it.
    setForm((f) => ({ ...f, topId: topId, subId: "" }));
  }

  function validateCreate(): string {
    if (form.nurseryId === "") {
      return "Pick the nursery this plant belongs to.";
    }
    if (form.topId === "" || form.subId === "") {
      return "Pick a category — top and sub.";
    }
    if (form.nameEn.trim().length < 2) {
      return "Plant name — at least 2 characters.";
    }
    const price = Number(form.price);
    const mrp = Number(form.mrp);
    if (!Number.isInteger(price) || price < 1) {
      return "Price must be a whole number of at least ₹1.";
    }
    if (!Number.isInteger(mrp) || mrp < 1) {
      return "MRP must be a whole number of at least ₹1.";
    }
    if (price > mrp) {
      return "Price cannot be higher than MRP.";
    }
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return "Stock cannot be negative.";
    }
    return "";
  }

  async function submitCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creating) {
      return;
    }
    setFormError("");
    setFormOk("");
    const problem = validateCreate();
    if (problem) {
      setFormError(problem);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nurseryId: form.nurseryId,
          categoryId: form.subId,
          nameEn: form.nameEn.trim(),
          botanical: form.botanical.trim(),
          priceMin: Number(form.price),
          mrp: Number(form.mrp),
          stock: Number(form.stock),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data && typeof data.error === "string" ? data.error : "failed";
        if (code === "bad_category") {
          throw new Error("That category changed — reload the page and pick again.");
        }
        if (code === "bad_nursery") {
          throw new Error("That nursery no longer exists — reload the page.");
        }
        if (code === "price_above_mrp") {
          throw new Error("Price cannot be higher than MRP.");
        }
        throw new Error("Some fields need attention — check the form and retry.");
      }
      setFormOk(`Added “${form.nameEn.trim()}” — the category counts already include it.`);
      setForm(EMPTY_CREATE);
      setReload((x) => x + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add the plant — please retry.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(p: PlantRow) {
    setEditingId(p.id);
    setEditError("");
    setActionMsg("");
    // Seed the top/sub selects from the product's current mapping.
    const topId = tops.find((t) => t.slug === (p.top ? p.top.slug : ""))?.id ?? "";
    setEdit({
      nameEn: p.nameEn,
      botanical: p.botanical ?? "",
      price: String(p.priceMin),
      mrp: String(p.mrp),
      stock: String(p.stock),
      nurseryId: p.nurseryId,
      topId: topId,
      subId: p.categoryId ?? "",
    });
  }

  function setEditField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setEdit((f) => (f ? { ...f, [key]: value } : f));
  }

  function changeEditTop(topId: string) {
    setEdit((f) => (f ? { ...f, topId: topId, subId: "" } : f));
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || editingId === null || edit === null) {
      return;
    }
    setEditError("");
    const price = Number(edit.price);
    const mrp = Number(edit.mrp);
    const stock = Number(edit.stock);
    if (edit.nameEn.trim().length < 2) {
      setEditError("Plant name — at least 2 characters.");
      return;
    }
    if (!Number.isInteger(price) || price < 1) {
      setEditError("Price must be a whole number of at least ₹1.");
      return;
    }
    if (!Number.isInteger(mrp) || mrp < 1) {
      setEditError("MRP must be a whole number of at least ₹1.");
      return;
    }
    if (price > mrp) {
      setEditError("Price cannot be higher than MRP.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setEditError("Stock cannot be negative.");
      return;
    }
    if (edit.topId === "" || edit.subId === "") {
      setEditError("Pick a category — top and sub.");
      return;
    }
    if (edit.nurseryId === "") {
      setEditError("Pick the nursery this plant belongs to.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/plants/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEn: edit.nameEn.trim(),
          priceMin: price,
          mrp: mrp,
          stock: stock,
          categoryId: edit.subId,
          nurseryId: edit.nurseryId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data && data.error === "not_found") {
          throw new Error("That plant no longer exists — refresh the page.");
        }
        throw new Error("Could not save — check the values and retry.");
      }
      setEditingId(null);
      setEdit(null);
      setActionMsg("Saved.");
      setReload((x) => x + 1);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save — please retry.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleHidden(p: PlantRow) {
    if (quickBusyId) {
      return;
    }
    setQuickBusyId(p.id);
    setActionMsg("");
    try {
      const res = await fetch(`/api/admin/plants/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !p.hidden }),
      });
      if (!res.ok) {
        throw new Error("failed");
      }
      setActionMsg(p.hidden ? `“${p.nameEn}” is visible again.` : `“${p.nameEn}” is hidden from the storefront.`);
      setReload((x) => x + 1);
    } catch {
      setActionMsg("That change didn't go through — please retry.");
    } finally {
      setQuickBusyId(null);
    }
  }

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <ErrBox>
        <p className="mb-2">Could not load the plant catalog — please retry.</p>
        <Btn
          size="sm"
          onClick={() => {
            setLoading(true);
            setError(false);
            setReload((x) => x + 1);
          }}
        >
          Retry
        </Btn>
      </ErrBox>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={SERIF}>
            Plants
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#66735F]">
            The whole catalog across every nursery. Adding a plant here (or from a nursery admin&apos;s seller console) updates
            the category counts you see under Catalog → Categories.
          </p>
        </div>
        <Btn
          onClick={() => {
            setCreateOpen((o) => !o);
            setFormOk("");
            setFormError("");
          }}
        >
          {createOpen ? "Close form" : "➕ Add a plant"}
        </Btn>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Products" value={String(summary.total)} hint={`${nurseries.length} nurseries`} />
        <Stat label="Visible" value={String(summary.total - summary.hidden)} hint="on the storefront" />
        <Stat label="Hidden" value={String(summary.hidden)} hint="not on the storefront" />
        <Stat
          label="Unmapped"
          value={String(summary.unmapped)}
          hint={summary.unmapped > 0 ? "pick a category via Edit" : "all mapped to the tree"}
        />
      </div>

      {createOpen ? (
        <Card>
          <p className="text-xl font-semibold text-[#20291D]" style={SERIF}>
            ➕ Add a plant
          </p>
          <p className="mt-1 text-xs text-[#66735F]">
            Photos are added by the nursery admin (or you) from the seller console afterwards — the 📷 button next to each
            product there.
          </p>
          <form onSubmit={submitCreate} className="mt-4 space-y-4">
            <div className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Nursery</span>
                <select className={inputCls} value={form.nurseryId} onChange={(e) => setField("nurseryId", e.target.value)}>
                  <option value="">Select nursery…</option>
                  {nurseries.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} · {n.status === "VERIFIED" ? "verified" : n.status.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Plant name (English)</span>
                <input
                  className={inputCls}
                  value={form.nameEn}
                  maxLength={120}
                  placeholder="e.g. Curry Leaf Plant"
                  onChange={(e) => setField("nameEn", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Category — top</span>
                <select className={inputCls} value={form.topId} onChange={(e) => changeTop(e.target.value)}>
                  <option value="">Select top…</option>
                  {tops.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emoji ? `${t.emoji} ` : ""}
                      {catLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Category — sub</span>
                <select
                  className={inputCls}
                  value={form.subId}
                  onChange={(e) => setField("subId", e.target.value)}
                  disabled={form.topId === ""}
                >
                  <option value="">{form.topId === "" ? "Pick a top first…" : "Select sub…"}</option>
                  {subsOf(form.topId).map((s) => (
                    <option key={s.id} value={s.id}>
                      {catLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Botanical name (optional)</span>
                <input
                  className={inputCls}
                  value={form.botanical}
                  maxLength={120}
                  placeholder="e.g. Murraya koenigii"
                  onChange={(e) => setField("botanical", e.target.value)}
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Price ₹</span>
                  <input
                    className={inputCls}
                    value={form.price}
                    inputMode="numeric"
                    placeholder="149"
                    onChange={(e) => setField("price", e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">MRP ₹</span>
                  <input
                    className={inputCls}
                    value={form.mrp}
                    inputMode="numeric"
                    placeholder="199"
                    onChange={(e) => setField("mrp", e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Stock</span>
                  <input
                    className={inputCls}
                    value={form.stock}
                    inputMode="numeric"
                    placeholder="0"
                    onChange={(e) => setField("stock", e.target.value.replace(/\D/g, ""))}
                  />
                </label>
              </div>
            </div>

            {formError ? <ErrBox>{formError}</ErrBox> : null}
            {formOk ? (
              <p className="rounded-xl bg-[#2F6B3F]/10 px-3 py-2 text-sm font-semibold text-[#2F6B3F]">{formOk}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-[#E4E0CE] pt-4">
              <Btn type="submit" disabled={creating}>
                {creating ? "Adding…" : "Add plant"}
              </Btn>
              <span className="text-xs text-[#8E9A84]">Every addition is audit-logged (product.create).</span>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-40">
            <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Nursery</span>
            <select className={inputCls} value={nurseryFilter} onChange={(e) => setNurseryFilter(e.target.value)}>
              <option value="all">All nurseries</option>
              {nurseries.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-40">
            <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Category</span>
            <select className={inputCls} value={topFilter} onChange={(e) => setTopFilter(e.target.value)}>
              <option value="all">All categories</option>
              {tops.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.emoji ? `${t.emoji} ` : ""}
                  {catLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-44 flex-1">
            <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Search</span>
            <input
              className={inputCls}
              value={q}
              placeholder="Name, botanical, nursery…"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {VIEW_TABS.map((t) => (
            <button key={t} type="button" onClick={() => setView(t)} className={tabCls(view === t)}>
              {t === "all"
                ? `All (${products.length})`
                : t === "visible"
                  ? `Visible (${products.length - summary.hidden})`
                  : `Hidden (${summary.hidden})`}
            </button>
          ))}
        </div>
      </Card>

      {actionMsg ? (
        <p className="rounded-xl bg-[#2F6B3F]/10 px-3 py-2 text-sm font-semibold text-[#2F6B3F]">{actionMsg}</p>
      ) : null}

      {filtered.length === 0 ? (
        <Empty emoji="🪴" title="No plants match" text="Clear the filters, or add the first plant with the button above." />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const editing = editingId === p.id && edit !== null;
            return (
              <Card key={p.id} className={p.hidden ? "opacity-70" : ""}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-[#20291D]" style={SERIF}>
                      {p.image ? "🖼️" : "🌱"} {p.nameEn}
                      {p.hidden ? (
                        <span className="ml-2 align-middle">
                          <Pill tone="rose">Hidden</Pill>
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E9A84]">
                      {p.botanical ? <span className="italic">{p.botanical} · </span> : null}
                      {p.nurseryName} · added{" "}
                      {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.top && p.sub ? (
                      <Pill tone="leaf">
                        {p.top.emoji ? `${p.top.emoji} ` : ""}
                        {p.top.label} › {p.sub.label}
                      </Pill>
                    ) : (
                      <Pill tone="amber">Unmapped — pick a category via Edit</Pill>
                    )}
                    <Pill tone={stockTone(p.stock)}>{p.stock} in stock</Pill>
                    <span className="text-sm font-bold text-[#20291D]">
                      {inr(p.priceMin)}
                      {p.mrp > p.priceMin ? (
                        <span className="ml-1 text-xs font-normal text-[#8E9A84] line-through">{inr(p.mrp)}</span>
                      ) : null}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#E4E0CE] pt-3">
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (editing) {
                        setEditingId(null);
                        setEdit(null);
                      } else {
                        startEdit(p);
                      }
                    }}
                  >
                    {editing ? "Close editor" : "✏️ Edit"}
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => toggleHidden(p)} disabled={quickBusyId === p.id}>
                    {p.hidden ? "👁️ Show on storefront" : "🚫 Hide from storefront"}
                  </Btn>
                </div>

                {editing && edit ? (
                  <form onSubmit={saveEdit} className="mt-4 space-y-4 border-t border-[#E4E0CE] pt-4">
                    <div className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Plant name</span>
                        <input
                          className={inputCls}
                          value={edit.nameEn}
                          maxLength={120}
                          onChange={(e) => setEditField("nameEn", e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">
                          Botanical name (optional)
                        </span>
                        <input
                          className={inputCls}
                          value={edit.botanical}
                          maxLength={120}
                          onChange={(e) => setEditField("botanical", e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Nursery</span>
                        <select
                          className={inputCls}
                          value={edit.nurseryId}
                          onChange={(e) => setEditField("nurseryId", e.target.value)}
                        >
                          {nurseries.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Price ₹</span>
                          <input
                            className={inputCls}
                            value={edit.price}
                            inputMode="numeric"
                            onChange={(e) => setEditField("price", e.target.value.replace(/\D/g, ""))}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">MRP ₹</span>
                          <input
                            className={inputCls}
                            value={edit.mrp}
                            inputMode="numeric"
                            onChange={(e) => setEditField("mrp", e.target.value.replace(/\D/g, ""))}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Stock</span>
                          <input
                            className={inputCls}
                            value={edit.stock}
                            inputMode="numeric"
                            onChange={(e) => setEditField("stock", e.target.value.replace(/\D/g, ""))}
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Category — top</span>
                        <select className={inputCls} value={edit.topId} onChange={(e) => changeEditTop(e.target.value)}>
                          <option value="">Select top…</option>
                          {tops.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.emoji ? `${t.emoji} ` : ""}
                              {catLabel(t)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#66735F]">Category — sub</span>
                        <select
                          className={inputCls}
                          value={edit.subId}
                          onChange={(e) => setEditField("subId", e.target.value)}
                          disabled={edit.topId === ""}
                        >
                          <option value="">{edit.topId === "" ? "Pick a top first…" : "Select sub…"}</option>
                          {subsOf(edit.topId).map((s) => (
                            <option key={s.id} value={s.id}>
                              {catLabel(s)}
                            </option>
                          ))}
                        </select>
                        {p.categoryId && edit.subId !== p.categoryId ? (
                          <span className="mt-1 block text-xs text-[#8E9A84]">
                            Remapping also fixes the legacy storefront string ({p.category} → new top).
                          </span>
                        ) : null}
                      </label>
                    </div>

                    {editError ? <ErrBox>{editError}</ErrBox> : null}

                    <div className="flex flex-wrap items-center gap-3 border-t border-[#E4E0CE] pt-4">
                      <Btn type="submit" disabled={saving}>
                        {saving ? "Saving…" : "Save changes"}
                      </Btn>
                      <Btn
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEdit(null);
                          setEditError("");
                        }}
                      >
                        Cancel
                      </Btn>
                      <span className="text-xs text-[#8E9A84]">Every save is audit-logged (product.update).</span>
                    </div>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
