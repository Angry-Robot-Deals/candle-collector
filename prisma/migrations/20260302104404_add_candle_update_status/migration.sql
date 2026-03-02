-- CreateTable
CREATE TABLE "CandleUpdateStatus" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "tf" INTEGER NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "candleFirstTime" INTEGER,
    "candleLastTime" INTEGER,
    "status" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CandleUpdateStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandleUpdateStatus_exchangeId_tf_status_idx" ON "CandleUpdateStatus"("exchangeId", "tf", "status");

-- CreateIndex
CREATE INDEX "CandleUpdateStatus_symbolId_exchangeId_tf_idx" ON "CandleUpdateStatus"("symbolId", "exchangeId", "tf");

-- CreateIndex
CREATE UNIQUE INDEX "CandleUpdateStatus_marketId_tf_key" ON "CandleUpdateStatus"("marketId", "tf");

-- AddForeignKey
ALTER TABLE "CandleUpdateStatus" ADD CONSTRAINT "CandleUpdateStatus_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandleUpdateStatus" ADD CONSTRAINT "CandleUpdateStatus_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandleUpdateStatus" ADD CONSTRAINT "CandleUpdateStatus_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
