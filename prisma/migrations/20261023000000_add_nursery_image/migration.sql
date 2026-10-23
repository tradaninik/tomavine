-- Adds a display photo to nurseries (featured cards on the home page,
-- nursery page header). Nullable — nurseries without a photo fall back
-- to the emoji avatar exactly as before.
ALTER TABLE "Nursery" ADD COLUMN "image" TEXT;
