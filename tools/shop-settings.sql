-- =============================================================================
-- Настройки магазина «Тепловодоучет» (shop_settings) — стартовое наполнение.
-- =============================================================================
-- Эти разделы витрина читает через GET /api/storefront/v1/settings: название,
-- контакты, реквизиты, валюта. Дальше их правит владелец в админке
-- (/admin/settings) — скрипт нужен только для первичного заведения инстанса.
--
-- ⚠ После прямой правки БД сбрасывается только рестартом приложения
--   (кэш эффективных настроек), через админку — автоматически.
--
-- ⚠ АДРЕС — демонстрационный: заменить на фактический адрес ИП.
-- =============================================================================

INSERT INTO shop_settings (setting_key, value) VALUES
  ('branding', jsonb_build_object(
      'shopName', 'Тепловодоучет',
      'supportEmail', 'ip-bazhukov@yandex.ru',
      'supportPhone', '+7 (964) 390-71-39'
  )),
  ('contacts', jsonb_build_object(
      'phone', '+7 (964) 390-71-39',
      'email', 'ip-bazhukov@yandex.ru',
      'address', 'г. Москва, ул. Примерная, д. 1, оф. 10',
      'workingHours', 'Пн–Пт 9:00–18:00'
  )),
  ('legal_entity', jsonb_build_object(
      'name', 'ИП Бажуков Алексей Андреевич',
      'inn', '470306908187',
      'ogrn', '317470400079659'
  )),
  ('currency', jsonb_build_object(
      'code', 'RUB',
      'symbol', '₽',
      'locale', 'ru-RU',
      'fractionDigits', 0
  ))
ON CONFLICT (setting_key) DO UPDATE
  SET value = shop_settings.value || EXCLUDED.value,   -- не затираем то, что уже правил владелец
      updated_at = now();
