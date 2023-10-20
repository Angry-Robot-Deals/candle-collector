/*
  Warnings:

  - You are about to drop the `Symbol` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Exchange" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Symbol";
