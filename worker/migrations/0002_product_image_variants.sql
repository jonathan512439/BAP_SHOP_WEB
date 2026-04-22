-- ============================================================
-- BAP_SHOP — Variantes responsive para imagenes de productos
-- Version: 0002
-- Fecha: 2026-04-16
-- ============================================================

ALTER TABLE product_images ADD COLUMN thumb_r2_key TEXT;
ALTER TABLE product_images ADD COLUMN card_r2_key TEXT;
ALTER TABLE product_images ADD COLUMN detail_r2_key TEXT;
ALTER TABLE product_images ADD COLUMN full_r2_key TEXT;

CREATE INDEX idx_product_images_product_sort
  ON product_images(product_id, sort_order);
