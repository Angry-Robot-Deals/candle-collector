-- CreateIndex
CREATE INDEX "Candle_symbol_exchange_timeframe_time_idx" ON "Candle"("symbol", "exchange", "timeframe", "time");

-- CreateIndex
CREATE INDEX "Candle_symbol_exchange_timeframe_idx" ON "Candle"("symbol", "exchange", "timeframe");

-- CreateIndex
CREATE INDEX "Candle_symbol_exchange_idx" ON "Candle"("symbol", "exchange");
