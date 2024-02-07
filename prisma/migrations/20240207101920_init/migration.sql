/*
  Warnings:

  - You are about to drop the column `timeframe` on the `Candle` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[symbolId,exchangeId,tf,time]` on the table `Candle` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Candle_symbolId_exchangeId_timeframe_idx";

-- DropIndex
DROP INDEX "Candle_symbolId_exchangeId_timeframe_time_key";

-- AlterTable
ALTER TABLE "Candle" DROP COLUMN "timeframe",
ADD COLUMN     "tf" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ExportCandle" (
    "id" SERIAL NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "tf" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "till" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportCandle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportCandle_symbolId_exchangeId_tf_idx" ON "ExportCandle"("symbolId", "exchangeId", "tf");

-- CreateIndex
CREATE INDEX "ExportCandle_symbolId_exchangeId_idx" ON "ExportCandle"("symbolId", "exchangeId");

-- CreateIndex
CREATE INDEX "ExportCandle_time_idx" ON "ExportCandle"("time");

-- CreateIndex
CREATE UNIQUE INDEX "ExportCandle_symbolId_exchangeId_tf_time_key" ON "ExportCandle"("symbolId", "exchangeId", "tf", "time");

-- CreateIndex
CREATE INDEX "Candle_symbolId_exchangeId_tf_idx" ON "Candle"("symbolId", "exchangeId", "tf");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_symbolId_exchangeId_tf_time_key" ON "Candle"("symbolId", "exchangeId", "tf", "time");

-- AddForeignKey
ALTER TABLE "ExportCandle" ADD CONSTRAINT "ExportCandle_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportCandle" ADD CONSTRAINT "ExportCandle_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
