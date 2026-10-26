"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Btn, Card, CareChips, Empty, Loading, Pill, ProductThumb, SectionTitle, inr, toast } from "../ui";
import { displayName, useLang } from "@/lib/i18n";
import type { ProductCard } from "@/lib/catalog";
import { FREE_DELIVERY_AT, computeTotals, displayPriceOf, loadCart, missingLines, removeLine, setQty } from "@/lib/cart";
import type { CartLine } from "@/lib/cart";
import { bulkTierFor, nextBulkTier } from "@/lib/bulk-tiers";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-[#66735F]">
      <span>{label}</span>
      <span className="font-semibold text-[#20291D]">{value}</span>
    </div>
  );
}

export default function CartPage() {
  const { lang, t } = useLang();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  // Mission S3: live admin settings so tier chips + totals always
  // match the owner's current configuration.
  const [tiers, setTiers] = useState<{ minQty: number; pct: number }[] | null>(null);
  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.tiers)) {
          setTiers(data.tiers);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const current = loadCart();
    setLines(current);
    if (current.length === 0) {
      setLoading(false);
      return;
    }
    const ids = current.map((l) => l.productId).join(",");
    fetch(`/api/catalog/products?ids=${encodeURIComponent(ids)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (data && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const missing = missingLines(lines, products);
  const totals = computeTotals(lines, products, "DELIVERY", "cod", tiers === null ? undefined : { tiers: tiers });

  function changeQty(productId: string, variantId: string | null, qty: number) {
    setLines(setQty(productId, variantId, qty));
  }

  function drop(productId: string, variantId: string | null) {
    setLines(removeLine(productId, variantId));
    toast(t("removed"));
  }

  if (loading) {
    return <Loading />;
  }

  if (lines.length === 0) {
    return (
      <Empty
        emoji="🛒"
        title={t("cart_empty")}
        text={t("cart_empty_s")}
        action={<Btn href="/shop/c/plants">{t("browse")}</Btn>}
      />
    );
  }

  return (
    <div>
      <SectionTitle>🛒 {t("cart_title")}</SectionTitle>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {totals.groups.map((g) => (
            <Card key={g.nurseryId}>
              <div className="flex items-center gap-3 border-b border-[#E4E0CE] pb-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EDF2E6] text-xl" aria-hidden="true">
                  🏡
                </span>
                <div>
                  <Link href={`/shop/nursery/${g.nurserySlug}`} className="font-semibold text-[#20291D] hover:underline" style={SERIF}>
                    {g.nurseryName}
                  </Link>
                  <p className="text-xs text-[#66735F]">{g.nurseryCity}</p>
                </div>
              </div>
              <div className="divide-y divide-[#E4E0CE]">
                {g.lines.map((l) => {
                  const name = displayName(l.product.names, lang, l.product.nameEn);
                  const low = l.qty > l.product.stock;
                  const priceBefore = displayPriceOf(l.product, l.variantId).before;
                  // Mission S2 (scope A1): per-line tier hint — the next
                  // tier the qty has not reached yet ("Buy 10+, save 5%"),
                  // or the applied badge once the top tier is reached.
                  const appliedTier = bulkTierFor(l.qty, tiers ?? undefined);
                  const upcomingTier = nextBulkTier(l.qty, tiers ?? undefined);
                  const tierChip =
                    upcomingTier !== null
                      ? `🏷️ ${t("tier_hint", { n: upcomingTier.minQty, p: upcomingTier.pct })}`
                      : appliedTier !== null
                        ? `🏷️ ${t("tier_applied", { p: appliedTier.pct })}`
                        : null;
                  return (
                    <div key={l.product.id + (l.variantId ?? "")} className="flex gap-3 py-4">
                      <ProductThumb category={l.product.category} image={l.product.image} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/shop/product/${l.product.id}`} className="line-clamp-2 text-sm font-semibold text-[#20291D] hover:underline">
                          {name}
                        </Link>
                        {l.variant ? <p className="text-xs text-[#66735F]">{l.variant.label}</p> : null}
                        <CareChips care={l.product.care} category={l.product.category} className="mt-1.5" />
                        {tierChip !== null && !low ? (
                          <p className="mt-1 text-xs font-semibold text-[#24562F]">{tierChip}</p>
                        ) : null}
                        {low ? (
                          <div className="mt-1">
                            <Pill tone="rose">{t("only_left", { n: l.product.stock })}</Pill>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex items-center rounded-xl border border-[#D6D2BC] bg-white">
                            <button
                              type="button"
                              onClick={() => changeQty(l.product.id, l.variantId, l.qty - 1)}
                              className="h-8 w-8 text-sm font-bold text-[#1C3A2A]"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-[#1C3A2A]">{l.qty}</span>
                            <button
                              type="button"
                              onClick={() => changeQty(l.product.id, l.variantId, l.qty + 1)}
                              className="h-8 w-8 text-sm font-bold text-[#1C3A2A]"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => drop(l.product.id, l.variantId)}
                            className="text-xs font-semibold text-rose-600 hover:underline"
                          >
                            ✕ {t("remove")}
                          </button>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-[#1C3A2A]">{inr(l.lineSub)}</p>
                        {l.lineDiscount > 0 ? (
                          <p className="text-xs font-semibold text-[#24562F]">−{inr(l.lineDiscount)}</p>
                        ) : null}
                        <p className="text-xs text-[#8E9A84]">
                          {priceBefore > l.unit ? (
                            <span className="line-through">{inr(priceBefore)}</span>
                          ) : null}{" "}
                          {inr(l.unit)} × {l.qty}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E0CE] pt-3 text-xs text-[#66735F]">
                <span>
                  {g.sub >= FREE_DELIVERY_AT
                    ? `🎉 ${t("free_delivery")}`
                    : `🚚 ${t("add_more", { p: inr(FREE_DELIVERY_AT - g.sub) })}`}
                </span>
                <span>
                  {t("subtotal")}: <b className="text-[#20291D]">{inr(g.sub)}</b>
                  {g.discount > 0 ? (
                    <>
                      {" "}
                      <span className="font-semibold text-[#24562F]">
                        ({t("bulk_discount")} −{inr(g.discount)})
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            </Card>
          ))}

          {missing.map((l) => (
            <Card key={l.productId} className="border-rose-200 bg-rose-50/50">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-rose-700">🚫 {t("unavailable_item")}</p>
                <button type="button" onClick={() => drop(l.productId, l.variantId)} className="text-xs font-semibold text-rose-600 hover:underline">
                  ✕ {t("remove")}
                </button>
              </div>
            </Card>
          ))}
        </div>

        <div>
          <Card className="lg:sticky lg:top-28">
            <h2 className="text-lg font-semibold text-[#20291D]" style={SERIF}>
              {t("order_summary")}
            </h2>
            {totals.orderCount > 1 ? (
              <p className="mb-3 mt-3 rounded-xl bg-[#EDF2E6] p-3 text-xs font-semibold text-[#24562F]">
                📦 {t("per_nursery", { n: totals.orderCount })}
              </p>
            ) : null}
            <div className="mt-3 space-y-1.5">
              <SumRow label={t("subtotal")} value={inr(totals.sub)} />
              {totals.discount > 0 ? (
                <SumRow label={t("bulk_discount")} value={`−${inr(totals.discount)}`} />
              ) : null}
              <SumRow label={t("gst")} value={inr(totals.tax)} />
              <SumRow label={t("delivery")} value={inr(totals.delivery)} />
              <SumRow label={t("cod_fee")} value={inr(totals.cod)} />
            </div>
            <div className="mt-3 flex justify-between border-t border-dashed border-[#D6D2BC] pt-3 text-lg font-bold text-[#1C3A2A]">
              <span>{t("total")}</span>
              <span>{inr(totals.total)}</span>
            </div>
            <Btn href="/shop/checkout" disabled={missing.length > 0} size="lg" className="mt-4 w-full">
              {t("checkout")} →
            </Btn>
            <Btn href="/shop/c/plants" variant="ghost" size="sm" className="mt-2 w-full">
              {t("continue_shopping")}
            </Btn>
          </Card>
        </div>
      </div>
    </div>
  );
}