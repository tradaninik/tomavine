"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Btn, Empty, ErrBox, Loading, ProductTile, SectionTitle, catEmoji } from "../../ui";
import { useLang } from "@/lib/i18n";
import { subOptionsFor } from "@/lib/subcategories";
import type { ProductCard } from "@/lib/catalog";

const VALID = ["plants", "saplings", "inputs", "pots", "tools"];

function chipCls(active: boolean): string {
  return active
    ? "whitespace-nowrap rounded-full bg-[#2F6B3F] px-3 py-1 text-xs font-semibold text-white"
    : "whitespace-nowrap rounded-full border border-[#1C3A2A]/20 px-3 py-1 text-xs font-semibold text-[#1C3A2A]/70 hover:bg-[#F7F3E8]";
}

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const raw = typeof params.category === "string" ? params.category : "";
  const { t } = useLang();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [sub, setSub] = useState("");
  const valid = VALID.includes(raw);
  const subs = valid ? subOptionsFor(raw) : [];

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

  // Changing category resets the subcategory filter.
  useEffect(() => {
    setSub("");
  }, [raw]);

  const shown = sub === "" ? products : products.filter((p) => p.subCategory === sub);
  const showChips = !loading && !error && subs.length > 0 && products.some((p) => p.subCategory);

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
              {shown.length}
            </span>
          ) : null
        }
      >
        {catEmoji(raw)} {t(raw)}
      </SectionTitle>

      <p className="mb-4 max-w-2xl text-sm text-[#66735F]">{t("cat_copy_" + raw)}</p>

      {raw === "saplings" ? (
        <p className="mb-4 rounded-2xl bg-[#EDF2E6] px-4 py-2.5 text-xs font-semibold text-[#24562F]">{t("tray_note")}</p>
      ) : null}

      {showChips ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <button type="button" className={chipCls(sub === "")} onClick={() => setSub("")}>
            {t("sub_all")}
          </button>
          {subs.map((s) => (
            <button key={s.v} type="button" className={chipCls(sub === s.v)} onClick={() => setSub(s.v)}>
              {t("sub_" + s.v)}
            </button>
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

      {!loading && !error && shown.length === 0 ? (
        <Empty emoji={catEmoji(raw)} title={t("empty_cat")} />
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <ProductTile key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}