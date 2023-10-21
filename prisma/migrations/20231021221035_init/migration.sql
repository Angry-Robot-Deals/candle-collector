-- CreateTable
CREATE TABLE "CandleD1" (
    "id" SERIAL NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "timeframe" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "trades" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CandleD1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandleD1_symbolId_exchangeId_timeframe_idx" ON "CandleD1"("symbolId", "exchangeId", "timeframe");

-- CreateIndex
CREATE INDEX "CandleD1_symbolId_exchangeId_idx" ON "CandleD1"("symbolId", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "CandleD1_symbolId_exchangeId_timeframe_time_key" ON "CandleD1"("symbolId", "exchangeId", "timeframe", "time");

-- AddForeignKey
ALTER TABLE "CandleD1" ADD CONSTRAINT "CandleD1_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandleD1" ADD CONSTRAINT "CandleD1_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
