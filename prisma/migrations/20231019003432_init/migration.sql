-- DropIndex
DROP INDEX "Market_symbol_exchange_key";

-- DropIndex
DROP INDEX "Market_synonym_exchange_key";

-- CreateIndex
CREATE INDEX "Market_symbol_exchange_idx" ON "Market"("symbol", "exchange");

-- CreateIndex
CREATE INDEX "Market_synonym_exchange_idx" ON "Market"("synonym", "exchange");
