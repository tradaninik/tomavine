# Shared builder for the Tomavine sapling catalog mission (S1).
# Each entry is validated by build.py before anything is emitted.


def S(slug, name, bot, sub, price, mrp, stock, look, sun, water, soil, level, badges, agri, variants, **names):
    """Create one catalog entry.

    `variants` is a list of (label, price) tuples — at least one per
    product; `price` must equal the cheapest variant (Product.priceMin).
    `agri` is the per-acre guidance dict rendered on sapling detail
    pages (string/number values only). `names` kwargs are i18n common
    names (hi/te/kn/ta/mr) — only pass the ones actually used for that
    plant in everyday Indian usage.
    """
    entry = {
        "slug": slug,
        "nameEn": name,
        "botanical": bot,
        "sub": sub,
        "price": price,
        "mrp": mrp,
        "stock": stock,
        "look": look,
        "care": {"sun": sun, "water": water, "soil": soil, "level": level},
        "badges": badges,
        "agri": agri,
        "variants": variants,
        "names": {k: v for k, v in names.items() if v},
    }
    return entry


# Container style per subcategory — saplings ship in nursery poly-bags
# (vegetables as young plug-tray transplants), which keeps the whole
# catalog visually consistent and clearly distinct from the potted
# plants of mission PC3.
BAG_STYLE = {
    "fruit": "a black nursery poly-bag packed with dark brown soil and a slim bamboo stake",
    "forestry": "a tall black nursery poly-bag packed with firm dark soil",
    "flower": "a black nursery poly-bag with dark soil and a small wooden plant label",
    "vegetable": "a small black nursery cell-pack tray with soil",
}

STYLE_BASE = (
    "professional e-commerce product photograph of a healthy, nursery-fresh "
    "{look}, growing in {bag}, soft natural greenhouse light, clean pale "
    "background, plant centered and filling most of the frame, square "
    "composition, realistic photography, high quality, detailed"
)


def prompt_for(entry):
    return STYLE_BASE.format(look=entry["look"], bag=BAG_STYLE[entry["sub"]])
