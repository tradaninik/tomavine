# Shared builder for the Tomavine indoor plant catalog mission.
# Each plant entry is validated by build.py before anything is emitted.


def P(slug, name, bot, sub, price, mrp, stock, look, sun, water, soil, level, badges, **names):
    """Create one catalog entry. `names` kwargs are i18n common names
    (hi/kn/te/ta/mr) — only pass the ones that are actually used for
    that plant in everyday Indian usage."""
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
        "names": {k: v for k, v in names.items() if v},
    }
    return entry


# Image style suffix per subcategory — keeps the whole catalog visually
# consistent while giving each group its own pot language.
POT_STYLE = {
    "indoor": "a matte cream ceramic pot",
    "flowering": "a glazed terracotta pot with a matching saucer",
    "succulents": "a shallow raw terracotta bowl with a gritty pebble top dressing",
    "herbs": "a rustic unglazed terracotta pot",
    "medicinal": "a simple terracotta pot with a small wooden plant label",
    "aromatic": "a glazed sage-green ceramic pot",
}

STYLE_BASE = (
    "professional e-commerce product photograph of a healthy, nursery-fresh "
    "{look}, planted in {pot}, soft natural greenhouse light, clean pale "
    "background, plant centered and filling most of the frame, square "
    "composition, realistic photography, high quality, detailed"
)


def prompt_for(entry):
    return STYLE_BASE.format(look=entry["look"], pot=POT_STYLE[entry["sub"]])
