"use client";

import { useEffect, useState } from "react";
import { Btn, Empty, ErrBox, Loading, ProductTile, SectionTitle } from "../ui";
import { useLang } from "@/lib/i18n";
import type { ProductCard } from "@/lib/catalog";

export default function SearchPage() {
  const { t } = useLang();
  const [q, setQ] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const value = (new URLSearchParams(window.location.search).get("q") ?? "").trim();
    setQ(value);
    let active = true;
    setLoading(true);
    setError(false);
    fetch(`/api/catalog/products?q=${encodeURIComponent(value)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (active && data && Array.isArray(data.products)) {
          setProducts(data.products);
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

  return (
    <div>
      <SectionTitle>🔍 {q === null ? "" : t("results_for", { q: q })}</SectionTitle>

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
        <Empty emoji="🔍" title={t("no_results")} action={<Btn href="/" variant="outline">{t("browse")}</Btn>} />
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductTile key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}