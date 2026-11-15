-- CreateEnum
CREATE TYPE "seller_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "pix_key_type" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP');

-- CreateTable
CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "store_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "instagram" TEXT,
    "main_category_id" UUID NOT NULL,
    "document_encrypted" TEXT NOT NULL,
    "document_hash" TEXT NOT NULL,
    "status" "seller_status" NOT NULL DEFAULT 'PENDING',
    "pix_key_type" "pix_key_type" NOT NULL,
    "pix_key" TEXT NOT NULL,
    "pix_key_owner_name" TEXT NOT NULL,
    "pix_key_owner_document" TEXT NOT NULL,
    "pix_key_verified_at" TIMESTAMP(3) NOT NULL,
    "commission_bps" INTEGER,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "suspended_at" TIMESTAMP(3),
    "suspension_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_user_id_key" ON "sellers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_slug_key" ON "sellers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_document_hash_key" ON "sellers"("document_hash");

-- CreateIndex
CREATE INDEX "sellers_status_applied_at_idx" ON "sellers"("status", "applied_at");

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
