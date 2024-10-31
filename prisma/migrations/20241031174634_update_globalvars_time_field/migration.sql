-- CreateTable
CREATE TABLE "GlobalVar" (
    "id" TEXT NOT NULL,
    "val" DOUBLE PRECISION NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalVar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalVar_id_key" ON "GlobalVar"("id");
