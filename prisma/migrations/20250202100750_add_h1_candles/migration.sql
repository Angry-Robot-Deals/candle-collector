-- CreateTable
CREATE TABLE "CandleH1" (
    "id" BIGSERIAL NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "tf" INTEGER NOT NULL DEFAULT 1440,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "trades" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CandleH1_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandleH1_symbolId_exchangeId_tf_idx" ON "CandleH1"("symbolId", "exchangeId", "tf");

-- CreateIndex
CREATE INDEX "CandleH1_symbolId_exchangeId_idx" ON "CandleH1"("symbolId", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "CandleH1_symbolId_exchangeId_tf_time_key" ON "CandleH1"("symbolId", "exchangeId", "tf", "time");

-- AddForeignKey
ALTER TABLE "CandleH1" ADD CONSTRAINT "CandleH1_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandleH1" ADD CONSTRAINT "CandleH1_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
