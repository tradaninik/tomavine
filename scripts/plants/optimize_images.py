# Optimize generated 1024x1024 PNGs into web-ready JPEGs for
# public/photos/ (640x640, progressive, quality 80).
#
#   python3 optimize_images.py [raw-png-dir]
#
# Runs incrementally: only processes slugs whose target JPG is missing
# or older than the source PNG. Default raw dir: ./raw next to this
# file; output always goes to ../../public/photos (repo-relative).
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "raw")
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public", "photos"))
TARGET = 640
QUALITY = 80

os.makedirs(OUT, exist_ok=True)

done = skipped = failed = 0
for name in sorted(os.listdir(RAW)):
    if not name.endswith(".png"):
        continue
    slug = name[:-4]
    src = os.path.join(RAW, name)
    dst = os.path.join(OUT, slug + ".jpg")
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        skipped += 1
        continue
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            # center-crop to square (they are generated square, but be safe)
            w, h = im.size
            if w != h:
                s = min(w, h)
                im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
            if im.size[0] > TARGET:
                im = im.resize((TARGET, TARGET), Image.LANCZOS)
            im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        done += 1
    except Exception as e:  # noqa: BLE001
        print(f"FAIL {slug}: {e}", file=sys.stderr)
        failed += 1

print(f"optimized: {done}, skipped(up-to-date): {skipped}, failed: {failed}")
