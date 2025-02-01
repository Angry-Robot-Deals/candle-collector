/*
  Warnings:

  - The primary key for the `Candle` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "Candle" DROP CONSTRAINT "Candle_pkey",
ALTER COLUMN "id" SET DATA TYPE BIGSERIAL,
ADD CONSTRAINT "Candle_pkey" PRIMARY KEY ("id");
