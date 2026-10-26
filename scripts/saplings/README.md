# Sapling collection catalog builder (mission S1)

Tooling that produced the 80-sapling catalog shipped in
`prisma/migrations/20261026120000_sapling_collection_seed/` and the
matching photos in `public/photos/`.

## Files

- `common.py` — entry helper, poly-bag prompt vocabulary
- `part1.py` — fruit (20)
- `part2.py` — forestry & avenue (20)
- `part3.py` — flower trees (20) + vegetable seedlings (20 new; the
  2 legacy vegetable saplings are linked by the migration, so the
  vegetable sub ends at 22 listings)
- `build.py` — validates every entry and emits the data-migration SQL
  plus the image-prompt list
- `gen_images.py` — generates the 1024x1024 source renders with the
  project's image-generation CLI
- `optimize_images.py` — turns the renders into the 640x640
  progressive JPEGs actually served
- `setup_pg.py` / `start_pg_tcp.sh` — local throwaway Postgres on
  127.0.0.1:5433 (pip `pgserver` binaries) for sandbox verification

## Pipeline

1. `python3 build.py out/` — writes `out/migration.sql` (review, then
   save as `prisma/migrations/<timestamp>_sapling_collection_seed/
   migration.sql`) and `out/images.json` (slug to image prompt).
2. `python3 gen_images.py` — generates one 1024x1024 render per slug
   into `raw/` with the PC3-proven throughput settings: EXACTLY 2
   parallel workers behind a flock start-gate staggered ~12s apart,
   ~20s pause per image per worker (~2-2.7 images/minute), 30s-growth
   backoff with up to 5 retries per image (HTTP 429 included).
   Resume-safe: valid renders are skipped, so the run can be split
   into chunks (`timeout 540 python3 gen_images.py`).
3. `python3 optimize_images.py` — center-crops, resizes to 640x640
   and re-encodes as progressive JPEG (quality 80) into
   `public/photos/<slug>.jpg`.

Re-running `build.py` is safe; it only reads the part files. The
emitted SQL is idempotent (fixed `spl_*`/`splv_*` primary keys, `ON
CONFLICT DO NOTHING`, a guarded legacy UPDATE), so it can be applied
to any environment whose `green-leaf` nursery and category tree
already exist, and re-applied without duplicates.

## Sandbox database recipe

```bash
python3 scripts/saplings/setup_pg.py          # local Postgres on :5433
export DATABASE_URL=postgresql://postgres@127.0.0.1:5433/tomavine
npx prisma migrate reset --force              # schema + seed (local only!)
node scripts/seed-categories.mjs              # category tree
# the sapling migration ran during reset against an empty Category
# table (JOINs matched nothing — safe no-op), so apply it for real:
psql -h 127.0.0.1 -p 5433 -U postgres tomavine \
  -f prisma/migrations/20261026120000_sapling_collection_seed/migration.sql
# …and apply it a second time to prove idempotency (must be a no-op).
```

Note the export is needed before EVERY prisma/next command — the
sandbox shell may otherwise carry a SQLite `DATABASE_URL` and fail
with "URL must start with postgresql://". Never run `migrate reset`
against production.
