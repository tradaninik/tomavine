-- Mission S6-A: bulk order rails.
--   Product.moq      -> minimum order quantity for bulk listings
--                       (NULL = no minimum; retail rows unaffected).
--   Order.trackToken -> public tracking token for the /order/<token>
--                       buyer page, mirroring Quote.token. Nullable +
--                       unique: retail orders keep NULL.
ALTER TABLE "Product" ADD COLUMN "moq" INTEGER;

ALTER TABLE "Order" ADD COLUMN "trackToken" TEXT;

CREATE UNIQUE INDEX "Order_trackToken_key" ON "Order"("trackToken");