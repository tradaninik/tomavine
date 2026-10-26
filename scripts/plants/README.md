# Plant collection catalog builder (mission PC3)

Tooling that produced the 120-plant indoor catalog shipped in
`prisma/migrations/20261026000000_plant_collection_seed/` and the
matching photos in `public/photos/`.

## Files

- `common.py` — entry helper, pot-style prompt vocabulary
- `part1.py` — indoor (20) + flowering (20)
- `part2.py` — succulents & cacti (20) + culinary herbs (20)
- `part3.py` — medicinal (20) + aromatic (20)
- `build.py` — validates every entry and emits the data-migration SQL
  plus the image-prompt list
- `optimize_images.py` — turns 1024x1024 source renders into the
  640x640 progressive JPEGs actually served

## Pipeline

1. `python3 build.py out/` — writes `out/migration.sql` (review, then
   save as `prisma/migrations/<timestamp>_plant_collection_seed/
   migration.sql`) and `out/images.json` (slug to image prompt).
2. Generate one 1024x1024 image per slug from `images.json` with an
   image-generation tool (the originals were made with the project's
   AI image generator, October 2026 — see
   `public/photos/CREDITS.md` for the licensing rationale).
3. `python3 optimize_images.py <raw-png-dir>` — center-crops, resizes
   to 640x640 and re-encodes as progressive JPEG (quality 80) into
   `public/photos/<slug>.jpg`.

Re-running `build.py` is safe; it only reads the part files. The
emitted SQL is idempotent (fixed `plt_<slug>` primary keys, `ON
CONFLICT DO NOTHING`, guarded legacy UPDATEs), so it can be applied
to any environment whose `green-leaf` nursery and category tree
already exist, and re-applied without duplicates.
