-- CreateTable
CREATE TABLE "CandleM15" (
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

    CONSTRAINT "CandleM15_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandleM15_symbolId_exchangeId_tf_idx" ON "CandleM15"("symbolId", "exchangeId", "tf");

-- CreateIndex
CREATE INDEX "CandleM15_symbolId_exchangeId_idx" ON "CandleM15"("symbolId", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "CandleM15_symbolId_exchangeId_tf_time_key" ON "CandleM15"("symbolId", "exchangeId", "tf", "time");

-- AddForeignKey
ALTER TABLE "CandleM15" ADD CONSTRAINT "CandleM15_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandleM15" ADD CONSTRAINT "CandleM15_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
