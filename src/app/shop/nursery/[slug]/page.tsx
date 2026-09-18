"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Btn, Card, Empty, ErrBox, Loading, Pill, ProductTile, StarRow } from "../../ui";
import { useLang } from "@/lib/i18n";
import type { ProductCard } from "@/lib/catalog";

type NurseryInfo = {
  id: string;
  name: string;
  slug: string;
  city: string;
  area: string | null;
  pincode: string;
  scope: string;
  scopeKm: number | null;
  ratingAvg: number;
  retailOk: boolean;
  bulkOk: boolean;
  physVerifiedAt: string | null;
};

export default function NurseryPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { t } = useLang();
  const [nursery, setNursery] = useState<NurseryInfo | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setError(false);
    fetch(`/api/catalog/nursery/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.ok ? res.json() : Promise.reject(new Error("failed"));
      })
      .then((data) => {
        if (active && data && data.nursery) {
          setNursery(data.nursery);
          setProducts(Array.isArray(data.products) ? data.products : []);
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
  }, [slug, reload]);

  if (loading) {
    return <Loading />;
  }

  if (notFound) {
    return (
      <Empty
        emoji="🏡"
        title="Nursery not found"
        text="It may not be verified yet or the link is wrong."
        action={<Btn href="/shop/nurseries">{t("nurseries")}</Btn>}
      />
    );
  }

  if (error || !nursery) {
    return (
      <ErrBox>
        <p className="mb-2">{t("load_error")}</p>
        <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
          {t("retry")}
        </Btn>
      </ErrBox>
    );
  }

  return (
    <div>
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#EDF2E6] text-4xl" aria-hidden="true">
              🏡
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-[#20291D]" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
                {nursery.name}
              </h1>
              <p className="mt-1 text-sm text-[#66735F]">
                {nursery.city}
                {nursery.area ? ` · ${nursery.area}` : ""} · {t("pincode")} {nursery.pincode}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#66735F]">
                <StarRow value={nursery.ratingAvg} />
                <span className="font-bold text-[#20291D]">{nursery.ratingAvg.toFixed(1)}</span>
                {nursery.physVerifiedAt ? <Pill tone="leaf">🛡️ {t("verified")}</Pill> : null}
                {nursery.scope === "RADIUS" && nursery.scopeKm ? <Pill tone="sky">~{nursery.scopeKm} km</Pill> : null}
              </div>
            </div>
          </div>
          <Btn href="/shop/nurseries" variant="outline" size="sm">
            ← {t("nurseries")}
          </Btn>
        </div>
      </Card>

      {products.length === 0 ? (
        <Empty emoji="🌱" title={t("empty_cat")} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductTile key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}