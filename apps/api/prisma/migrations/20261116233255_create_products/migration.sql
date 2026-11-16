-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "product_condition" AS ENUM ('NEW', 'USED');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "condition" "product_condition" NOT NULL,
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "min_price_cents" INTEGER,
    "published_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "suspension_reason" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "color_hex" CHAR(7) NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "compare_at_cents" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "weight_grams" INTEGER NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "path" TEXT NOT NULL,
    "seller_id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detached_at" TIMESTAMP(3),

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("path")
);

-- CreateIndex
CREATE INDEX "products_seller_id_status_created_at_idx" ON "products"("seller_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "products_status_category_id_min_price_cents_idx" ON "products"("status", "category_id", "min_price_cents");

-- CreateIndex
CREATE UNIQUE INDEX "products_seller_id_slug_key" ON "products"("seller_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_size_color_key" ON "product_variants"("product_id", "size", "color");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_seller_id_sku_active_key" ON "product_variants"("seller_id", "sku") WHERE (archived_at IS NULL);

-- CreateIndex
CREATE INDEX "product_images_path_idx" ON "product_images"("path");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_position_key" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE INDEX "uploads_created_at_idx" ON "uploads"("created_at");

-- CreateIndex
CREATE INDEX "uploads_detached_at_idx" ON "uploads"("detached_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_path_fkey" FOREIGN KEY ("path") REFERENCES "uploads"("path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- As regras moram no domínio (product.ts, variant.ts); o banco é a última palavra.
ALTER TABLE "products"
    ADD CONSTRAINT "products_version_check" CHECK ("version" >= 1),
    ADD CONSTRAINT "products_min_price_check" CHECK ("min_price_cents" IS NULL OR "min_price_cents" > 0);

ALTER TABLE "product_variants"
    ADD CONSTRAINT "product_variants_stock_check" CHECK ("stock" >= 0 AND "reserved" >= 0 AND "reserved" <= "stock"),
    ADD CONSTRAINT "product_variants_price_check" CHECK ("price_cents" > 0),
    ADD CONSTRAINT "product_variants_compare_at_check" CHECK ("compare_at_cents" IS NULL OR "compare_at_cents" > "price_cents"),
    ADD CONSTRAINT "product_variants_weight_check" CHECK ("weight_grams" BETWEEN 1 AND 30000),
    ADD CONSTRAINT "product_variants_color_hex_check" CHECK ("color_hex" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "product_images"
    ADD CONSTRAINT "product_images_position_check" CHECK ("position" BETWEEN 0 AND 7);

ALTER TABLE "uploads"
    ADD CONSTRAINT "uploads_size_check" CHECK ("size_bytes" > 0);
