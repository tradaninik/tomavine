"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Btn, Card, Empty, ErrBox, Loading, Pill, inputCls } from "../ui";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

// ─────────────────────────────────────────────────────────────
// Mission X2 — the category-tree console, rebuilt around three
// complaints from the first pass:
//
//   1. "count isn't seen"  → every top now carries a three-tile
//      count strip (products / here / in subs) and every sub row
//      shows its own count inline.
//   2. "deactivating the subs — steps aren't clear" → no more
//      native confirm() dialogs. Deactivate swaps the row's own
//      actions into an inline question with the consequence
//      written out; one more tap does it, Keep backs out.
//   3. "Taxonomy needs to link + insights by region and other
//      types" → an insights card above the tree: translation
//      coverage per region (click a language to list what's
//      missing, click a node to edit it), the attribute types
//      with term counts (deep-links into the taxonomy console's
//      kind tabs), and the product-mapping distribution.
// ─────────────────────────────────────────────────────────────

type Cat = {
  id: string;
  slug: string;
  parentId: string | null;
  names: Record<string, string> | null;
  emoji: string | null;
  gstRate: number | null;
  legacyKey: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
};

type KindSum = { code: string; label: string; emoji: string; total: number; active: number };

const REGIONAL_LANGS: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ta", label: "Tamil" },
  { code: "mr", label: "Marathi" },
];

// Region chips use the language's own name — the owner curates
// translations here, so the chip should read the way the storefront
// will show it.
const REGIONS: { code: string; native: string; label: string }[] = [
  { code: "en", native: "English", label: "English" },
  { code: "hi", native: "हिन्दी", label: "Hindi" },
  { code: "te", native: "తెలుగు", label: "Telugu" },
  { code: "kn", native: "ಕನ್ನಡ", label: "Kannada" },
  { code: "ta", native: "தமிழ்", label: "Tamil" },
  { code: "mr", native: "मराठी", label: "Marathi" },
];

const GST_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Inherit (subs) / platform default (tops)" },
  { value: "0", label: "0% — exempt" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

const FILTERS: { v: "all" | "active" | "off"; label: string }[] = [
  { v: "all", label: "All" },
  { v: "active", label: "Active" },
  { v: "off", label: "Inactive" },
];

function enOf(c: Cat): string {
  return c.names?.en ?? c.slug;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function errText(code: string, label: string): string {
  switch (code) {
    case "duplicate":
      return `The slug is already taken — “${label}” was not saved. Slugs are identity, pick another.`;
    case "bad_parent":
      return "Invalid parent — a sub can only sit under a top-level category.";
    case "has_children":
      return "This category has subcategories, so it must stay top-level (the tree is two levels deep).";
    case "invalid_slug":
      return "Slug must be lowercase kebab-case (letters, digits, single dashes), e.g. fruit-plants.";
    case "invalid":
      return "That didn't validate — English name is required; keep names under 120 characters.";
    case "not_found":
      return "That category disappeared — reload the page.";
    default:
      return "Action failed — try again.";
  }
}

function gstLabel(c: Cat, isTop: boolean): string {
  if (c.gstRate === null) {
    return isTop ? "default" : "inherit";
  }
  return `${c.gstRate}%`;
}

function NamesLine({ names }: { names: Record<string, string> | null }) {
  const entries = names ? Object.entries(names).filter(([k]) => k !== "en") : [];
  if (entries.length === 0) {
    return null;
  }
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#66735F]">
      {entries.map(([lang, val]) => (
        <span key={lang}>
          {lang} · {val}
        </span>
      ))}
    </p>
  );
}

type FormState = {
  id: string | null; // null = create, set = edit
  parentId: string; // "" = top level
  slug: string; // create only
  en: string;
  regional: Record<string, string>;
  emoji: string;
  gst: string; // "" | "0" | "5" ...
  sortOrder: string;
};

function blankForm(): FormState {
  return {
    id: null,
    parentId: "",
    slug: "",
    en: "",
    regional: { hi: "", te: "", kn: "", ta: "", mr: "" },
    emoji: "",
    gst: "",
    sortOrder: "",
  };
}

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [unmapped, setUnmapped] = useState(0);
  const [kinds, setKinds] = useState<KindSum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "off">("all");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null); // inline deactivation confirm
  const [actError, setActError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [missingLang, setMissingLang] = useState<string | null>(null); // expanded region chip

  useEffect(() => {
    let active = true;
    // State updates happen only in async callbacks (then/catch/
    // finally), never synchronously in the effect body — the
    // initial load spins via useState(true); a reload keeps the
    // current tree on screen until fresh data lands.
    fetch("/api/admin/categories")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (active && data && Array.isArray(data.categories)) {
          setCats(data.categories);
          setCounts(data.counts ?? {});
          setUnmapped(typeof data.unmapped === "number" ? data.unmapped : 0);
          setKinds(Array.isArray(data.taxonomy) ? data.taxonomy : []);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const tops = cats
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
  const subsOf = (id: string) =>
    cats
      .filter((c) => c.parentId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
  const ownCountOf = (c: Cat) => counts[c.id] ?? 0;
  const treeCountOf = (top: Cat) => ownCountOf(top) + subsOf(top.id).reduce((sum, s) => sum + ownCountOf(s), 0);
  const activeCount = cats.filter((c) => c.active).length;
  const inactiveCount = cats.length - activeCount;

  // Region coverage — how many nodes carry a name in each language.
  const filledIn = (code: string) => cats.filter((c) => (c.names?.[code] ?? "").trim() !== "").length;
  const missingIn = (code: string) => cats.filter((c) => (c.names?.[code] ?? "").trim() === "");

  const mappedTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const productTotal = mappedTotal + unmapped;

  const q = query.trim().toLowerCase();
  const matches = (c: Cat) =>
    q === "" ||
    enOf(c).toLowerCase().includes(q) ||
    c.slug.toLowerCase().includes(q) ||
    (c.legacyKey ?? "").toLowerCase().includes(q) ||
    Object.values(c.names ?? {}).some((v) => v.toLowerCase().includes(q));

  function openCreate(parentId = "") {
    setForm({ ...blankForm(), parentId });
    setFormError("");
    setOkMsg("");
    setPendingId(null);
  }

  function openEdit(c: Cat) {
    setForm({
      id: c.id,
      parentId: c.parentId ?? "",
      slug: c.slug,
      en: c.names?.en ?? "",
      regional: {
        hi: c.names?.hi ?? "",
        te: c.names?.te ?? "",
        kn: c.names?.kn ?? "",
        ta: c.names?.ta ?? "",
        mr: c.names?.mr ?? "",
      },
      emoji: c.emoji ?? "",
      gst: c.gstRate === null ? "" : String(c.gstRate),
      sortOrder: String(c.sortOrder),
    });
    setFormError("");
    setOkMsg("");
    setPendingId(null);
  }

  async function doToggle(c: Cat) {
    setBusyId(c.id);
    setActError("");
    try {
      const res = await fetch(`/api/admin/categories/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data && data.error) ?? "failed");
      }
      setCats((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
      setPendingId(null);
      setOkMsg(
        c.active
          ? `“${enOf(c)}” is now inactive — hidden from the storefront browse until reactivated.`
          : `“${enOf(c)}” is back on.`,
      );
    } catch (e) {
      setActError(e instanceof Error ? errText(e.message, enOf(c)) : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  // One row's action cluster. Active nodes swap into an inline
  // question when Deactivate is tapped — the consequence is written
  // next to the buttons, so the "steps" read themselves.
  function actionsFor(c: Cat, isTop: boolean): React.ReactNode {
    if (!c.active) {
      return (
        <Btn size="sm" variant="primary" disabled={busyId === c.id} onClick={() => doToggle(c)}>
          Reactivate
        </Btn>
      );
    }
    if (pendingId === c.id) {
      const activeSubs = isTop ? subsOf(c.id).filter((s) => s.active).length : 0;
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span className="max-w-56 text-xs text-[#8A5A14]">
            Hides from the storefront browse{activeSubs > 0 ? ` — its ${activeSubs} active subs hide too` : ""}.
          </span>
          <Btn size="sm" variant="danger" disabled={busyId === c.id} onClick={() => doToggle(c)}>
            Yes, deactivate
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setPendingId(null)}>
            Keep
          </Btn>
        </span>
      );
    }
    return (
      <Btn size="sm" variant="ghost" onClick={() => setPendingId(c.id)}>
        Deactivate
      </Btn>
    );
  }

  async function submitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) {
      return;
    }
    setFormError("");
    const en = form.en.trim();
    if (en.length < 2) {
      setFormError("The English name needs at least 2 characters.");
      return;
    }
    if (form.id === null && form.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      setFormError("Slug must be lowercase kebab-case, e.g. fruit-plants.");
      return;
    }
    const names: Record<string, string> = { en };
    for (const l of REGIONAL_LANGS) {
      const v = (form.regional[l.code] ?? "").trim();
      if (v) {
        names[l.code] = v;
      }
    }
    const sortRaw = form.sortOrder.trim();
    const sortOrder = sortRaw === "" ? undefined : Number(sortRaw);
    if (sortOrder !== undefined && (!Number.isFinite(sortOrder) || sortOrder < 0)) {
      setFormError("Sort order must be a positive number.");
      return;
    }
    const gst = form.gst === "" ? null : Number(form.gst);
    const editing = form.id !== null;
    const original = editing ? cats.find((c) => c.id === form.id) : null;
    const parentChanged = editing && (original?.parentId ?? "") !== form.parentId;

    const body: Record<string, unknown> = {
      names,
      emoji: form.emoji.trim() === "" ? null : form.emoji.trim(),
      gstRate: gst,
    };
    if (sortOrder !== undefined) {
      body.sortOrder = Math.round(sortOrder);
    }
    if (parentChanged) {
      body.parentId = form.parentId === "" ? null : form.parentId;
    }
    if (!editing) {
      if (form.parentId !== "") {
        body.parentId = form.parentId;
      }
      if (form.slug.trim()) {
        body.slug = form.slug.trim();
      } else {
        body.slug = slugify(en);
        if (body.slug === "") {
          setFormError("Could not derive a slug from that name — type one manually.");
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(editing ? `/api/admin/categories/${form.id}` : "/api/admin/categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data && data.error) ?? "failed");
      }
      setOkMsg(editing ? `Saved “${en}”.` : `Added “${en}”.`);
      setForm(null);
      setReload((x) => x + 1);
    } catch (e) {
      setFormError(e instanceof Error ? errText(e.message, en) : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <ErrBox>
        <p className="mb-2">Could not load categories — please retry. (If Neon was asleep, give it a few seconds first.)</p>
        <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
          Retry
        </Btn>
      </ErrBox>
    );
  }

  const searchPasses = (t: Cat) => matches(t) || subsOf(t.id).some(matches);
  const filterPasses = (t: Cat) => filter === "all" || (filter === "active" ? t.active : !t.active);
  const visibleTops = tops.filter((t) => searchPasses(t) && filterPasses(t));

  // Product distribution — tops that actually hold products, most
  // first. Bar width is relative to the busiest top.
  const distribution = tops
    .map((t) => ({ top: t, n: treeCountOf(t) }))
    .filter((d) => d.n > 0)
    .sort((a, b) => b.n - a.n);
  const maxDist = distribution.length > 0 ? distribution[0].n : 1;

  return (
    <div className="space-y-4">
      <Header
        okMsg={okMsg}
        inactiveCount={inactiveCount}
        unmapped={unmapped}
        total={cats.length}
        onAdd={() => (form ? setForm(null) : openCreate())}
        formOpen={form !== null && form.id === null}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-52 flex-1 sm:max-w-md">
          <input
            className={inputCls}
            placeholder="Search name, slug, legacy key or translation…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm" role="tablist" aria-label="Filter by state">
          {FILTERS.map((f) => {
            const on = filter === f.v;
            return (
              <button
                key={f.v}
                type="button"
                onClick={() => setFilter(f.v)}
                className={
                  on
                    ? "rounded-xl bg-[#2F6B3F] px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1C3A2A]/60 hover:bg-[#F7F3E8]"
                }
              >
                {f.label} · {f.v === "all" ? cats.length : f.v === "active" ? activeCount : inactiveCount}
              </button>
            );
          })}
        </div>
      </div>

      <Insights
        cats={cats}
        kinds={kinds}
        missingLang={missingLang}
        setMissingLang={setMissingLang}
        filledIn={filledIn}
        missingIn={missingIn}
        mappedTotal={mappedTotal}
        productTotal={productTotal}
        unmapped={unmapped}
        distribution={distribution}
        maxDist={maxDist}
        onEditMissing={(c) => openEdit(c)}
      />

      {actError ? <ErrBox>{actError}</ErrBox> : null}

      {form ? (
        <CategoryForm
          form={form}
          setForm={setForm}
          tops={tops}
          cats={cats}
          submitting={submitting}
          formError={formError}
          onSubmit={submitForm}
          onCancel={() => setForm(null)}
        />
      ) : null}

      {visibleTops.length === 0 ? (
        <Empty
          emoji="🌳"
          title={query.trim() ? `Nothing matches “${query.trim()}”` : "No categories yet"}
          text={
            query.trim()
              ? "Try a shorter search, or clear it."
              : "The phase-2a seed should have loaded 56 categories — run scripts/seed-categories.mjs if this is a fresh database."
          }
        />
      ) : (
        <div className="space-y-5">
          {visibleTops.map((t) => {
            const subs = subsOf(t.id).filter((s) => matches(t) || matches(s));
            const allSubs = subsOf(t.id);
            const subsOn = allSubs.filter((s) => s.active).length;
            const inSubs = allSubs.reduce((sum, s) => sum + ownCountOf(s), 0);
            return (
              <Card key={t.id} className={t.active ? "" : "opacity-75"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xl" aria-hidden="true">
                        {t.emoji ?? "🌱"}
                      </span>
                      <p className={`text-xl font-semibold ${t.active ? "text-[#20291D]" : "text-[#8E9A84] line-through"}`} style={SERIF}>
                        {enOf(t)}
                      </p>
                      {!t.active ? <Pill tone="rose">Off</Pill> : null}
                    </div>
                    <p className="mt-1 text-xs text-[#8E9A84]">
                      <code>{t.slug}</code>
                      {t.legacyKey ? <> · legacy <code>{t.legacyKey}</code></> : null} · sort {t.sortOrder}
                    </p>
                    <NamesLine names={t.names} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Btn size="sm" variant="outline" onClick={() => openEdit(t)}>
                      Edit
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => openCreate(t.id)}>
                      + Sub
                    </Btn>
                    {actionsFor(t, true)}
                  </div>
                </div>

                {/* Count strip — the numbers this console exists for. */}
                <div className="mt-3 grid max-w-md grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-[#A9C3A0]/50 bg-[#EDF2E6] px-2 py-2">
                    <p className="text-2xl font-bold text-[#1C3A2A]" style={SERIF}>
                      {treeCountOf(t)}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#66735F]">products</p>
                  </div>
                  <div className="rounded-xl border border-[#1C3A2A]/10 bg-[#F7F3E8] px-2 py-2">
                    <p className="text-2xl font-bold text-[#1C3A2A]" style={SERIF}>
                      {ownCountOf(t)}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#66735F]">here (direct)</p>
                  </div>
                  <div className="rounded-xl border border-[#1C3A2A]/10 bg-[#F7F3E8] px-2 py-2">
                    <p className="text-2xl font-bold text-[#1C3A2A]" style={SERIF}>
                      {inSubs}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#66735F]">in subs</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[#8E9A84]">
                  {subsOn}/{allSubs.length} subs on · GST {gstLabel(t, true)} · turn-off hides the whole branch
                </p>

                {allSubs.length === 0 ? (
                  <p className="mt-3 border-t border-[#E4E0CE] pt-3 text-xs text-[#8E9A84]">
                    No subcategories yet — “+ Sub” adds one.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-[#E4E0CE] border-t border-[#E4E0CE]">
                    {subs.map((s) => {
                      const count = ownCountOf(s);
                      return (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="text-lg" aria-hidden="true">
                              {s.emoji ?? "🌱"}
                            </span>
                            <div className="min-w-0">
                              <p
                                className={`truncate text-sm font-semibold ${
                                  s.active ? "text-[#20291D]" : "text-[#8E9A84] line-through"
                                }`}
                              >
                                {enOf(s)}
                                {!s.active ? <span className="ml-1.5 text-xs font-normal no-underline text-[#B9826A]">off</span> : null}
                              </p>
                              <p className="truncate text-xs text-[#8E9A84]">
                                {s.slug} · GST {gstLabel(s, false)} · sort {s.sortOrder}
                              </p>
                            </div>
                          </div>
                          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                            {count > 0 ? (
                              <Pill tone="leaf">
                                {count} product{count === 1 ? "" : "s"}
                              </Pill>
                            ) : (
                              <span className="text-xs text-[#8E9A84]">0 products</span>
                            )}
                            <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}>
                              Edit
                            </Btn>
                            {actionsFor(s, false)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {subs.length === 0 && allSubs.length > 0 ? (
                  <p className="mt-2 text-xs text-[#8E9A84]">No subs match the search — the others exist but are filtered out.</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header({
  okMsg,
  inactiveCount,
  unmapped,
  total,
  onAdd,
  formOpen,
}: {
  okMsg: string;
  inactiveCount: number;
  unmapped: number;
  total: number;
  onAdd: () => void;
  formOpen: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={SERIF}>
          Categories
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {okMsg ? <Pill tone="leaf">✓ {okMsg}</Pill> : null}
          {inactiveCount > 0 ? <Pill tone="amber">{inactiveCount} inactive</Pill> : null}
          {unmapped > 0 ? <Pill tone="amber">{unmapped} products unmapped</Pill> : null}
          <Btn onClick={onAdd}>{formOpen ? "Close form" : "+ Add category"}</Btn>
        </div>
      </div>
      <p className="max-w-3xl text-sm text-[#66735F]">
        The two-level browse tree for the storefront ({total} categories). The insights panel below ties it to the
        attribute types and the product catalog; the shop still runs on the old 5-category layout — this tree takes
        over in phase 2c, so edit freely.
      </p>
      <p className="max-w-3xl text-xs text-[#8E9A84]">
        ⚠ Re-running <code>scripts/seed-categories.mjs</code> resets the 56 seeded categories to seed values — make
        this editor the source of truth after the last seed run.
      </p>
    </div>
  );
}

function Insights({
  cats,
  kinds,
  missingLang,
  setMissingLang,
  filledIn,
  missingIn,
  mappedTotal,
  productTotal,
  unmapped,
  distribution,
  maxDist,
  onEditMissing,
}: {
  cats: Cat[];
  kinds: KindSum[];
  missingLang: string | null;
  setMissingLang: Dispatch<SetStateAction<string | null>>;
  filledIn: (code: string) => number;
  missingIn: (code: string) => Cat[];
  mappedTotal: number;
  productTotal: number;
  unmapped: number;
  distribution: { top: Cat; n: number }[];
  maxDist: number;
  onEditMissing: (c: Cat) => void;
}) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-[#1C3A2A]" style={SERIF}>
        Insights
      </h2>
      <p className="mt-0.5 text-xs text-[#8E9A84]">
        How the catalog reads today — regional translation coverage, the attribute types, and where products sit.
      </p>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#66735F]">
          Translations by region — click a language to see what&apos;s missing
        </p>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => {
            const filled = filledIn(r.code);
            const done = filled === cats.length;
            const expanded = missingLang === r.code;
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => setMissingLang(expanded ? null : r.code)}
                title={r.label}
                className={
                  expanded
                    ? "rounded-full border border-[#2F6B3F] bg-[#2F6B3F] px-3 py-1 text-xs font-bold text-white"
                    : done
                      ? "rounded-full border border-[#A9C3A0]/60 bg-[#EDF2E6] px-3 py-1 text-xs font-semibold text-[#24562F]"
                      : "rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                }
              >
                {r.native} {filled}/{cats.length}
                {done ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        {missingLang ? (
          <div className="mt-2 rounded-xl border border-[#1C3A2A]/10 bg-[#F7F3E8] p-3">
            {missingIn(missingLang).length === 0 ? (
              <p className="text-xs text-[#24562F]">Nothing missing — this region is fully translated.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-[#66735F]">
                  {missingIn(missingLang).length} node{missingIn(missingLang).length === 1 ? "" : "s"} missing this
                  name — tap one to edit it:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingIn(missingLang).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onEditMissing(c)}
                      className="rounded-full border border-[#1C3A2A]/15 bg-white px-2.5 py-1 text-xs font-semibold text-[#20291D] transition hover:border-[#2F6B3F] hover:bg-[#EDF2E6]"
                    >
                      ✏️ {enOf(c)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#66735F]">
          Attribute types — open one in the taxonomy console
        </p>
        {kinds.length === 0 ? (
          <p className="text-xs text-[#8E9A84]">No taxonomy terms yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {kinds.map((k) => (
              <Link
                key={k.code}
                href={`/admin/taxonomy?kind=${k.code}`}
                className="rounded-full border border-[#1C3A2A]/15 bg-white px-3 py-1 text-xs font-semibold text-[#20291D] transition hover:border-[#2F6B3F] hover:bg-[#EDF2E6]"
              >
                {k.emoji} {k.label} · {k.active}/{k.total} →
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#66735F]">Product mapping</p>
        <p className="text-sm text-[#66735F]">
          <strong className="text-[#20291D]">{mappedTotal}</strong> of {productTotal} product
          {productTotal === 1 ? "" : "s"} sit in this tree
          {unmapped > 0 ? (
            <>
              {" — "}
              <span className="font-semibold text-amber-700">{unmapped} unmapped</span>
            </>
          ) : null}
        </p>
        {distribution.length === 0 ? (
          <p className="mt-1 text-xs text-[#8E9A84]">No products in the tree yet.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {distribution.map(({ top, n }) => (
              <div key={top.id} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 truncate text-right font-semibold text-[#20291D]">
                  {top.emoji ?? "🌱"} {enOf(top)}
                </span>
                <div className="h-2.5 flex-1 rounded-full bg-[#EDF2E6]">
                  <div className="h-2.5 rounded-full bg-[#2F6B3F]" style={{ width: `${Math.max(6, Math.round((n / maxDist) * 100))}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right font-bold text-[#20291D]">{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function CategoryForm({
  form,
  setForm,
  tops,
  cats,
  submitting,
  formError,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState | null>>;
  tops: Cat[];
  cats: Cat[];
  submitting: boolean;
  formError: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const editing = form.id !== null;
  const original = editing ? cats.find((c) => c.id === form.id) ?? null : null;
  const childCount = original ? cats.filter((c) => c.parentId === original.id).length : 0;
  const moveLocked = editing && childCount > 0;
  const activeTops = tops.filter((t) => t.active && t.id !== form.id);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-[#1C3A2A]" style={SERIF}>
          {editing ? `Edit — ${original ? enOf(original) : ""}` : "New category"}
        </h2>
        <Btn size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
      </div>
      <form onSubmit={onSubmit} className="mt-4 space-y-5">
        {editing && original ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#66735F]">
            <span className="font-bold uppercase tracking-wide">Identity (read-only):</span>
            <code className="rounded-full border border-[#1C3A2A]/10 bg-[#F7F3E8] px-2 py-0.5">{original.slug}</code>
            {original.legacyKey ? <Pill tone="cream">legacy: {original.legacyKey}</Pill> : null}
            <span>sort {original.sortOrder}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">
              Parent — where it sits in the tree
            </p>
            <select
              className={inputCls}
              value={form.parentId}
              disabled={moveLocked}
              onChange={(e) => setForm((p) => (p ? { ...p, parentId: e.target.value } : p))}
            >
              <option value="">Top level</option>
              {activeTops.map((t) => (
                <option key={t.id} value={t.id}>
                  {(t.emoji ? t.emoji + " " : "") + enOf(t)}
                </option>
              ))}
            </select>
            {moveLocked ? (
              <p className="mt-1 text-xs text-[#8E9A84]">
                Locked — this category has {childCount} subcategories, so it must stay top-level.
              </p>
            ) : null}
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">
              English name — required, shown everywhere
            </p>
            <input
              className={inputCls}
              value={form.en}
              onChange={(e) => setForm((p) => (p ? { ...p, en: e.target.value } : p))}
              placeholder="e.g. Fruit plants"
              maxLength={120}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">Emoji (optional)</p>
            <input
              className={inputCls}
              value={form.emoji}
              onChange={(e) => setForm((p) => (p ? { ...p, emoji: e.target.value } : p))}
              placeholder="🪴"
              maxLength={16}
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">GST rate</p>
            <select
              className={inputCls}
              value={form.gst}
              onChange={(e) => setForm((p) => (p ? { ...p, gst: e.target.value } : p))}
            >
              {GST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {!editing ? (
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">
                Slug — URL identity, locked after create
              </p>
              <input
                className={inputCls}
                value={form.slug}
                onChange={(e) => setForm((p) => (p ? { ...p, slug: e.target.value } : p))}
                placeholder="auto from the English name, e.g. fruit-plants"
                maxLength={80}
              />
            </div>
          ) : null}
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">
              Sort order — lower shows first (optional)
            </p>
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm((p) => (p ? { ...p, sortOrder: e.target.value } : p))}
              placeholder="auto — tail of the group"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#66735F]">
            Regional names (optional — blank keeps them out)
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REGIONAL_LANGS.map((l) => (
              <div key={l.code}>
                <p className="mb-1 text-xs text-[#8E9A84]">{l.label}</p>
                <input
                  className={inputCls}
                  value={form.regional[l.code] ?? ""}
                  onChange={(e) =>
                    setForm((p) => (p ? { ...p, regional: { ...p.regional, [l.code]: e.target.value } } : p))
                  }
                  placeholder="Optional"
                  maxLength={120}
                />
              </div>
            ))}
          </div>
        </div>

        {formError ? <ErrBox>{formError}</ErrBox> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Btn type="submit" disabled={submitting}>
            {editing ? "Save changes" : "+ Create category"}
          </Btn>
          <span className="text-xs text-[#8E9A84]">
            {editing
              ? "Names fully replace the current set — blank regional boxes clear those translations."
              : "Slug and parent are fixed after create (moves are possible later for childless nodes)."}
          </span>
        </div>
      </form>
    </Card>
  );
}
