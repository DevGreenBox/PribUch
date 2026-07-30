/* Тепловодоучет — клиент публичного Storefront API платформы Admik.
   Единственное место, где витрина ходит в сеть. Контракт: Uni_BD/docs/21.

   Принцип (anti-tamper, ADR-010 платформы): витрина НЕ считает и НЕ шлёт цены,
   итоги, вес и стоимость доставки. Она передаёт только выбор покупателя
   (товар/количество/промокод/адрес/способ) — всё остальное считает сервер.

   Авторизация браузерных запросов — по заголовку Origin (на сервере он должен
   быть в STOREFRONT_ALLOWED_ORIGINS; при пустой настройке — mock-режим, открыт).
*/
(function () {
  'use strict';

  var CFG = window.EVR_CONFIG || { apiBase: '', apiPath: '/api/storefront/v1' };
  var ROOT = CFG.apiBase + CFG.apiPath;

  /** Ошибка API: несёт код и HTTP-статус, чтобы страницы могли различать причины. */
  function ApiError(message, status, code) {
    var e = new Error(message || 'Ошибка запроса к серверу магазина');
    e.name = 'ApiError';
    e.status = status || 0;
    e.code = code || 'network_error';
    return e;
  }

  function qs(params) {
    if (!params) return '';
    var u = new URLSearchParams();
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      u.set(k, v);
    });
    var s = u.toString();
    return s ? '?' + s : '';
  }

  function request(method, path, opts) {
    opts = opts || {};
    var init = { method: method, mode: 'cors', credentials: 'omit', headers: {} };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    if (opts.headers) Object.keys(opts.headers).forEach(function (h) { init.headers[h] = opts.headers[h]; });

    return fetch(ROOT + path + qs(opts.params), init).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { /* не JSON */ }
        if (!res.ok) {
          var msg = (json && (json.message || json.error)) || ('HTTP ' + res.status);
          throw ApiError(msg, res.status, (json && json.error) || 'http_error');
        }
        return json ? json.data : null;
      });
    }, function (err) {
      throw ApiError('Магазин недоступен: ' + (err && err.message ? err.message : 'сеть'), 0, 'network_error');
    });
  }

  /* ---------------- Каталог ---------------- */

  function products(params) {
    return request('GET', '/products', { params: params });
  }

  /** Полный список по фильтру: API отдаёт максимум 100 за раз — идём страницами. */
  function allProducts(params) {
    var out = [];
    var limit = 100;
    function page(offset) {
      var p = Object.assign({}, params || {}, { limit: limit, offset: offset });
      return fetch(ROOT + '/products' + qs(p), { mode: 'cors', credentials: 'omit' })
        .then(function (res) {
          if (!res.ok) throw ApiError('HTTP ' + res.status, res.status, 'http_error');
          return res.json();
        })
        .then(function (body) {
          out = out.concat(body.data || []);
          var total = (body.pagination && body.pagination.total) || out.length;
          if (out.length < total && (body.data || []).length > 0) return page(offset + limit);
          return out;
        });
    }
    return page(0).catch(function (err) {
      if (err && err.name === 'ApiError') throw err;
      throw ApiError('Магазин недоступен: ' + (err && err.message ? err.message : 'сеть'), 0, 'network_error');
    });
  }

  function product(slug) { return request('GET', '/products/' + encodeURIComponent(slug)); }
  function categories() { return request('GET', '/categories'); }
  function brands() { return request('GET', '/brands'); }
  function settings() { return request('GET', '/settings'); }
  function pages() { return request('GET', '/pages'); }
  function page(slug) { return request('GET', '/pages/' + encodeURIComponent(slug)); }

  /* ---------------- id товара для заказа ----------------
     В списке товаров id намеренно нет (публичный контракт) — он есть в карточке.
     Корзина хранит slug'и, а quote/orders принимают productId, поэтому здесь
     резолвим slug → id с кэшем на вкладку. */

  var idCache = {};
  try {
    idCache = JSON.parse(sessionStorage.getItem('tvu_pid') || '{}') || {};
  } catch (e) { idCache = {}; }

  function rememberId(slug, id) {
    idCache[slug] = id;
    try { sessionStorage.setItem('tvu_pid', JSON.stringify(idCache)); } catch (e) {}
  }

  function productId(slug) {
    if (idCache[slug]) return Promise.resolve(idCache[slug]);
    return product(slug).then(function (p) {
      rememberId(slug, p.id);
      return p.id;
    });
  }

  /** Позиции корзины (slug+qty) → позиции для API (productId+qty). */
  function toApiItems(items) {
    return Promise.all(items.map(function (it) {
      return productId(it.slug).then(function (id) { return { productId: id, qty: it.qty }; });
    }));
  }

  /* ---------------- Корзина, заказы, доставка, оплата ---------------- */

  function quote(body) { return request('POST', '/cart/quote', { body: body }); }

  function createOrder(body, idempotencyKey) {
    return request('POST', '/orders', {
      body: body,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : null
    });
  }

  function order(number, token) {
    return request('GET', '/orders/' + encodeURIComponent(number), { params: { token: token } });
  }

  function cdekCities(q, limit) {
    return request('GET', '/delivery/cdek/cities', { params: { q: q, limit: limit || 10 } });
  }
  function cdekPvz(cityCode) {
    return request('GET', '/delivery/cdek/pvz', { params: { city_code: cityCode } });
  }
  /** Расчёт доставки: нужен ради СРОКА — стоимость берём из quote (там же скидки/порог). */
  function cdekCalculate(body) {
    return request('POST', '/delivery/cdek/calculate', { body: body });
  }

  function payInit(body) { return request('POST', '/payments/tbank/init', { body: body }); }

  function lead(body) { return request('POST', '/leads', { body: body }); }
  function newsletter(email) { return request('POST', '/newsletter', { body: { email: email } }); }

  /** Случайный ключ идемпотентности заказа (одна попытка оформления = один ключ). */
  function idempotencyKey() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'tvu-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  window.EVR_API = {
    root: ROOT,
    products: products, allProducts: allProducts, product: product,
    categories: categories, brands: brands, settings: settings,
    pages: pages, page: page,
    productId: productId, toApiItems: toApiItems,
    quote: quote, createOrder: createOrder, order: order,
    cdekCities: cdekCities, cdekPvz: cdekPvz, cdekCalculate: cdekCalculate, payInit: payInit,
    lead: lead, newsletter: newsletter,
    idempotencyKey: idempotencyKey
  };
})();
