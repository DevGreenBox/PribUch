#!/usr/bin/env node
/* Снимок каталога для демо-версии витрины (GitHub Pages).
 *
 * Демо-витрина статична: платформы Admik рядом нет, поэтому каталог, категории и
 * настройки магазина замораживаются в один JSON, а js/services/api-demo.js
 * подменяет им сетевой слой. Данные только читаются — заказы, заявки и оплата
 * в демо не работают принципиально (см. api-demo.js).
 *
 * Запуск (адрес API не хардкодим — репозиторий публичный):
 *   API=http://<host>:8080 node tools/build-demo-snapshot.mjs
 *
 * Storefront API авторизует браузерные запросы по заголовку Origin, поэтому
 * шлём его же (значение должно быть в STOREFRONT_ALLOWED_ORIGINS платформы).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'storefront/js/data/demo/catalog.json');

const API = (process.env.API || '').replace(/\/+$/, '');
if (!API) {
  console.error('Не задан адрес API. Пример: API=http://<host>:8080 node tools/build-demo-snapshot.mjs');
  process.exit(1);
}
const BASE = API + '/api/storefront/v1';
// Origin витрины, а не API: витрина живёт на :80, API — на :8080 того же хоста,
// поэтому по умолчанию берём адрес API без порта. Переопределяется через ORIGIN.
const ORIGIN = process.env.ORIGIN || new URL(API).origin.replace(/:\d+$/, '');

/** Один GET к Storefront API. Возвращает поле data ответа. */
async function get(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: { Origin: ORIGIN } });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text).data;
}

/** Полный список товаров: API отдаёт максимум 100 за раз. */
async function allProducts() {
  const out = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const url = new URL(BASE + '/products');
    url.searchParams.set('limit', limit);
    url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Origin: ORIGIN } });
    if (!res.ok) throw new Error(`GET /products → HTTP ${res.status}`);
    const body = await res.json();
    out.push(...(body.data || []));
    const total = body.pagination?.total ?? out.length;
    if (out.length >= total || !(body.data || []).length) break;
  }
  return out;
}

/** Карточки товаров пачками — их сотни, последовательно это слишком долго. */
async function details(slugs, concurrency = 8) {
  const out = {};
  let i = 0;
  let done = 0;
  async function worker() {
    while (i < slugs.length) {
      const slug = slugs[i++];
      out[slug] = await get('/products/' + encodeURIComponent(slug));
      if (++done % 50 === 0) console.log(`  карточек: ${done}/${slugs.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

console.log('Снимаем каталог с', BASE);

const [settings, categories, brands, products] = await Promise.all([
  get('/settings'),
  get('/categories'),
  get('/brands'),
  allProducts(),
]);
console.log(`  категорий: ${categories.length}, брендов: ${brands.length}, товаров: ${products.length}`);

const productDetails = await details(products.map((p) => p.slug));

const snapshot = {
  generatedAt: new Date().toISOString(),
  note: 'Снимок каталога для демо-витрины. Источник истины — база Admik.',
  settings,
  categories,
  brands,
  products,
  details: productDetails,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(snapshot));
const kb = Math.round(Buffer.byteLength(JSON.stringify(snapshot)) / 1024);
console.log(`Готово: ${OUT} (${kb} КБ, карточек ${Object.keys(productDetails).length})`);
