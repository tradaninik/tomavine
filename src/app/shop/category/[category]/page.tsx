"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Btn, Empty, ErrBox, Loading, ProductTile, SectionTitle, catEmoji } from "../../ui";
import { useLang } from "@/lib/i18n";
import type { ProductCard } from "@/lib/catalog";

const VALID = ["plants", "saplings", "inputs", "pots", "tools"];

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const raw = typeof params.category === "string" ? params.category : "";
  const { t } = useLang();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const valid = VALID.includes(raw);

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    fetch(`/api/catalog/products?category=${encodeURIComponent(raw)}`)
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
  }, [raw, valid, reload]);

  if (!valid) {
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
          !loading && !error ? (
            <span className="rounded-full bg-[#EDF2E6] px-3 py-1 text-xs font-bold text-[#2F6B3F]">
              {products.length}
            </span>
          ) : null
        }
      >
        {catEmoji(raw)} {t(raw)}
      </SectionTitle>

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
        <Empty emoji={catEmoji(raw)} title={t("empty_cat")} />
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductTile key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}