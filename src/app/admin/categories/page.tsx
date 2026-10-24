"use client";

import { useEffect, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Btn, Card, Empty, ErrBox, Loading, Pill, inputCls } from "../ui";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

// Mission X — the category-tree editor. The two-level tree (phase
// 2a seed: 11 tops + 45 subs) is what the storefront browse flips
// to in phase 2c; until then the storefront runs on the legacy
// 5-category strings, so every edit here is safe to make live.

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

const REGIONAL_LANGS: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ta", label: "Tamil" },
  { code: "mr", label: "Marathi" },
];

const GST_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Inherit (subs) / platform default (tops)" },
  { value: "0", label: "0% — exempt" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
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

function GstBadge({ c, isTop }: { c: Cat; isTop: boolean }) {
  if (c.gstRate === null) {
    return <Pill tone="cream">{isTop ? "GST default" : "GST ↑ inherit"}</Pill>;
  }
  return <Pill tone="sky">GST {c.gstRate}%</Pill>;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actError, setActError] = useState("");
  const [okMsg, setOkMsg] = useState("");

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
  const treeCountOf = (top: Cat) =>
    (counts[top.id] ?? 0) + subsOf(top.id).reduce((sum, s) => sum + (counts[s.id] ?? 0), 0);
  const inactiveCount = cats.filter((c) => !c.active).length;

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
  }

  async function toggleActive(c: Cat) {
    if (c.active) {
      const childCount = subsOf(c.id).filter((s) => s.active).length;
      const extra = childCount > 0 ? ` Its ${childCount} active subcategories hide along with it.` : "";
      const sure = window.confirm(
        `Deactivate “${enOf(c)}”? It disappears from the new storefront browse (phase 2c) and seller pickers until reactivated.${extra}`
      );
      if (!sure) {
        return;
      }
    }
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
      setOkMsg(`${enOf(c)} is now ${c.active ? "inactive" : "active"}.`);
    } catch (e) {
      setActError(e instanceof Error ? errText(e.message, enOf(c)) : "Action failed");
    } finally {
      setBusyId(null);
    }
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

  const visibleTops = tops.filter((t) => matches(t) || subsOf(t.id).some(matches));

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

      <div className="sm:max-w-md">
        <input
          className={inputCls}
          placeholder="Search name, slug, legacy key or translation…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

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
            const topMatch = matches(t);
            const subs = subsOf(t.id).filter((s) => topMatch || matches(s));
            return (
              <Card key={t.id} className={t.active ? "" : "opacity-75"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xl" aria-hidden="true">
                        {t.emoji ?? "🌱"}
                      </span>
                      <p className="text-xl font-semibold text-[#20291D]" style={SERIF}>
                        {enOf(t)}
                      </p>
                      <code className="rounded-full border border-[#1C3A2A]/10 bg-[#F7F3E8] px-2 py-0.5 text-xs text-[#66735F]">
                        {t.slug}
                      </code>
                      {t.legacyKey ? <Pill tone="cream">legacy: {t.legacyKey}</Pill> : null}
                      <GstBadge c={t} isTop />
                      {t.active ? <Pill tone="leaf">Active</Pill> : <Pill tone="rose">Inactive</Pill>}
                      <Pill tone="cream">
                        {treeCountOf(t)} product{treeCountOf(t) === 1 ? "" : "s"}
                      </Pill>
                    </div>
                    <NamesLine names={t.names} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Btn size="sm" variant="outline" onClick={() => openEdit(t)}>
                      Edit
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => openCreate(t.id)}>
                      + Sub
                    </Btn>
                    <Btn
                      size="sm"
                      variant={t.active ? "outline" : "primary"}
                      disabled={busyId === t.id}
                      onClick={() => toggleActive(t)}
                    >
                      {t.active ? "Deactivate" : "Reactivate"}
                    </Btn>
                  </div>
                </div>

                {subs.length > 0 ? (
                  <div className="mt-4 grid gap-3 border-t border-[#E4E0CE] pt-4 sm:grid-cols-2 xl:grid-cols-3">
                    {subs.map((s) => {
                      const count = counts[s.id] ?? 0;
                      return (
                        <div
                          key={s.id}
                          className={
                            s.active
                              ? "rounded-2xl border border-[#1C3A2A]/10 bg-[#F7F3E8] p-3.5"
                              : "rounded-2xl border border-dashed border-[#1C3A2A]/25 bg-white p-3.5 opacity-75"
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#20291D]">{enOf(s)}</p>
                              <p className="mt-0.5 truncate text-xs text-[#8E9A84]">{s.slug}</p>
                            </div>
                            {s.active ? null : <Pill tone="rose">off</Pill>}
                          </div>
                          <NamesLine names={s.names} />
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <GstBadge c={s} isTop={false} />
                            <Pill tone="cream">
                              {count} product{count === 1 ? "" : "s"}
                            </Pill>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-[#E4E0CE] pt-2.5">
                            <span className="text-xs text-[#8E9A84]">sort {s.sortOrder}</span>
                            <div className="flex items-center gap-1.5">
                              <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}>
                                Edit
                              </Btn>
                              <Btn
                                size="sm"
                                variant="ghost"
                                disabled={busyId === s.id}
                                onClick={() => toggleActive(s)}
                              >
                                {s.active ? "Deactivate" : "Reactivate"}
                              </Btn>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 border-t border-[#E4E0CE] pt-3 text-xs text-[#8E9A84]">
                    No subcategories{query.trim() ? " matching the search" : ""} — “+ Sub” adds one.
                  </p>
                )}
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
        The two-level browse tree for the storefront ({total} categories). The shop still runs on the
        old 5-category layout — this tree takes over in phase 2c, so edit freely.
      </p>
      <p className="max-w-3xl text-xs text-[#8E9A84]">
        ⚠ Re-running <code>scripts/seed-categories.mjs</code> resets the 56 seeded categories to seed
        values — make this editor the source of truth after the last seed run.
      </p>
    </div>
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
