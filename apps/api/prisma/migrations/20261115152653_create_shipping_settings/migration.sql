-- CreateTable
CREATE TABLE "shipping_settings" (
    "seller_id" UUID NOT NULL,
    "origin_zip" CHAR(8) NOT NULL,
    "rates" JSONB NOT NULL,
    "free_shipping_threshold_cents" INTEGER,
    "handling_days" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_settings_pkey" PRIMARY KEY ("seller_id"),
    -- A validação mora no domínio (shipping.ts); o banco é a última palavra.
    CONSTRAINT "shipping_settings_origin_zip_check" CHECK ("origin_zip" ~ '^[0-9]{8}$'),
    CONSTRAINT "shipping_settings_handling_days_check" CHECK ("handling_days" BETWEEN 1 AND 5),
    CONSTRAINT "shipping_settings_free_shipping_check" CHECK ("free_shipping_threshold_cents" IS NULL OR "free_shipping_threshold_cents" > 0)
);

-- AddForeignKey
ALTER TABLE "shipping_settings" ADD CONSTRAINT "shipping_settings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
