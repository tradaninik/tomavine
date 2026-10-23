# TOMAVINE Enhancements — Realistic Photos + Redesigned Home Page

Two enhancements, built on top of YOUR repo's architecture (multi-page Next.js + Postgres migrations + your i18n system). No new npm dependencies.

1. **Realistic photos** — 17 curated photos covering all 9 seed products + Green Leaf nursery + hero collage + category tiles. Ships as static files in `public/photos/` (no blob storage, no CDN dependency, free Vercel edge caching).
2. **Home page redesign** — hero with photo collage + floating "Physically verified ★4.6" badge, live stats band (new `/api/catalog/stats`), photo category tiles, featured nurseries with photo headers. New UI strings added to all 6 languages (en/hi/te/kn/ta/mr).

## What changed

```
prisma/schema.prisma                                   # Nursery.image field added
prisma/migrations/20261023000000_add_nursery_image/    # migration: ALTER TABLE Nursery ADD image
prisma/seed.ts                                         # images wired into all seed products + nursery
scripts/add-photos.mjs                                 # one-shot: add photos to EXISTING production data
src/app/page.tsx                                       # redesigned home page
src/app/api/catalog/nurseries/route.ts                 # returns nursery image
src/app/api/catalog/stats/route.ts                     # NEW: live counters for stats band
src/lib/i18n.tsx                                       # 5 new keys x 6 languages
public/photos/*.jpg                                    # 17 photos (~2.5 MB total)
```

## Apply — after the code lands in your working tree

Whichever way the code arrives (PowerShell apply script, git bundle, or manual copy):

```powershell
# 0) Working tree should be clean before the files land; after they land:
cd C:\tomavine
git status                        # you should see the changed + new files above

# 1) Install (no new dependencies — fast no-op)
npm install

# 2) Try it locally
npm run dev                       # open http://localhost:3000 — new hero + photos visible
```

## Go live (Vercel + Neon)

```powershell
# 3) Apply the migration to Neon + add photos to your EXISTING live data
#    (.env must contain your Neon DATABASE_URL — it already does)
npx prisma migrate deploy     # adds Nursery.image column — safe, additive only
node scripts/add-photos.mjs   # name-matched UPDATEs only — never deletes rows, idempotent

# 4) Commit (if not already committed by the apply script) + push — Vercel deploys automatically
git add -A
git commit -m "Add realistic photos + redesigned home page (hero collage, stats band, photo tiles)"
git push
```

`npm run build` on Vercel runs `prisma migrate deploy` itself, so even if you skip step 3's first command, the column gets added during deploy. `add-photos.mjs` still needs to run once from your machine to photo-up the existing rows.

## Notes

- Photos are committed to the repo (`public/photos/`) — served by Vercel's CDN, no runtime cost, no external dependency. Sellers can still upload their own via Vercel Blob (unchanged).
- `add-photos.mjs` matches by exact product `nameEn` + nursery slug. If a name doesn't match your live DB it prints it under "No row matched" — edit the map at the top of the script and re-run.
- Fresh installs: `npm run seed` already includes all photos.
- Rollback: photos and layout are UI-only; the single migration is additive (`ADD COLUMN`), so reverting the code is enough.
