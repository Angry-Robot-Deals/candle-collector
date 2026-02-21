-- CreateTable
CREATE TABLE "TopCoinFromCmc" (
    "id" SERIAL NOT NULL,
    "cmcId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "cmcRank" INTEGER,
    "logo" TEXT,
    "circulatingSupply" DOUBLE PRECISION,
    "totalSupply" DOUBLE PRECISION,
    "maxSupply" DOUBLE PRECISION,
    "ath" DOUBLE PRECISION,
    "atl" DOUBLE PRECISION,
    "high24h" DOUBLE PRECISION,
    "low24h" DOUBLE PRECISION,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentChange1h" DOUBLE PRECISION,
    "percentChange24h" DOUBLE PRECISION,
    "percentChange7d" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3),
    "dateAdded" TIMESTAMP(3),
    "isActive" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopCoinFromCmc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopCoinFromCmc_cmcId_key" ON "TopCoinFromCmc"("cmcId");

-- CreateIndex
CREATE INDEX "TopCoinFromCmc_symbol_idx" ON "TopCoinFromCmc"("symbol");

-- CreateIndex
CREATE INDEX "TopCoinFromCmc_volume24h_idx" ON "TopCoinFromCmc"("volume24h");
