/*
  Warnings:

  - A unique constraint covering the columns `[symbol,exchange]` on the table `Market` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[synonym,exchange]` on the table `Market` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[symbol,synonym,exchange]` on the table `Market` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Market_symbol_exchange_key" ON "Market"("symbol", "exchange");

-- CreateIndex
CREATE UNIQUE INDEX "Market_synonym_exchange_key" ON "Market"("synonym", "exchange");

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbol_synonym_exchange_key" ON "Market"("symbol", "synonym", "exchange");
