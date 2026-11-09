"use client";

import { useEffect, useState } from "react";
import { Btn, Empty, ErrBox, Loading, ProductTile, SectionTitle, inr } from "../ui";
import { displayName, useLang } from "@/lib/i18n";
import type { CategoryTree } from "@/lib/category-tree";
import type { ProductCard } from "@/lib/catalog";

// /shop/search - T1C rewrite (spec docs/t1b-search-spec.md section 6).
// The URL querystring is the single source of truth: every state
// change rewrites it with history.replaceState (shareable +
// refresh-safe, no navigation, no scroll jump, no history spam).
// The filter panel reuses the /shop/c idioms wholesale - chipCls
// chips, the module-level tree cache, displayName() - and adds no
// new shared components (spec 6.6).

function chipCls(active: boolean): string {
  return active
    ? "whitespace-nowrap rounded-full bg-[#2F6B3F] px-3 py-1 text-xs font-semibold text-white"
    : "whitespace-nowrap rounded-full border border-[#1C3A2A]/20 px-3 py-1 text-xs font-semibold text-[#1C3A2A]/70 hover:bg-[#F7F3E8]";
}

function enOf(names: Record<string, string> | null, fallback: string): string {
  return names && typeof names.en === "string" && names.en.length > 0 ? names.en : fallback;
}

// Module-level cache: the active tree is fetched once per client
// session and reused across navigations (same pattern as
// /shop/c/[slug]).
let treeCache: CategoryTree | null = null;

function fetchTree(): Promise<CategoryTree | null> {
  if (treeCache) {
    return Promise.resolve(treeCache);
  }
  return fetch("/api/catalog/categories")
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
    .then((data) => {
      const tree = data && Array.isArray(data.categories) ? (data.categories as CategoryTree) : null;
      if (tree) {
        treeCache = tree;
      }
      return tree;
    });
}

type SearchState = {
  q: string;
  cat: string | null;
  nursery: string | null;
  min: number | null;
  max: number | null;
  stock: boolean;
  page: number;
  size: number;
};

// Price bands (spec 6.3d): the boundaries live in ONE constant so
// they can be tuned without touching i18n. Labels are parameterized;
// values are formatted with inr() at render time - the dictionary
// stays currency-free. The band itself is NEVER serialized: the URL
// always carries min/max.
const PRICE_BANDS: { min: number | null; max: number | null }[] = [
  { min: null, max: 99 },
  { min: 100, max: 499 },
  { min: 500, max: 1999 },
  { min: 2000, max: null },
];

const SIZES = [12, 24, 48];

function parseNum(v: string | null): number | null {
  if (v === null || !/^\d+$/.test(v)) {
    return null;
  }
  return Number.parseInt(v, 10);
}

function bandIndex(s: SearchState): number {
  return PRICE_BANDS.findIndex((b) => b.min === s.min && b.max === s.max);
}

// Read the full state from the querystring (spec 6.1). Whitespace-
// only q counts as absent; malformed values fall back to their
// defaults - the same leniency the API applies.
function readState(): SearchState {
  const sp = new URLSearchParams(window.location.search);
  const page = parseNum(sp.get("page"));
  const size = parseNum(sp.get("size"));
  return {
    q: (sp.get("q") ?? "").trim(),
    cat: sp.get("cat"),
    nursery: sp.get("nursery"),
    min: parseNum(sp.get("min")),
    max: parseNum(sp.get("max")),
    stock: sp.get("stock") === "1",
    page: page !== null && page >= 1 ? page : 1,
    size: size !== null && SIZES.includes(size) ? size : 24,
  };
}

// Canonical querystring (spec 6.1): order q, cat, nursery, min, max,
// stock, page, size; default-valued params are OMITTED so shared
// URLs stay clean.
function stateToPath(s: SearchState): string {
  const sp = new URLSearchParams();
  if (s.q.length > 0) {
    sp.set("q", s.q);
  }
  if (s.cat !== null) {
    sp.set("cat", s.cat);
  }
  if (s.nursery !== null) {
    sp.set("nursery", s.nursery);
  }
  if (s.min !== null) {
    sp.set("min", String(s.min));
  }
  if (s.max !== null) {
    sp.set("max", String(s.max));
  }
  if (s.stock) {
    sp.set("stock", "1");
  }
  if (s.page > 1) {
    sp.set("page", String(s.page));
  }
  if (s.size !== 24) {
    sp.set("size", String(s.size));
  }
  const qs = sp.toString();
  return qs.length > 0 ? `/shop/search?${qs}` : "/shop/search";
}

function apiUrl(s: SearchState): string {
  const sp = new URLSearchParams();
  if (s.q.length > 0) {
    sp.set("q", s.q);
  }
  if (s.cat !== null) {
    sp.set("cat", s.cat);
  }
  if (s.nursery !== null) {
    sp.set("nursery", s.nursery);
  }
  if (s.min !== null) {
    sp.set("min", String(s.min));
  }
  if (s.max !== null) {
    sp.set("max", String(s.max));
  }
  if (s.stock) {
    sp.set("stock", "1");
  }
  // The page always passes size explicitly (spec 6.1); the API
  // default of 100 exists for the legacy callers.
  sp.set("page", String(s.page));
  sp.set("size", String(s.size));
  return `/api/catalog/products?${sp.toString()}`;
}

// Pager window (spec 6.4): first, last, current +- 1, ellipsis for
// the gaps - at most ~7 buttons.
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const show = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const out: (number | null)[] = [];
  let prev = 0;
  for (let p = 1; p <= pageCount; p++) {
    if (show.has(p)) {
      if (p - prev > 1) {
        out.push(null);
      }
      out.push(p);
      prev = p;
    }
  }
  return out;
}

export default function SearchPage() {
  const { lang, t } = useLang();
  const [state, setState] = useState<SearchState | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [tree, setTree] = useState<CategoryTree | null>(null);
  const [nurseries, setNurseries] = useState<{ slug: string; name: string }[] | null>(null);
  // Text inputs carry their own state; the search box and the custom
  // price From/To fields commit on a 400 ms debounce (spec 6.2),
  // every chip acts instantly.
  const [qText, setQText] = useState("");
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  // Mount once: read the URL, prefill the inputs, fetch the filter
  // sources. A failed tree or nurseries call just hides that filter
  // row - the page still searches (spec 6.5).
  useEffect(() => {
    const s = readState();
    setState(s);
    setQText(s.q);
    setMinText(s.min !== null ? String(s.min) : "");
    setMaxText(s.max !== null ? String(s.max) : "");
    setCustomOpen((s.min !== null || s.max !== null) && bandIndex(s) === -1);
    fetchTree()
      .then((fetched) => {
        if (fetched) {
          setTree(fetched);
        }
      })
      .catch(() => undefined);
    fetch("/api/catalog/nurseries")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (data && Array.isArray(data.nurseries)) {
          // Only retail nurseries can appear in product listings, so
          // only they are offered as a filter (spec 6.3c).
          const list: { slug: string; name: string; retailOk: boolean }[] = data.nurseries;
          setNurseries(list.filter((n) => n.retailOk === true).map((n) => ({ slug: n.slug, name: n.name })));
        }
      })
      .catch(() => undefined);
  }, []);

  // Hybrid navigation (spec 6.2): replace, never push.
  useEffect(() => {
    if (state === null) {
      return;
    }
    window.history.replaceState(null, "", stateToPath(state));
  }, [state]);

  // The data fetch. Out-of-range page (hand-edited URL): clamp to
  // the last page - page 1 when total is 0 - and re-fetch once
  // (spec 6.5).
  useEffect(() => {
    if (state === null) {
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    fetch(apiUrl(state))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!active) {
          return;
        }
        const metaTotal = typeof data.total === "number" ? data.total : 0;
        const metaPageCount = typeof data.pageCount === "number" ? data.pageCount : 0;
        const clampTo = metaPageCount > 0 ? metaPageCount : 1;
        if (state.page > clampTo) {
          setState((prev) => (prev !== null && prev.page === state.page ? { ...prev, page: clampTo } : prev));
          return;
        }
        setTotal(metaTotal);
        setPageCount(metaPageCount);
        setProducts(Array.isArray(data.products) ? (data.products as ProductCard[]) : []);
      })
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
  }, [state, reload]);

  // 400 ms debounce: the search input (spec 6.2). An unchanged
  // value keeps the same state object - no re-render, no re-fetch.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setState((prev) => {
        if (prev === null) {
          return prev;
        }
        const next = qText.trim();
        return next === prev.q ? prev : { ...prev, q: next, page: 1 };
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [qText]);

  // 400 ms debounce: the custom price inputs. Malformed text never
  // commits; a programmatic reset (band pick, clear filters) syncs
  // the texts to the new state, so the parse equals the state and
  // the debounce resolves to a no-op.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setState((prev) => {
        if (prev === null) {
          return prev;
        }
        const min = parseNum(minText);
        const max = parseNum(maxText);
        return min === prev.min && max === prev.max ? prev : { ...prev, min: min, max: max, page: 1 };
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [minText, maxText]);

  // Any filter change resets page to 1 (spec 6.2).
  function update(patch: Partial<SearchState>): void {
    setState((prev) => {
      if (prev === null) {
        return prev;
      }
      return { ...prev, ...patch, page: 1 };
    });
  }

  function setPage(p: number): void {
    setState((prev) => (prev !== null && prev.page !== p ? { ...prev, page: p } : prev));
  }

  function pickBand(i: number): void {
    // Picking a band clears the custom inputs (spec 6.3d): the texts
    // are synced to the band so the pending debounce (if any)
    // resolves to a no-op instead of committing the old values.
    const band = PRICE_BANDS[i];
    setMinText(band.min !== null ? String(band.min) : "");
    setMaxText(band.max !== null ? String(band.max) : "");
    setCustomOpen(false);
    update({ min: band.min, max: band.max });
  }

  function clearFilters(): void {
    // Zero-results action (spec 6.5): reset every filter, KEEP q.
    setMinText("");
    setMaxText("");
    setCustomOpen(false);
    update({ cat: null, nursery: null, min: null, max: null, stock: false });
  }

  const s = state;
  const ready = s !== null && !loading && !error;
  const anyFilter =
    s !== null && (s.cat !== null || s.nursery !== null || s.min !== null || s.max !== null || s.stock);
  // Row 2 of the category chips: the top owning the selected cat (a
  // top matches itself, a sub matches its parent - spec 6.3b).
  const catSlug = s !== null ? s.cat : null;
  const selectedTop =
    tree !== null && catSlug !== null
      ? tree.find((top) => top.slug === catSlug || top.subs.some((sub) => sub.slug === catSlug)) ?? null
      : null;
  const customActive = s !== null && bandIndex(s) === -1 && (s.min !== null || s.max !== null);

  return (
    <div>
      <SectionTitle
        action={
          ready ? (
            <span
              aria-label={total === 1 ? t("t1b_result_one") : t("t1b_results_n", { n: total })}
              className="rounded-full bg-[#EDF2E6] px-3 py-1 text-xs font-bold text-[#2F6B3F]"
            >
              {total}
            </span>
          ) : null
        }
      >
        {"\uD83D\uDD0D"} {s !== null && s.q.length > 0 ? t("results_for", { q: s.q }) : t("t1b_all_products")}
      </SectionTitle>

      {s !== null ? (
        <div className="mb-6 flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#66735F]">{t("t1b_filters")}</p>

          {/* a) Search input (spec 6.3a) - debounced, prefilled from ?q=. */}
          <form
            className="flex items-center gap-2 rounded-2xl border border-[#D6D2BC] bg-white p-2 pl-4"
            onSubmit={(e) => {
              e.preventDefault();
              // Enter commits immediately instead of waiting out
              // the debounce.
              setState((prev) => {
                if (prev === null) {
                  return prev;
                }
                const next = qText.trim();
                return next === prev.q && prev.page === 1 ? prev : { ...prev, q: next, page: 1 };
              });
            }}
          >
            <span aria-hidden="true" className="text-[#8E9A84]">
              {"\uD83D\uDD0D"}
            </span>
            <input
              id="t1b-q"
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder={t("search_ph")}
              aria-label={t("search_ph")}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
            />
          </form>

          {/* b) Category - two-level chips, single branch (spec 6.3b). */}
          {tree !== null && tree.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[#66735F]">{t("t1b_category")}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chipCls(s.cat === null)} onClick={() => update({ cat: null })}>
                  {t("sub_all")}
                </button>
                {tree.map((top) => (
                  <button
                    key={top.slug}
                    type="button"
                    className={chipCls(s.cat === top.slug)}
                    onClick={() => update({ cat: s.cat === top.slug ? null : top.slug })}
                  >
                    {(top.emoji ?? "") + " " + displayName(top.names, lang, enOf(top.names, top.slug))}
                  </button>
                ))}
              </div>
              {selectedTop !== null && selectedTop.subs.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTop.subs.map((sub) => (
                    <button
                      key={sub.slug}
                      type="button"
                      className={chipCls(s.cat === sub.slug)}
                      onClick={() => update({ cat: s.cat === sub.slug ? selectedTop.slug : sub.slug })}
                    >
                      {displayName(sub.names, lang, enOf(sub.names, sub.slug))}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* c) Nursery - single-select chips (spec 6.3c). */}
          {nurseries !== null && nurseries.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-[#66735F]">{t("t1b_nursery")}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={chipCls(s.nursery === null)} onClick={() => update({ nursery: null })}>
                  {t("sub_all")}
                </button>
                {nurseries.map((n) => (
                  <button
                    key={n.slug}
                    type="button"
                    className={chipCls(s.nursery === n.slug)}
                    onClick={() => update({ nursery: s.nursery === n.slug ? null : n.slug })}
                  >
                    {n.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* d) Price - band chips plus custom min/max (spec 6.3d). */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#66735F]">{t("t1b_price")}</p>
            <div className="flex flex-wrap gap-2">
              {PRICE_BANDS.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  className={chipCls(s.min === b.min && s.max === b.max)}
                  onClick={() => pickBand(i)}
                >
                  {b.min === null
                    ? t("t1b_band_under", { max: inr(b.max ?? 0) })
                    : b.max === null
                      ? t("t1b_band_above", { min: inr(b.min) })
                      : t("t1b_band_range", { min: inr(b.min), max: inr(b.max) })}
                </button>
              ))}
              <button type="button" className={chipCls(customActive)} onClick={() => setCustomOpen(true)}>
                {t("t1b_custom")}
              </button>
            </div>
            {customOpen ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label htmlFor="t1b-price-min" className="text-xs font-semibold text-[#66735F]">
                  {t("t1b_price_from")}
                </label>
                <input
                  id="t1b-price-min"
                  inputMode="numeric"
                  value={minText}
                  onChange={(e) => setMinText(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-24 rounded-xl border border-[#D6D2BC] bg-white px-2 py-1 text-sm outline-none"
                />
                <label htmlFor="t1b-price-max" className="text-xs font-semibold text-[#66735F]">
                  {t("t1b_price_to")}
                </label>
                <input
                  id="t1b-price-max"
                  inputMode="numeric"
                  value={maxText}
                  onChange={(e) => setMaxText(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-24 rounded-xl border border-[#D6D2BC] bg-white px-2 py-1 text-sm outline-none"
                />
              </div>
            ) : null}
          </div>

          {/* e) In stock - a single toggle chip (spec 6.3e). */}
          <div>
            <button
              type="button"
              aria-pressed={s.stock}
              className={chipCls(s.stock)}
              onClick={() => update({ stock: !s.stock })}
            >
              {t("in_stock")}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <ErrBox>
            <p className="mb-2">{t("load_error")}</p>
            <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
              {t("retry")}
            </Btn>
          </ErrBox>
        </div>
      ) : null}

      {loading ? <Loading /> : null}

      {!loading && !error && products.length === 0 ? (
        anyFilter ? (
          <Empty
            emoji={"\uD83D\uDD0D"}
            title={t("t1b_no_match_filters")}
            action={
              <Btn size="sm" onClick={clearFilters}>
                {t("t1b_clear_filters")}
              </Btn>
            }
          />
        ) : (
          <Empty
            emoji={"\uD83D\uDD0D"}
            title={t("no_results")}
            action={
              <Btn href="/" variant="outline">
                {t("browse")}
              </Btn>
            }
          />
        )
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductTile key={p.id} p={p} />
        ))}
      </div>

      {/* Pager + size selector (spec 6.4), hidden when everything
          fits on one page or there is nothing to page. */}
      {ready && pageCount > 1 && s !== null ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-label={t("t1b_page_prev")}
              disabled={s.page <= 1}
              onClick={() => setPage(s.page - 1)}
              className={chipCls(false) + " disabled:opacity-40"}
            >
              &lsaquo;
            </button>
            {pageWindow(s.page, pageCount).map((p, i) =>
              p === null ? (
                <span key={"gap" + i} className="px-1 text-xs font-semibold text-[#66735F]">
                  &hellip;
                </span>
              ) : (
                <button key={p} type="button" className={chipCls(p === s.page)} onClick={() => setPage(p)}>
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label={t("t1b_page_next")}
              disabled={s.page >= pageCount}
              onClick={() => setPage(s.page + 1)}
              className={chipCls(false) + " disabled:opacity-40"}
            >
              &rsaquo;
            </button>
            <span className="ml-2 text-xs font-semibold text-[#66735F] sm:hidden">
              {t("t1b_page_of", { p: s.page, P: pageCount })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#66735F]">{t("t1b_per_page")}</span>
            {SIZES.map((z) => (
              <button key={z} type="button" className={chipCls(s.size === z)} onClick={() => update({ size: z })}>
                {z}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
