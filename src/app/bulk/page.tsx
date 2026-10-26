"use client";

import { useEffect, useState } from "react";
import { Loading, SectionTitle } from "@/app/shop/ui";
import { useLang } from "@/lib/i18n";
import { BulkRfqForm } from "@/components/bulk-rfq-form";
import type { PublicSettings } from "@/lib/settings-shared";

type PickProduct = { id: string; nameEn: string; names: Record<string, string> | null };

export default function BulkPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<PickProduct[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/catalog/products")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    fetch("/api/settings/public")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && Array.isArray(data.tiers)) {
          setSettings(data);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <SectionTitle>{t("s3_bulk_title")}</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-[#66735F]">{t("s3_bulk_intro")}</p>
      {loading ? <Loading /> : <BulkRfqForm products={products} settings={settings} />}
    </div>
  );
}