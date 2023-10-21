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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopCoin_coin_key" ON "TopCoin"("coin");

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_name_key" ON "Symbol"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_name_key" ON "Exchange"("name");

-- CreateIndex
CREATE INDEX "Market_symbolId_exchangeId_idx" ON "Market"("symbolId", "exchangeId");

-- CreateIndex
CREATE INDEX "Market_synonym_exchangeId_idx" ON "Market"("synonym", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbolId_synonym_exchangeId_key" ON "Market"("symbolId", "synonym", "exchangeId");

-- CreateIndex
CREATE INDEX "Candle_symbolId_exchangeId_timeframe_idx" ON "Candle"("symbolId", "exchangeId", "timeframe");

-- CreateIndex
CREATE INDEX "Candle_symbolId_exchangeId_idx" ON "Candle"("symbolId", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_symbolId_exchangeId_timeframe_time_key" ON "Candle"("symbolId", "exchangeId", "timeframe", "time");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
