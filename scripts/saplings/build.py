# Validates the sapling catalog and emits: images.json (slug -> prompt)
# and the Prisma data-migration SQL for mission S1.
#
#   python3 build.py [out-dir]     (default: ./out next to this file)
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import prompt_for  # noqa: E402
from part1 import FRUIT  # noqa: E402
from part2 import FORESTRY  # noqa: E402
from part3 import FLOWER, VEGETABLE  # noqa: E402

ALL = FRUIT + FORESTRY + FLOWER + VEGETABLE
GROUPS = {
    "fruit": FRUIT,
    "forestry": FORESTRY,
    "flower": FLOWER,
    "vegetable": VEGETABLE,
}

SUB_PARENT = {
    "fruit": "saplings",
    "forestry": "saplings",
    "flower": "saplings",
    "vegetable": "saplings",
}

# The two legacy vegetable saplings from the original seed — folded
# into the category tree by the migration (guarded UPDATEs).
LEGACY_VEGETABLE_NAMES = ["Chilli Saplings — Guntur Sannam", "Tomato Saplings — Arka Abha"]

# Photo filename collision check — a new slug must not reuse a photo
# that belongs to some other product (e.g. the pre-existing
# curry-leaf.jpg). See existing_photos() for the exact rule.
PHOTO_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "photos"))


def existing_photos():
    """Stems of photos that pre-date this mission.

    Everything currently in public/photos/ EXCEPT this catalog's own
    slugs — the catalog's 80 jpgs are expected to exist after
    generation, so they are not collisions. This keeps the check
    stable whether build.py runs before or after the images exist.
    """
    if not os.path.isdir(PHOTO_DIR):
        return set()
    mine = {e["slug"] for e in ALL}
    return {name[:-4] for name in os.listdir(PHOTO_DIR) if name.endswith(".jpg")} - mine


def validate():
    errors = []
    warnings = []
    slugs = set()
    existing = existing_photos()
    skus = set()
    for e in ALL:
        s = e["slug"]
        if s in slugs:
            errors.append(f"duplicate slug: {s}")
        slugs.add(s)
        if s in existing:
            errors.append(f"photo filename collision: {s}")
        if e["price"] < 99 or e["price"] > 899:
            errors.append(f"{s}: price {e['price']} outside 99-899")
        if e["mrp"] < e["price"]:
            errors.append(f"{s}: mrp {e['mrp']} < price {e['price']}")
        if e["stock"] < 10 or e["stock"] > 30:
            errors.append(f"{s}: stock {e['stock']} outside 10-30")
        for k in ("sun", "water", "soil", "level"):
            if not e["care"].get(k):
                errors.append(f"{s}: missing care.{k}")
        if not e["badges"] or len(e["badges"]) > 3:
            errors.append(f"{s}: badges {e['badges']}")
        for b in e["badges"]:
            if not isinstance(b, str) or not b.strip() or len(b) > 28:
                errors.append(f"{s}: odd badge {b!r}")
        if not e["botanical"]:
            errors.append(f"{s}: missing botanical")
        if not e["agri"] or not isinstance(e["agri"], dict):
            errors.append(f"{s}: missing agri guidance")
        else:
            for k, v in e["agri"].items():
                if not isinstance(v, (int, str)) or (isinstance(v, str) and not v.strip()):
                    errors.append(f"{s}: odd agri.{k} = {v!r}")
        for k in e["names"]:
            if k not in ("hi", "te", "kn", "ta", "mr"):
                errors.append(f"{s}: unexpected names key {k}")
        vs = e["variants"]
        if not vs or len(vs) > 3:
            errors.append(f"{s}: variants {vs}")
            continue
        prices = [p for _, p in vs]
        if e["price"] != min(prices):
            errors.append(f"{s}: priceMin {e['price']} != cheapest variant {min(prices)}")
        for label, price in vs:
            if not label.strip():
                errors.append(f"{s}: empty variant label")
            if price < 99 or price > 899:
                errors.append(f"{s}: variant {label!r} price {price} outside 99-899")
        if e["mrp"] < max(prices):
            warnings.append(f"{s}: mrp {e['mrp']} < top variant {max(prices)} (strike-through won't show on top size)")
        for n in range(1, len(vs) + 1):
            sku = sku_for(s, n)
            if sku in skus:
                errors.append(f"{s}: duplicate sku {sku}")
            skus.add(sku)
    for sub, group in GROUPS.items():
        if len(group) != 20:
            errors.append(f"group {sub} has {len(group)} entries (need exactly 20)")
    return errors, warnings


def sq(s):
    """Escape a Python string as a single-quoted SQL literal."""
    return "'" + s.replace("'", "''") + "'"


def jstr(obj):
    """Compact JSON as a SQL-escaped literal."""
    return sq(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def product_id(slug):
    return "spl_" + slug.replace("-", "_")


def variant_id(slug, n):
    return "splv_" + slug.replace("-", "_") + "_" + str(n)


def sku_for(slug, n):
    return "SPL-" + slug.upper().replace("-", "_") + "-" + str(n)


def build_sql():
    lines = []
    lines.append("-- Mission S1: sapling collection (data-only migration).")
    lines.append("--")
    lines.append("-- Adds 80 sapling listings under the 'saplings' top across its")
    lines.append("-- four subcategories (fruit, forestry, flower, vegetable - 20 each)")
    lines.append("-- sold by Green Leaf Nurseries, with size variants, per-acre")
    lines.append("-- guidance (agri), care cards, badges and 6-language common names")
    lines.append("-- where genuinely used. The two legacy vegetable saplings are")
    lines.append("-- folded into the category tree so /shop/c/vegetable shows 22.")
    lines.append("--")
    lines.append("-- Everything is idempotent: fixed primary keys (spl_* / splv_*),")
    lines.append("-- ON CONFLICT DO NOTHING on inserts, and a guarded UPDATE that")
    lines.append("-- only touches legacy rows still outside the tree (categoryId")
    lines.append("-- NULL). Re-running on a partially applied database is safe.")
    lines.append("-- Nursery and category ids are resolved BY SLUG at runtime, so")
    lines.append("-- no production cuids are hard-coded; if the 'green-leaf'")
    lines.append("-- nursery is absent the INSERT simply matches no rows.")
    lines.append("")
    lines.append("-- 1) Fold the two legacy vegetable saplings into the tree (guarded:")
    lines.append("--    only rows with no categoryId yet, so admin edits always win).")
    name_list = ", ".join(sq(n) for n in LEGACY_VEGETABLE_NAMES)
    lines.append("UPDATE \"Product\" SET \"categoryId\" = (SELECT id FROM \"Category\" WHERE slug = 'vegetable'), \"subCategory\" = 'vegetable'")
    lines.append(f"WHERE \"nameEn\" IN ({name_list}) AND category = 'saplings' AND \"categoryId\" IS NULL;")
    lines.append("")
    lines.append("-- 2) The 80 new listings. id is deterministic (spl_<slug>) so the")
    lines.append("--    whole statement is re-runnable; categoryId resolves via the")
    lines.append("--    subcategory slug (checked under the 'saplings' top) so no")
    lines.append("--    production cuids are hard-coded.")
    lines.append("INSERT INTO \"Product\" (id, \"nurseryId\", category, \"categoryId\", \"nameEn\", names, botanical, badges, care, agri, provenance, \"priceMin\", mrp, stock, hidden, \"subCategory\", image)")
    lines.append("SELECT v.id, n.id, 'saplings', c.id, v.\"nameEn\", v.names::jsonb, v.botanical, v.badges::jsonb, v.care::jsonb, v.agri::jsonb, '{\"grownAt\":\"Hesaraghatta shade houses\"}'::jsonb, v.\"priceMin\", v.mrp, v.stock, false, v.\"subCategory\", '/photos/' || v.slug || '.jpg'")
    lines.append("FROM (VALUES")
    rows = []
    for e in ALL:
        rows.append(
            "  (" + ", ".join([
                sq(product_id(e["slug"])),
                sq(e["slug"]),
                sq(e["nameEn"]),
                jstr(e["names"]) if e["names"] else "NULL",
                sq(e["botanical"]),
                jstr(e["badges"]),
                jstr(e["care"]),
                jstr(e["agri"]),
                str(e["price"]),
                str(e["mrp"]),
                str(e["stock"]),
                sq(e["sub"]),
            ]) + ")"
        )
    lines.append(",\n".join(rows))
    lines.append(") AS v(id, slug, \"nameEn\", names, botanical, badges, care, agri, \"priceMin\", mrp, stock, \"subCategory\")")
    lines.append("JOIN \"Nursery\" n ON n.slug = 'green-leaf'")
    lines.append("JOIN \"Category\" c ON c.slug = v.\"subCategory\" AND c.\"parentId\" IS NOT NULL")
    lines.append("ON CONFLICT (id) DO NOTHING;")
    lines.append("")
    lines.append("-- 3) Size variants (at least one per product; priceMin = cheapest).")
    lines.append("--    Same idempotency: fixed splv_<slug>_<n> ids.")
    lines.append("INSERT INTO \"ProductVariant\" (id, \"productId\", label, price, sku)")
    lines.append("SELECT v.id, p.id, v.label, v.price, v.sku")
    lines.append("FROM (VALUES")
    vrows = []
    for e in ALL:
        for n, (label, price) in enumerate(e["variants"], start=1):
            vrows.append(
                "  (" + ", ".join([
                    sq(variant_id(e["slug"], n)),
                    sq(product_id(e["slug"])),
                    sq(label),
                    str(price),
                    sq(sku_for(e["slug"], n)),
                ]) + ")"
            )
    lines.append(",\n".join(vrows))
    lines.append(") AS v(id, pid, label, price, sku)")
    lines.append("JOIN \"Product\" p ON p.id = v.pid")
    lines.append("ON CONFLICT (id) DO NOTHING;")
    lines.append("")
    return "\n".join(lines)


def main():
    errors, warnings = validate()
    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print(" -", e)
        sys.exit(1)

    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "out"
    )
    os.makedirs(out_dir, exist_ok=True)

    prompts = {e["slug"]: prompt_for(e) for e in ALL}
    with open(os.path.join(out_dir, "images.json"), "w", encoding="utf-8") as f:
        json.dump(prompts, f, ensure_ascii=False, indent=1)

    sql = build_sql()
    sql_path = os.path.join(out_dir, "migration.sql")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(sql)

    print("VALID")
    for sub, group in GROUPS.items():
        lo = min(e["price"] for e in group)
        hi = max(e["price"] for e in group)
        nv = sum(len(e["variants"]) for e in group)
        print(f"  {sub:<11} {len(group)} saplings, {lo}-{hi} INR, {nv} variants")
    print(f"  TOTAL       {len(ALL)} saplings, {sum(len(e['variants']) for e in ALL)} variants")
    n_names = sum(1 for e in ALL if e["names"])
    print(f"  multi-language names on {n_names} entries")
    n_agri = sum(1 for e in ALL if e["agri"])
    print(f"  per-acre guidance on {n_agri} entries")
    if warnings:
        print("WARNINGS:")
        for w in warnings:
            print(" -", w)
    print(f"wrote {sql_path} ({len(sql)} bytes) and images.json ({len(ALL)} prompts)")


if __name__ == "__main__":
    main()
