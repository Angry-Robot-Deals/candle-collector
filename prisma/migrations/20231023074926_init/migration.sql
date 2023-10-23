/*
  Warnings:

  - Added the required column `index` to the `ATHL` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ATHL" ADD COLUMN     "index" DOUBLE PRECISION NOT NULL;
