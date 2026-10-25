"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Btn, Empty, ErrBox, Loading, ProductTile, SectionTitle } from "../../ui";
import { displayName, useLang } from "@/lib/i18n";
import { resolveSlug, type CategoryTree, type ResolvedCategory } from "@/lib/category-tree";
import type { ProductCard } from "@/lib/catalog";

// /shop/c/[slug] — browse by Category-tree slug (Mission 2c).
// The client fetches the whole ACTIVE tree once from
// /api/catalog/categories and resolves the slug locally (top vs
// sub, siblings); products come from /api/catalog/products?cat=
// <slug>, which filters by categoryId subtree server-side with the
// same visibility rules as every other listing. Replaces the
// legacy client-filtered /shop/category/<key> page (which now 308s
// here). Strings reuse existing dictionary keys: sub_all ("All"),
// empty_cat, load_error, retry.

function chipCls(active: boolean): string {
  return active
    ? "whitespace-nowrap rounded-full bg-[#2F6B3F] px-3 py-1 text-xs font-semibold text-white"
    : "whitespace-nowrap rounded-full border border-[#1C3A2A]/20 px-3 py-1 text-xs font-semibold text-[#1C3A2A]/70 hover:bg-[#F7F3E8]";
}

function enOf(names: Record<string, string> | null, fallback: string): string {
  return (names && typeof names.en === "string" && names.en.length > 0 ? names.en : fallback);
}

// Module-level cache: the active tree is fetched once per client
// session and reused across category navigations (same pattern as
// the toast sequence in shop/ui.tsx).
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

export default function CategoryBrowsePage() {
  const params = useParams<{ slug: string }>();
  const raw = typeof params.slug === "string" ? params.slug : "";
  const { lang, t } = useLang();
  const [tree, setTree] = useState<CategoryTree | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    const treeReady = fetchTree();

    const productsReady = fetch(`/api/catalog/products?cat=${encodeURIComponent(raw)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => (data && Array.isArray(data.products) ? (data.products as ProductCard[]) : []));

    Promise.all([treeReady, productsReady])
      .then(([fetchedTree, fetchedProducts]) => {
        if (!active) {
          return;
        }
        if (fetchedTree) {
          setTree(fetchedTree);
        }
        setProducts(fetchedProducts);
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
  }, [raw, reload]);

  const resolved: ResolvedCategory | null = tree ? resolveSlug(tree, raw) : null;
  const unknown = tree !== null && resolved === null;
  const node = resolved ? (resolved.kind === "sub" ? resolved.sub : resolved.top) : null;
  const top = resolved ? resolved.top : null;
  const name = node ? displayName(node.names, lang, enOf(node.names, node.slug)) : raw;
  const count = !loading && !error ? products.length : null;

  if (unknown) {
    return (
      <Empty
        emoji="🤔"
        title="Unknown category"
        text="That category does not exist on Tomavine."
        action={<Btn href="/">← Tomavine</Btn>}
      />
    );
  }

  return (
    <div>
      <SectionTitle
        action={
          count !== null ? (
            <span className="rounded-full bg-[#EDF2E6] px-3 py-1 text-xs font-bold text-[#2F6B3F]">{count}</span>
          ) : null
        }
      >
        {(node?.emoji ?? "🌱") + " " + name}
      </SectionTitle>

      {/* Blurb + tray note kept for the 5 legacy tops (new tops have no curated copy yet). */}
      {resolved?.kind === "top" && resolved.top.legacyKey ? (
        <p className="mb-4 max-w-2xl text-sm text-[#66735F]">{t("cat_copy_" + resolved.top.legacyKey)}</p>
      ) : null}
      {top?.slug === "saplings" ? (
        <p className="mb-4 rounded-2xl bg-[#EDF2E6] px-4 py-2.5 text-xs font-semibold text-[#24562F]">{t("tray_note")}</p>
      ) : null}

      {/* Top page: chips link to this top's active subs. Sub page: "All" back to the top + sibling subs. */}
      {top && top.subs.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {resolved?.kind === "sub" ? (
            <Link href={`/shop/c/${top.slug}`} className={chipCls(false)}>
              {t("sub_all")}
            </Link>
          ) : null}
          {top.subs.map((s) => (
            <Link
              key={s.slug}
              href={`/shop/c/${s.slug}`}
              className={chipCls(resolved?.kind === "sub" && resolved.sub.slug === s.slug)}
            >
              {displayName(s.names, lang, enOf(s.names, s.slug))}
            </Link>
          ))}
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
        <Empty emoji={node?.emoji ?? "🌱"} title={t("empty_cat")} />
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {!loading && !error
          ? products.map((p) => <ProductTile key={p.id} p={p} />)
          : null}
      </div>
    </div>
  );
}
