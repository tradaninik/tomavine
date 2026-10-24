#!/usr/bin/env python3
"""Tomavine app icons — original artwork, drawn programmatically.

Generates the PWA/install icon set from scratch (no third-party assets):

    public/icons/icon-192.png        regular launcher icon
    public/icons/icon-512.png        regular launcher icon (hi-res)
    public/icons/maskable-512.png    maskable icon (glyph in safe zone)
    public/icons/apple-touch-icon.png  iOS home-screen icon (180)
    src/app/favicon.ico              16/32/48 favicon (replaces default)

The mark is a stylised two-leaf sprout in cream (#F7F3E8) on the brand
forest green (#1C3A2A) — the same identity as the header wordmark.
Everything is self-drawn geometry; no license restrictions apply beyond
the repository's own terms. Recorded in public/photos/CREDITS.md.

Usage: python3 scripts/make-icons.py   (from the repo root)
"""

from PIL import Image, ImageDraw
import math
import os

# Brand palette (must match src/app/shop/ui.tsx)
FOREST = (28, 58, 42, 255)   # #1C3A2A
CREAM = (247, 243, 232, 255)  # #F7F3E8

SS = 2  # supersampling factor for smooth edges
BASE = 1024  # output canvas for large renders


def quad_bezier(p0, p1, p2, n=40):
    """Sample a quadratic bezier from p0 to p2 via control p1."""
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]
        y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


def leaf_polygon(base, tip, bulge):
    """Pointed-oval (leaf) polygon between base and tip, bulge = half-width."""
    mx, my = (base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2
    dx, dy = tip[0] - base[0], tip[1] - base[1]
    length = math.hypot(dx, dy)
    if length == 0:
        return []
    px, py = -dy / length, dx / length  # unit perpendicular
    c1 = (mx + px * bulge, my + py * bulge)
    c2 = (mx - px * bulge, my - py * bulge)
    return quad_bezier(base, c1, tip) + quad_bezier(tip, c2, base)


def capsule(draw, p0, p1, width, fill):
    """Rounded-ended line segment."""
    draw.line([p0, p1], fill=fill, width=int(width))
    r = width / 2
    for (x, y) in (p0, p1):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def draw_sprout(img, scale):
    """Draw the sprout glyph centered on the canvas.

    Glyph space is a 1000x1000 box; `scale` maps it onto the canvas.
    Geometry (in glyph units, y grows downward):
      stem from (500, 880) up to (500, 480), width 56
      left  leaf base (500, 520) -> tip (190, 210), bulge 150
      right leaf base (500, 520) -> tip (810, 210), bulge 150
    """
    draw = ImageDraw.Draw(img)
    S = img.size[0] / 1000 * scale

    def pt(x, y):
        return (img.size[0] / 2 + (x - 500) * S, img.size[1] / 2 + (y - 500) * S)

    # Stem
    capsule(draw, pt(500, 880), pt(500, 470), 56 * S, CREAM)
    # Two leaves
    for tip in ((190, 210), (810, 210)):
        poly = leaf_polygon(pt(500, 520), pt(*tip), 150 * S)
        draw.polygon(poly, fill=CREAM)
    # Small shoot between the leaves for a friendlier sprout silhouette
    capsule(draw, pt(500, 500), pt(500, 300), 40 * S, CREAM)


def render(size, glyph_scale, out_path, ico=False):
    """Full-bleed forest background + sprout glyph at the given scale."""
    if ico:
        # Favicon wants stronger strokes so the mark reads at 16px.
        big = Image.new("RGBA", (256 * SS, 256 * SS), FOREST)
        draw_sprout(big, glyph_scale * 1.18)
        base = big.resize((256, 256), Image.LANCZOS)
        base.save(out_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
        print(f"wrote {out_path} (16/32/48, glyph scale {glyph_scale})")
        return
    big = Image.new("RGBA", (size * SS, size * SS), FOREST)
    draw_sprout(big, glyph_scale)
    img = big.resize((size, size), Image.LANCZOS)
    img.save(out_path, format="PNG")
    print(f"wrote {out_path} ({size}x{size}, glyph scale {glyph_scale})")


def main():
    root = os.path.join(os.path.dirname(__file__), "..")
    icons = os.path.join(root, "public", "icons")
    os.makedirs(icons, exist_ok=True)

    render(512, 0.95, os.path.join(icons, "icon-512.png"))
    render(192, 0.95, os.path.join(icons, "icon-192.png"))
    # Maskable: glyph fully inside the 80%-diameter safe zone
    render(512, 0.72, os.path.join(icons, "maskable-512.png"))
    # Apple adds its own corner radius; keep the glyph comfortably central
    render(180, 0.88, os.path.join(icons, "apple-touch-icon.png"))
    render(0, 0.95, os.path.join(root, "src", "app", "favicon.ico"), ico=True)
    print("done")


if __name__ == "__main__":
    main()
