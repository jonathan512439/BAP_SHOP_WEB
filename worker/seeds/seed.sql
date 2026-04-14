-- ============================================================
-- BAP_SHOP — Seeds de datos iniciales
-- Ejecutar DESPUÉS de la migración 0001_initial.sql
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- CONFIGURACIÓN GENERAL
-- IMPORTANTE: Actualizar whatsapp_number y whatsapp_header antes de producción
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('store_name',           'BAP Shop'),
  ('whatsapp_number',      '59167156258'),
  ('whatsapp_header',      'Nuevo pedido desde la tienda online'),
  ('order_expiry_minutes', '120'),
  ('brand_logo_url',       ''),
  ('social_facebook_url',  ''),
  ('social_tiktok_url',    ''),
  ('social_instagram_url', ''),
  ('store_banner_title',   'Piezas seleccionadas, stock real'),
  ('store_banner_text',    'Catalogo actualizado desde el panel con disponibilidad y promociones sincronizadas.'),
  ('store_banner_image_url', ''),
  ('store_banner_video_url', ''),
  ('store_banner_media_type', 'image'),
  ('admin_banner_title',   'BAP Shop Admin'),
  ('admin_banner_text',    'Gestion centralizada de catalogo, promociones, pedidos y ajustes.'),
  ('admin_banner_image_url', ''),
  ('catalog_version',      '1');

-- ============================================================
-- ADMIN INICIAL
-- IMPORTANTE: Este password_hash estÃ¡ generado con el algoritmo actual del Worker.
-- Antes de usar en desarrollo, generar el hash real con el script:
--   pnpm --filter worker hash-password
-- El hash se genera con PBKDF2-SHA256 + salt + ADMIN_PEPPER del .dev.vars
--
-- Usuario: admin
-- Contraseña: DEBE CAMBIARSE (ver README)
-- ============================================================
INSERT INTO admins (id, username, password_hash, created_at) VALUES
  (
    'adm_01_bap_shop_default',
    'admin',
    'pbkdf2$28820f95611d0ef20f9ae680eb1077d9672ccf62e52d188fe095af268feaedbb$df2402c39fc87f2b5c6b953a53e791ad724d24d87bd029982e0a12f1b3d637d3',
    '2026-03-22T00:00:00.000Z'
  ),
  (
    'adm_02_bap_shop_default',
    'admin2',
    'passwordhashdeprueba2',
    '2026-03-22T00:00:00.000Z'
  );

-- ============================================================
-- MARCAS DE ZAPATILLAS
-- ============================================================
INSERT INTO brands (id, name, slug, is_active, created_at) VALUES
  ('brand_nike',       'Nike',        'nike',        1, '2026-03-22T00:00:00.000Z'),
  ('brand_adidas',     'Adidas',      'adidas',      1, '2026-03-22T00:00:00.000Z'),
  ('brand_nb',         'New Balance', 'new-balance', 1, '2026-03-22T00:00:00.000Z'),
  ('brand_converse',   'Converse',    'converse',    1, '2026-03-22T00:00:00.000Z'),
  ('brand_vans',       'Vans',        'vans',        1, '2026-03-22T00:00:00.000Z'),
  ('brand_puma',       'Puma',        'puma',        1, '2026-03-22T00:00:00.000Z'),
  ('brand_reebok',     'Reebok',      'reebok',      1, '2026-03-22T00:00:00.000Z'),
  ('brand_jordan',     'Jordan',      'jordan',      1, '2026-03-22T00:00:00.000Z'),
  ('brand_asics',      'Asics',       'asics',       1, '2026-03-22T00:00:00.000Z'),
  ('brand_saucony',    'Saucony',     'saucony',     1, '2026-03-22T00:00:00.000Z');

-- ============================================================
-- MODELOS POR MARCA
-- ============================================================

-- Nike
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_nike_af1',       'brand_nike', 'Air Force 1',       'air-force-1',       1, '2026-03-22T00:00:00.000Z'),
  ('model_nike_am90',      'brand_nike', 'Air Max 90',        'air-max-90',        1, '2026-03-22T00:00:00.000Z'),
  ('model_nike_am95',      'brand_nike', 'Air Max 95',        'air-max-95',        1, '2026-03-22T00:00:00.000Z'),
  ('model_nike_am97',      'brand_nike', 'Air Max 97',        'air-max-97',        1, '2026-03-22T00:00:00.000Z'),
  ('model_nike_dunk_low',  'brand_nike', 'Dunk Low',          'dunk-low',          1, '2026-03-22T00:00:00.000Z'),
  ('model_nike_dunk_high', 'brand_nike', 'Dunk High',         'dunk-high',         1, '2026-03-22T00:00:00.000Z'),
  ('model_nike_blazer',    'brand_nike', 'Blazer Mid',        'blazer-mid',        1, '2026-03-22T00:00:00.000Z'),
  ('model_nike_cortez',    'brand_nike', 'Cortez',            'cortez',            1, '2026-03-22T00:00:00.000Z');

-- Adidas
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_adi_superstar',  'brand_adidas', 'Superstar',   'superstar',   1, '2026-03-22T00:00:00.000Z'),
  ('model_adi_stan',       'brand_adidas', 'Stan Smith',  'stan-smith',  1, '2026-03-22T00:00:00.000Z'),
  ('model_adi_campus',     'brand_adidas', 'Campus',      'campus',      1, '2026-03-22T00:00:00.000Z'),
  ('model_adi_samba',      'brand_adidas', 'Samba',       'samba',       1, '2026-03-22T00:00:00.000Z'),
  ('model_adi_gazelle',    'brand_adidas', 'Gazelle',     'gazelle',     1, '2026-03-22T00:00:00.000Z'),
  ('model_adi_forum',      'brand_adidas', 'Forum',       'forum',       1, '2026-03-22T00:00:00.000Z'),
  ('model_adi_nmd',        'brand_adidas', 'NMD',         'nmd',         1, '2026-03-22T00:00:00.000Z');

-- New Balance
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_nb_574',   'brand_nb', '574',   '574',   1, '2026-03-22T00:00:00.000Z'),
  ('model_nb_990',   'brand_nb', '990',   '990',   1, '2026-03-22T00:00:00.000Z'),
  ('model_nb_991',   'brand_nb', '991',   '991',   1, '2026-03-22T00:00:00.000Z'),
  ('model_nb_992',   'brand_nb', '992',   '992',   1, '2026-03-22T00:00:00.000Z'),
  ('model_nb_327',   'brand_nb', '327',   '327',   1, '2026-03-22T00:00:00.000Z'),
  ('model_nb_530',   'brand_nb', '530',   '530',   1, '2026-03-22T00:00:00.000Z'),
  ('model_nb_2002r', 'brand_nb', '2002R', '2002r', 1, '2026-03-22T00:00:00.000Z');

-- Converse
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_conv_ct_low',  'brand_converse', 'Chuck Taylor All Star Low',  'chuck-taylor-low',  1, '2026-03-22T00:00:00.000Z'),
  ('model_conv_ct_high', 'brand_converse', 'Chuck Taylor All Star High', 'chuck-taylor-high', 1, '2026-03-22T00:00:00.000Z'),
  ('model_conv_one_str', 'brand_converse', 'One Star',                   'one-star',          1, '2026-03-22T00:00:00.000Z'),
  ('model_conv_run_str', 'brand_converse', 'Run Star Hike',              'run-star-hike',     1, '2026-03-22T00:00:00.000Z');

-- Vans
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_vans_old_sk',  'brand_vans', 'Old Skool',  'old-skool',  1, '2026-03-22T00:00:00.000Z'),
  ('model_vans_sk8_hi',  'brand_vans', 'Sk8-Hi',     'sk8-hi',     1, '2026-03-22T00:00:00.000Z'),
  ('model_vans_eras',    'brand_vans', 'Era',        'era',        1, '2026-03-22T00:00:00.000Z'),
  ('model_vans_slip',    'brand_vans', 'Slip-On',    'slip-on',    1, '2026-03-22T00:00:00.000Z'),
  ('model_vans_auth',    'brand_vans', 'Authentic',  'authentic',  1, '2026-03-22T00:00:00.000Z');

-- Puma
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_puma_suede',   'brand_puma', 'Suede Classic', 'suede-classic', 1, '2026-03-22T00:00:00.000Z'),
  ('model_puma_clyde',   'brand_puma', 'Clyde',         'clyde',         1, '2026-03-22T00:00:00.000Z'),
  ('model_puma_rs_x',    'brand_puma', 'RS-X',          'rs-x',          1, '2026-03-22T00:00:00.000Z');

-- Reebok
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_rbk_classic',  'brand_reebok', 'Classic Leather',  'classic-leather',  1, '2026-03-22T00:00:00.000Z'),
  ('model_rbk_club',     'brand_reebok', 'Club C 85',        'club-c-85',        1, '2026-03-22T00:00:00.000Z'),
  ('model_rbk_workout',  'brand_reebok', 'Workout Plus',     'workout-plus',     1, '2026-03-22T00:00:00.000Z');

-- Jordan
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_aj_1_low',   'brand_jordan', 'Air Jordan 1 Low',  'air-jordan-1-low',  1, '2026-03-22T00:00:00.000Z'),
  ('model_aj_1_mid',   'brand_jordan', 'Air Jordan 1 Mid',  'air-jordan-1-mid',  1, '2026-03-22T00:00:00.000Z'),
  ('model_aj_1_high',  'brand_jordan', 'Air Jordan 1 High', 'air-jordan-1-high', 1, '2026-03-22T00:00:00.000Z'),
  ('model_aj_3',       'brand_jordan', 'Air Jordan 3',      'air-jordan-3',      1, '2026-03-22T00:00:00.000Z'),
  ('model_aj_4',       'brand_jordan', 'Air Jordan 4',      'air-jordan-4',      1, '2026-03-22T00:00:00.000Z'),
  ('model_aj_11',      'brand_jordan', 'Air Jordan 11',     'air-jordan-11',     1, '2026-03-22T00:00:00.000Z');

-- Asics
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_asics_gel_lyte', 'brand_asics', 'Gel-Lyte III', 'gel-lyte-iii', 1, '2026-03-22T00:00:00.000Z'),
  ('model_asics_gel_kayano','brand_asics', 'Gel-Kayano',  'gel-kayano',   1, '2026-03-22T00:00:00.000Z'),
  ('model_asics_gel_1130', 'brand_asics', 'Gel-1130',     'gel-1130',     1, '2026-03-22T00:00:00.000Z');

-- Saucony
INSERT INTO models (id, brand_id, name, slug, is_active, created_at) VALUES
  ('model_sau_jazz',     'brand_saucony', 'Jazz Original', 'jazz-original', 1, '2026-03-22T00:00:00.000Z'),
  ('model_sau_shadow',   'brand_saucony', 'Shadow 6000',   'shadow-6000',   1, '2026-03-22T00:00:00.000Z'),
  ('model_sau_grid',     'brand_saucony', 'Grid 9000',     'grid-9000',     1, '2026-03-22T00:00:00.000Z');
