-- CreateTable
CREATE TABLE "TaxonomyTerm" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "names" JSONB,
    "groupName" TEXT,
    "note" TEXT,
    "meta" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxonomyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxonomyTerm_kind_active_sort_idx" ON "TaxonomyTerm"("kind", "active", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyTerm_kind_label_key" ON "TaxonomyTerm"("kind", "label");
