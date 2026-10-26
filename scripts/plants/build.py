# Validates the catalog and emits: images.json (slug -> prompt) and the
# Prisma data-migration SQL for the plant collection mission.
#
#   python3 build.py [out-dir]     (default: ./out next to this file)
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import prompt_for  # noqa: E402
from part1 import INDOOR, FLOWERING  # noqa: E402
from part2 import SUCCULENTS, HERBS  # noqa: E402
from part3 import MEDICINAL, AROMATIC  # noqa: E402

ALL = INDOOR + FLOWERING + SUCCULENTS + HERBS + MEDICINAL + AROMATIC
GROUPS = {
    "indoor": INDOOR,
    "flowering": FLOWERING,
    "succulents": SUCCULENTS,
    "herbs": HERBS,
    "medicinal": MEDICINAL,
    "aromatic": AROMATIC,
}

# Photos that already existed in public/photos/ — new slugs must not collide.
EXISTING_PHOTOS = {
    "areca-palm", "cat-inputs", "cat-plants", "cat-pots", "cat-saplings",
    "cat-tools", "chilli-saplings", "curry-leaf", "hero-farm", "hero-terrace",
    "jade-plant", "jasmine", "jeevamrutam", "lemongrass",
    "nursery-green-leaf", "terracotta-pot", "tomato-saplings", "tool-set",
    "vermicompost",
}


def validate():
    errors = []
    slugs = set()
    for e in ALL:
        s = e["slug"]
        if s in slugs:
            errors.append(f"duplicate slug: {s}")
        slugs.add(s)
        if s in EXISTING_PHOTOS:
            errors.append(f"photo filename collision: {s}")
        if e["price"] >= e["mrp"]:
            errors.append(f"{s}: price {e['price']} >= mrp {e['mrp']}")
        if e["price"] < 50:
            errors.append(f"{s}: price too low {e['price']}")
        if e["stock"] < 1 or e["stock"] > 60:
            errors.append(f"{s}: odd stock {e['stock']}")
        for k in ("sun", "water", "soil", "level"):
            if not e["care"].get(k):
                errors.append(f"{s}: missing care.{k}")
        if not e["badges"] or len(e["badges"]) > 3:
            errors.append(f"{s}: badges {e['badges']}")
        if not e["botanical"]:
            errors.append(f"{s}: missing botanical")
    for sub, group in GROUPS.items():
        if len(group) < 20:
            errors.append(f"group {sub} has only {len(group)} entries (<20)")
    return errors


def sq(s):
    """Escape a Python string as a single-quoted SQL literal."""
    return "'" + s.replace("'", "''") + "'"


def jstr(obj):
    """Compact JSON as a SQL-escaped literal."""
    return sq(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def product_id(slug):
    return "plt_" + slug.replace("-", "_")


MEDICINAL_NAMES = {
    "en": "Medicinal plants",
    "hi": "औषधीय पौधे",
    "kn": "ಔಷಧೀಯ ಗಿಡಗಳು",
    "mr": "औषधी वनस्पती",
    "ta": "மருத்துவ செடிகள்",
    "te": "ఔషధీయ మొక్కలు",
}

HERBS_NAMES = {
    "en": "Culinary herbs",
    "hi": "रसोई जड़ी-बूटियाँ",
    "kn": "ಅಡುಗೆ ಮೂಲಿಕೆಗಳು",
    "mr": "स्वयंपाक औषधी",
    "ta": "சமையல் மூலிகைகள்",
    "te": "వంట మూలికలు",
}


def build_sql():
    lines = []
    lines.append("-- Mission PC3: rich indoor plant collection (data-only migration).")
    lines.append("--")
    lines.append("-- Adds 120 potted-plant listings under the 'plants' top across")
    lines.append("-- six subcategories (indoor, flowering, succulents, herbs,")
    lines.append("-- medicinal, aromatic), a new 'medicinal' subcategory with")
    lines.append("-- 6-language names, renames 'herbs' to \"Culinary herbs\" now that")
    lines.append("-- a dedicated 'medicinal' sub exists, and links the five")
    lines.append("-- pre-existing plant products into the category tree.")
    lines.append("--")
    lines.append("-- Everything is idempotent: fixed primary keys, ON CONFLICT DO")
    lines.append("-- NOTHING on inserts, and guarded UPDATEs that only touch rows")
    lines.append("-- still in their pre-tree state (categoryId NULL). Re-running on")
    lines.append("-- a partially applied database is safe. All rows belong to the")
    lines.append("-- verified nursery slug 'green-leaf' (Bengaluru); if that nursery")
    lines.append("-- is absent the product INSERT simply matches no rows.")
    lines.append("")
    lines.append("-- 1) 'herbs' sub now means culinary herbs only.")
    lines.append(f"UPDATE \"Category\" SET names = {jstr(HERBS_NAMES)}::jsonb WHERE slug = 'herbs';")
    lines.append("")
    lines.append("-- 2) New 'medicinal' sub under the 'plants' top (sortOrder 45 sits")
    lines.append("--    between herbs 40 and aromatic 50). gstRate NULL inherits the")
    lines.append("--    top's 5 percent.")
    lines.append("INSERT INTO \"Category\" (id, slug, \"parentId\", names, emoji, \"gstRate\", \"legacyKey\", \"sortOrder\", active, \"createdAt\")")
    lines.append(f"SELECT 'plt_cat_medicinal', 'medicinal', p.id, {jstr(MEDICINAL_NAMES)}::jsonb, NULL, NULL, NULL, 45, true, now()")
    lines.append("FROM \"Category\" p")
    lines.append("WHERE p.slug = 'plants' AND p.\"parentId\" IS NULL")
    lines.append("ON CONFLICT (slug) DO NOTHING;")
    lines.append("")
    lines.append("-- 3) Fold the five legacy plant products into the tree (guarded:")
    lines.append("--    only rows with no categoryId yet, so admin edits always win).")
    legacy = [
        ("succulents", ["Jade Plant"]),
        ("herbs", ["Curry Leaf Plant"]),
        ("aromatic", ["Lemongrass", "Jasmine"]),
    ]
    for sub, names in legacy:
        name_list = ", ".join(sq(n) for n in names)
        lines.append(f"UPDATE \"Product\" SET \"categoryId\" = (SELECT id FROM \"Category\" WHERE slug = {sq(sub)}), \"subCategory\" = {sq(sub)}")
        lines.append(f"WHERE \"nameEn\" IN ({name_list}) AND category = 'plants' AND \"categoryId\" IS NULL;")
        lines.append("")
    lines.append("-- 4) The 120 new listings. id is deterministic (plt_<slug>) so the")
    lines.append("--    whole statement is re-runnable; categoryId resolves via the")
    lines.append("--    subcategory slug so no production cuids are hard-coded.")
    lines.append("INSERT INTO \"Product\" (id, \"nurseryId\", category, \"categoryId\", \"nameEn\", names, botanical, badges, care, provenance, \"priceMin\", mrp, stock, hidden, \"subCategory\", image)")
    lines.append("SELECT v.id, n.id, 'plants', c.id, v.\"nameEn\", v.names::jsonb, v.botanical, v.badges::jsonb, v.care::jsonb, '{\"grownAt\":\"Hesaraghatta shade houses\"}'::jsonb, v.\"priceMin\", v.mrp, v.stock, false, v.\"subCategory\", '/photos/' || v.slug || '.jpg'")
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
                str(e["price"]),
                str(e["mrp"]),
                str(e["stock"]),
                sq(e["sub"]),
            ]) + ")"
        )
    lines.append(",\n".join(rows))
    lines.append(") AS v(id, slug, \"nameEn\", names, botanical, badges, care, \"priceMin\", mrp, stock, \"subCategory\")")
    lines.append("JOIN \"Nursery\" n ON n.slug = 'green-leaf'")
    lines.append("JOIN \"Category\" c ON c.slug = v.\"subCategory\" AND c.\"parentId\" IS NOT NULL")
    lines.append("ON CONFLICT (id) DO NOTHING;")
    lines.append("")
    return "\n".join(lines)


def main():
    errors = validate()
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
        print(f"  {sub:<11} {len(group)} plants, {lo}-{hi}")
    print(f"  TOTAL       {len(ALL)} plants")
    n_hi = sum(1 for e in ALL if e["names"])
    print(f"  multi-language names on {n_hi} entries")
    print(f"wrote {sql_path} ({len(sql)} bytes) and images.json ({len(ALL)} prompts)")


if __name__ == "__main__":
    main()
