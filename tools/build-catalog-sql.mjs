#!/usr/bin/env node
/**
 * Генератор SQL-импорта каталога «Тепловодоучет» в БД Admik.
 *
 * Вход:  storefront/js/data/products.json (474 товара, разобранный katalog.xls).
 * Выход: tools/catalog-tvu.sql — идемпотентный скрипт (естественные ключи + ON CONFLICT),
 *        накатывается psql'ом ролью admik_migrator.
 *
 * Раскладка данных по модели платформы:
 *   • 10 корневых категорий              → categories (parent_id IS NULL)
 *   • подкатегории из колонки «МАРКА»     → categories (parent_id = корень)
 *   • производители из скобок «(…)»       → brands  (+ products.brand_id)
 *   • товар                               → products (простой, БЕЗ вариантов)
 *   • «цена по запросу» (price = null)     → base_price = 0 и остаток 0 (заказать нельзя)
 *   • остаток товаров с ценой             → inventory.quantity = 10 (условный, стенд)
 *
 * Логика «производитель / подкатегория» намеренно повторяет разбор витрины
 * (storefront/js/site.js): в исходной таблице колонка «МАРКА (ПРОИЗВОДИТЕЛЬ)»
 * смешивает подкатегорию и производителя.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../storefront/js/data/products.json');
const OUT = resolve(HERE, 'catalog-tvu.sql');

/* ------------------------------------------------------------------ */
/* Разбор колонки «МАРКА (ПРОИЗВОДИТЕЛЬ)» — как в storefront/js/site.js */
/* ------------------------------------------------------------------ */

const MAKERS = ['ТЕРМОТРОНИК', 'ТЕПЛОКОМ', 'ПРОМПРИБОР', 'ЛОГИКА', 'ВЗЛЁТ', 'ТЕПЛОВОДОМЕР',
                'ДЕКАСТ', 'ИНТЭП', 'ПОИНТ', 'ТЕРМИКО', 'ВИП', 'РОСМА'];
const normMaker = (s) => String(s || '').trim().toUpperCase().replace(/Ё/g, 'Е');
const MAKER_BY_NORM = new Map(MAKERS.map((m) => [normMaker(m), m]));
const isMaker = (s) => MAKER_BY_NORM.has(normMaker(s));

// Категории, где подкатегории в таблице нет и она определяется по названию товара.
const NAME_SUBS = {
  'Сервисные устройства': [
    [/^адаптер(\s|$)/i, 'Адаптеры'],
    [/^литиев[а-яё]*\s+батаре/i, 'Литиевые батареи'],
    [/^электронн[а-яё]*\s+регистратор/i, 'Электронные регистраторы'],
    [/^накопительн[а-яё]*\s+пульт/i, 'Накопительные пульты'],
    [/^устройств[а-яё]*\s+считывания/i, 'Устройства считывания и переноса данных'],
    [/^преобразовател[а-яё]*\s+интерфейс/i, 'Преобразователи интерфейсов'],
    [/^накопитель(\s|$)/i, 'Накопители'],
    [/^разделител[а-яё]*\s+интерфейс/i, 'Разделители интерфейса'],
    [/модем/i, 'Модемы'],
  ],
};
function subByName(category, name) {
  for (const [re, label] of NAME_SUBS[category] || []) if (re.test(name || '')) return label;
  return '';
}

/* ------------------------------------------------------------------ */
/* Транслитерация в ЧПУ                                                */
/* ------------------------------------------------------------------ */

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
function slugify(s, max = 70) {
  const out = String(s).toLowerCase().split('')
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (out || 'item').slice(0, max).replace(/-+$/g, '');
}
/** Выдаёт уникальный slug в пределах переданного множества. */
function uniqueSlug(base, used, tail) {
  if (!used.has(base)) { used.add(base); return base; }
  const withTail = `${base}-${tail}`;
  if (!used.has(withTail)) { used.add(withTail); return withTail; }
  let i = 2;
  while (used.has(`${withTail}-${i}`)) i += 1;
  used.add(`${withTail}-${i}`);
  return `${withTail}-${i}`;
}

/* ------------------------------------------------------------------ */
/* SQL-хелперы                                                         */
/* ------------------------------------------------------------------ */

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const qn = (v) => (v === null || v === undefined ? 'NULL' : q(v));

/* ------------------------------------------------------------------ */
/* Сборка                                                              */
/* ------------------------------------------------------------------ */

const data = JSON.parse(readFileSync(SRC, 'utf8'));

// 1. Обогащаем товары (производитель + подкатегория), как это делает витрина.
const products = data.products.map((p) => {
  const brand = (p.brand || '').trim();
  const m = /\(([^)]+)\)\s*$/.exec(brand);
  const tail = m ? m[1].trim() : '';
  const head = brand.replace(/\s*\([^)]*\)\s*$/, '').trim();
  let maker = '';
  let sub = '';
  if (m && isMaker(tail)) {
    maker = MAKER_BY_NORM.get(normMaker(tail));
    sub = isMaker(head) ? '' : head;
  } else {
    maker = isMaker(brand) ? MAKER_BY_NORM.get(normMaker(brand)) : '';
    sub = isMaker(brand) ? '' : brand;
  }
  const byName = subByName(p.category, p.name);
  if (byName) sub = byName;
  return { ...p, maker, sub };
});

// 2. Бренды (производители) — в порядке убывания числа товаров.
const makerCount = new Map();
for (const p of products) if (p.maker) makerCount.set(p.maker, (makerCount.get(p.maker) || 0) + 1);
const makers = [...makerCount.keys()].sort((a, b) => makerCount.get(b) - makerCount.get(a));
const brandSlugs = new Map();
const usedBrandSlugs = new Set();
makers.forEach((m) => brandSlugs.set(m, uniqueSlug(slugify(m), usedBrandSlugs, 'brand')));

// 3. Категории: корни в порядке katalog.xls, подкатегории — в порядке появления.
const usedCatSlugs = new Set();
const rootSlugs = new Map();
data.categories.forEach((c) => rootSlugs.set(c, uniqueSlug(slugify(c), usedCatSlugs, 'cat')));

const subSlugs = new Map();          // "категория|подкатегория" → slug
const subOrder = new Map();          // категория → [подкатегория, ...]
for (const p of products) {
  if (!p.sub) continue;
  const key = `${p.category}|${p.sub}`;
  if (subSlugs.has(key)) continue;
  subSlugs.set(key, uniqueSlug(slugify(p.sub), usedCatSlugs, slugify(p.category).slice(0, 20)));
  if (!subOrder.has(p.category)) subOrder.set(p.category, []);
  subOrder.get(p.category).push(p.sub);
}

// 4. Товары: slug (ключ идемпотентности) и sku.
const usedProductSlugs = new Set();
for (const p of products) {
  p.slug = uniqueSlug(slugify(p.name), usedProductSlugs, String(p.id));
  p.sku = `TVU-${String(p.id).padStart(4, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Генерация SQL                                                       */
/* ------------------------------------------------------------------ */

const L = [];
L.push('-- =============================================================================');
L.push('-- Каталог магазина «Тепловодоучет» — импорт в Admik.');
L.push('-- СГЕНЕРИРОВАНО tools/build-catalog-sql.mjs из storefront/js/data/products.json.');
L.push('-- Руками не править: правь источник и перегенерируй.');
L.push('--');
L.push('-- Идемпотентно: ключи — categories.slug / brands.slug / products.slug.');
L.push('-- Повторный накат обновляет названия/цены/привязки и НЕ трогает остатки');
L.push('-- (их ведёт владелец в админке) и не плодит дублей.');
L.push('-- =============================================================================');
L.push('');
L.push('BEGIN;');
L.push('');

// --- Бренды ---
L.push('-- --- Производители (brands) --------------------------------------------------');
L.push('INSERT INTO brands (slug, name, sort, is_active) VALUES');
L.push(makers.map((m, i) => `  (${q(brandSlugs.get(m))}, ${q(m)}, ${(i + 1) * 10}, true)`).join(',\n'));
L.push('ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort = EXCLUDED.sort,');
L.push('  is_active = true, updated_at = now();');
L.push('');

// --- Корневые категории ---
L.push('-- --- Категории верхнего уровня -----------------------------------------------');
L.push('INSERT INTO categories (slug, name, sort, is_active) VALUES');
L.push(data.categories.map((c, i) => `  (${q(rootSlugs.get(c))}, ${q(c)}, ${(i + 1) * 10}, true)`).join(',\n'));
L.push('ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort = EXCLUDED.sort,');
L.push('  is_active = true, updated_at = now();');
L.push('');

// --- Подкатегории ---
const subRows = [];
for (const [cat, subs] of subOrder) {
  subs.forEach((s, i) => {
    subRows.push(`  (${q(rootSlugs.get(cat))}, ${q(subSlugs.get(`${cat}|${s}`))}, ${q(s)}, ${(i + 1) * 10})`);
  });
}
L.push('-- --- Подкатегории (из колонки «МАРКА» исходной таблицы) ----------------------');
L.push('INSERT INTO categories (parent_id, slug, name, sort, is_active)');
L.push('SELECT parent.id, v.slug, v.name, v.sort::int, true');
L.push('FROM (VALUES');
L.push(subRows.join(',\n'));
L.push(') AS v(parent_slug, slug, name, sort)');
L.push('JOIN categories parent ON parent.slug = v.parent_slug');
L.push('ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id,');
L.push('  sort = EXCLUDED.sort, is_active = true, updated_at = now();');
L.push('');

// --- Товары ---
L.push('-- --- Товары (простые, без вариантов) -----------------------------------------');
L.push('-- price = null в источнике → base_price 0 = «Цена по запросу» на витрине.');
L.push('-- is_new = false: прайс переносится целиком, «новинками» товары помечает');
L.push('-- владелец в админке (иначе весь каталог получит бейдж «Новинка» по дате).');
L.push('INSERT INTO products (sku, slug, name, status, base_price, brand_id, is_new)');
L.push("SELECT v.sku, v.slug, v.name, 'active', v.price::numeric(14,2), b.id, false");
L.push('FROM (VALUES');
L.push(products.map((p) => (
  `  (${q(p.sku)}, ${q(p.slug)}, ${q(p.name)}, ${p.price == null ? 0 : p.price}, ${qn(p.maker ? brandSlugs.get(p.maker) : null)})`
)).join(',\n'));
L.push(') AS v(sku, slug, name, price, brand_slug)');
L.push('LEFT JOIN brands b ON b.slug = v.brand_slug');
L.push('ON CONFLICT (slug) DO UPDATE SET sku = EXCLUDED.sku, name = EXCLUDED.name,');
L.push("  base_price = EXCLUDED.base_price, brand_id = EXCLUDED.brand_id, status = 'active',");
L.push('  updated_at = now();');
L.push('');

// --- Привязка к категориям: основная (подкатегория, иначе корень) ---
L.push('-- --- Привязка товар → категория ----------------------------------------------');
L.push('-- Основная связь — самая глубокая (подкатегория, иначе корень).');
L.push('INSERT INTO product_categories (product_id, category_id, is_primary)');
L.push('SELECT p.id, c.id, true');
L.push('FROM (VALUES');
L.push(products.map((p) => {
  const catSlug = p.sub ? subSlugs.get(`${p.category}|${p.sub}`) : rootSlugs.get(p.category);
  return `  (${q(p.slug)}, ${q(catSlug)})`;
}).join(',\n'));
L.push(') AS v(product_slug, category_slug)');
L.push('JOIN products p ON p.slug = v.product_slug');
L.push('JOIN categories c ON c.slug = v.category_slug');
L.push('ON CONFLICT (product_id, category_id) DO UPDATE SET is_primary = true;');
L.push('');

const rootLinks = products.filter((p) => p.sub);
L.push('-- Дополнительная связь с корневой категорией: чтобы фильтр по разделу');
L.push('-- (?category=<корень>) отдавал и товары из его подкатегорий.');
L.push('INSERT INTO product_categories (product_id, category_id, is_primary)');
L.push('SELECT p.id, c.id, false');
L.push('FROM (VALUES');
L.push(rootLinks.map((p) => `  (${q(p.slug)}, ${q(rootSlugs.get(p.category))})`).join(',\n'));
L.push(') AS v(product_slug, category_slug)');
L.push('JOIN products p ON p.slug = v.product_slug');
L.push('JOIN categories c ON c.slug = v.category_slug');
L.push('ON CONFLICT (product_id, category_id) DO NOTHING;');
L.push('');

// --- Остатки ---
L.push('-- --- Остатки -----------------------------------------------------------------');
L.push('-- Фактических остатков в прайсе нет: товарам с ценой ставим условные 10 шт,');
L.push('-- «цена по запросу» — 0 (заказать нельзя, только запрос). Повторный импорт');
L.push('-- остатки НЕ трогает — их ведёт владелец в админке.');
L.push('INSERT INTO inventory (product_id, variant_id, warehouse_code, quantity)');
L.push("SELECT p.id, NULL, 'main', v.qty::int");
L.push('FROM (VALUES');
L.push(products.map((p) => `  (${q(p.slug)}, ${p.price == null ? 0 : 10})`).join(',\n'));
L.push(') AS v(product_slug, qty)');
L.push('JOIN products p ON p.slug = v.product_slug');
L.push("ON CONFLICT (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), warehouse_code)");
L.push('  DO NOTHING;');
L.push('');
L.push('COMMIT;');
L.push('');

writeFileSync(OUT, L.join('\n'), 'utf8');

const priced = products.filter((p) => p.price != null).length;
console.log(`SQL: ${OUT}`);
console.log(`  категорий верхнего уровня: ${data.categories.length}`);
console.log(`  подкатегорий:              ${subSlugs.size}`);
console.log(`  производителей (брендов):  ${makers.length}`);
console.log(`  товаров:                   ${products.length} (с ценой ${priced}, по запросу ${products.length - priced})`);
