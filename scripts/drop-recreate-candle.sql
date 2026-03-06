-- Drop Candle table to free disk immediately (~47 GB). Then recreate empty table.
-- Run: sudo -u postgres psql -p 51432 -d CANDLES -f drop-recreate-candle.sql

DROP TABLE IF EXISTS "Candle" CASCADE;

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

CREATE INDEX "Candle_symbolId_exchangeId_tf_idx" ON "Candle"("symbolId", "exchangeId", "tf");
CREATE INDEX "Candle_symbolId_exchangeId_idx" ON "Candle"("symbolId", "exchangeId");
CREATE INDEX "Candle_time_idx" ON "Candle"("time");
CREATE UNIQUE INDEX "Candle_symbolId_exchangeId_tf_time_key" ON "Candle"("symbolId", "exchangeId", "tf", "time");

ALTER TABLE "Candle" ADD CONSTRAINT "Candle_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
