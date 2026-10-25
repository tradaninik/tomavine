#!/usr/bin/env python3
"""Generate Android launcher icons for the Capacitor shell (mission M2).

Reuses the M1 PWA icons as sources:
  public/icons/icon-512.png     -> legacy launcher + round (all densities)
  public/icons/maskable-512.png -> adaptive-icon foreground (safe zone included)

Outputs into android/app/src/main/res:
  mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png            48/72/96/144/192
  mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_round.png      same sizes, circular crop
  mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_foreground.png 108/162/216/324/432

The generated PNGs are committed, so regenerating is optional (requires
Python 3 + Pillow: `python -m pip install Pillow`). Run AFTER
`npx cap add android` — it refuses otherwise.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent  # repo root
SRC = ROOT / "public" / "icons"
RES = ROOT / "android" / "app" / "src" / "main" / "res"

LAUNCHER = {  # density -> ic_launcher px
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
FOREGROUND = {  # density -> adaptive foreground px (108dp grid)
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}


def die(msg: str) -> None:
    print(f"make-android-icons: {msg}", flush=True)
    raise SystemExit(2)


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")


def circular(img: Image.Image) -> Image.Image:
    """Circular crop for legacy ic_launcher_round (alpha outside the circle)."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    size = img.size
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size[0] - 1, size[1] - 1), fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main() -> None:
    if not (RES / "values").exists():
        die("android platform missing - run `npx cap add android` first")

    src_launcher = SRC / "icon-512.png"
    src_maskable = SRC / "maskable-512.png"
    for p in (src_launcher, src_maskable):
        if not p.exists():
            die(f"missing source icon: {p.relative_to(ROOT)}")

    base = Image.open(src_launcher).convert("RGBA")
    fg = Image.open(src_maskable).convert("RGBA")

    print("Generating Android launcher icons ...")
    for density, px in LAUNCHER.items():
        d = RES / f"mipmap-{density}"
        save(base.resize((px, px), Image.LANCZOS), d / "ic_launcher.png")
        save(circular(base.resize((px, px), Image.LANCZOS)), d / "ic_launcher_round.png")
    for density, px in FOREGROUND.items():
        save(
            fg.resize((px, px), Image.LANCZOS),
            RES / f"mipmap-{density}" / "ic_launcher_foreground.png",
        )
    print("Done. Adaptive (anydpi-v26) launchers pick the foreground up automatically.")


if __name__ == "__main__":
    main()
