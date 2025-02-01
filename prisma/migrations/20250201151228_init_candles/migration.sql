-- CreateTable
CREATE TABLE "TopCoin" (
    "id" SERIAL NOT NULL,
    "coin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume24" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost24" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volumeCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopCoin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Symbol" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Symbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exchange" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "apiUri" TEXT,
    "candlesUri" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 999,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" SERIAL NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "synonym" TEXT NOT NULL,
    "description" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candle" (
    "id" BIGSERIAL NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "trades" INTEGER NOT NULL DEFAULT 0,
    "tf" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportCandle" (
    "id" BIGSERIAL NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "tf" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "till" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportCandle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandleD1" (
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

    CONSTRAINT "CandleD1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ATHL" (
    "id" SERIAL NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "exchangeId" INTEGER NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "quantile236" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantile382" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantile50" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantile618" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantile786" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "start" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "index" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ath" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closeTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "highTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lowTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ATHL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalVar" (
    "id" TEXT NOT NULL,
    "val" DOUBLE PRECISION NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalVar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopCoin_coin_key" ON "TopCoin"("coin");

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_name_key" ON "Symbol"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_name_key" ON "Exchange"("name");

-- CreateIndex
CREATE INDEX "Market_synonym_exchangeId_idx" ON "Market"("synonym", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbolId_synonym_exchangeId_key" ON "Market"("symbolId", "synonym", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbolId_exchangeId_key" ON "Market"("symbolId", "exchangeId");

-- CreateIndex
CREATE INDEX "Candle_symbolId_exchangeId_tf_idx" ON "Candle"("symbolId", "exchangeId", "tf");

-- CreateIndex
CREATE INDEX "Candle_symbolId_exchangeId_idx" ON "Candle"("symbolId", "exchangeId");

-- CreateIndex
CREATE INDEX "Candle_time_idx" ON "Candle"("time");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_symbolId_exchangeId_tf_time_key" ON "Candle"("symbolId", "exchangeId", "tf", "time");

-- CreateIndex
CREATE INDEX "ExportCandle_symbolId_exchangeId_tf_idx" ON "ExportCandle"("symbolId", "exchangeId", "tf");

-- CreateIndex
CREATE INDEX "ExportCandle_symbolId_exchangeId_idx" ON "ExportCandle"("symbolId", "exchangeId");

-- CreateIndex
CREATE INDEX "ExportCandle_time_idx" ON "ExportCandle"("time");

-- CreateIndex
CREATE UNIQUE INDEX "ExportCandle_symbolId_exchangeId_tf_time_key" ON "ExportCandle"("symbolId", "exchangeId", "tf", "time");

-- CreateIndex
CREATE INDEX "CandleD1_symbolId_exchangeId_tf_idx" ON "CandleD1"("symbolId", "exchangeId", "tf");

-- CreateIndex
CREATE INDEX "CandleD1_symbolId_exchangeId_idx" ON "CandleD1"("symbolId", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "CandleD1_symbolId_exchangeId_tf_time_key" ON "CandleD1"("symbolId", "exchangeId", "tf", "time");

-- CreateIndex
CREATE UNIQUE INDEX "ATHL_symbolId_exchangeId_key" ON "ATHL"("symbolId", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalVar_id_key" ON "GlobalVar"("id");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportCandle" ADD CONSTRAINT "ExportCandle_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportCandle" ADD CONSTRAINT "ExportCandle_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandleD1" ADD CONSTRAINT "CandleD1_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandleD1" ADD CONSTRAINT "CandleD1_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ATHL" ADD CONSTRAINT "ATHL_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ATHL" ADD CONSTRAINT "ATHL_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
