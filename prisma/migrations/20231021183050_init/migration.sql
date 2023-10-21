/*
  Warnings:

  - A unique constraint covering the columns `[symbolId,exchangeId]` on the table `Market` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Market_symbolId_exchangeId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbolId_exchangeId_key" ON "Market"("symbolId", "exchangeId");
