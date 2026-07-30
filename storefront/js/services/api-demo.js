/* Тепловодоучет — демо-режим витрины (GitHub Pages).

   На Pages рядом нет платформы Admik: сайт статичен, а её API доступен только по
   HTTP, тогда как Pages отдаётся по HTTPS (браузер заблокировал бы такие запросы
   как mixed content). Поэтому в демо каталог берётся из замороженного снимка
   js/data/demo/catalog.json (собирается tools/build-demo-snapshot.mjs).

   Здесь ПОДМЕНЯЕТСЯ window.EVR_API целиком — страницы (site.js, catalog.js,
   product.js, cart.js, checkout.js) не знают о демо-режиме и не правились.

   Чего в демо принципиально нет: заказы, оплата, заявки и статус заказа. Эти
   методы отклоняются с понятным сообщением — страницы уже умеют показывать
   ошибку API, поэтому имитировать успех («заказ принят», «заявка отправлена»)
   было бы враньём перед посетителем.

   Расчёт корзины в демо — клиентский и приблизительный: на боевой витрине итоги,
   скидки и доставку считает сервер (anti-tamper, ADR-010 платформы).
*/
(function () {
  'use strict';

  if (!window.EVR_CONFIG || !window.EVR_CONFIG.demo) return;

  var DATA_URL = 'js/data/demo/catalog.json';
  var DELIVERY_DEMO_COST = 350;          // условный тариф витрины-демо
  var real = window.EVR_API || {};

  /* ---------------- Загрузка снимка ---------------- */

  var snapPromise = null;

  function snap() {
    if (!snapPromise) {
      snapPromise = fetch(DATA_URL, { credentials: 'omit' })
        .then(function (res) {
          if (!res.ok) throw fail('Не удалось загрузить демо-каталог (HTTP ' + res.status + ')', res.status);
          return res.json();
        })
        .then(function (d) {
          // Индекс id → карточка: корзина и quote оперируют productId, а снимок
          // разложен по slug'ам.
          d.byId = {};
          Object.keys(d.details || {}).forEach(function (slug) {
            var p = d.details[slug];
            if (p && p.id) d.byId[p.id] = p;
          });
          return d;
        });
      snapPromise.catch(function () { snapPromise = null; });   // дать шанс повтору
    }
    return snapPromise;
  }

  function fail(message, status, code) {
    var e = new Error(message);
    e.name = 'ApiError';
    e.status = status || 0;
    e.code = code || 'demo_mode';
    return e;
  }

  /** Метод, которого в демо быть не может: витрине писать некуда. */
  function unavailable(what) {
    return function () {
      return Promise.reject(fail(
        'демо-версия сайта, ' + what + ' здесь не работает — витрина показывает ' +
        'сохранённый каталог без подключения к магазину',
        0, 'demo_mode'
      ));
    };
  }

  /* ---------------- Каталог ---------------- */

  function categories() { return snap().then(function (d) { return d.categories || []; }); }
  function brands() { return snap().then(function (d) { return d.brands || []; }); }
  function settings() { return snap().then(function (d) { return d.settings || {}; }); }
  function allProducts() { return snap().then(function (d) { return d.products || []; }); }

  function product(slug) {
    return snap().then(function (d) {
      var p = (d.details || {})[slug];
      if (!p) throw fail('Товар не найден', 404, 'not_found');
      return p;
    });
  }

  /* Полноценной серверной фильтрации в демо нет: витрина и так забирает весь
     каталог разом и фильтрует на клиенте (474 позиции). Поддерживаем только
     срез по количеству — им пользуются блоки на главной. */
  function products(params) {
    return allProducts().then(function (list) {
      var p = params || {};
      var out = list.slice(Number(p.offset) || 0);
      if (p.limit) out = out.slice(0, Number(p.limit));
      return out;
    });
  }

  /* ---------------- id товара ---------------- */

  function productId(slug) {
    return product(slug).then(function (p) { return p.id; });
  }

  function toApiItems(items) {
    return Promise.all(items.map(function (it) {
      return productId(it.slug).then(function (id) { return { productId: id, qty: it.qty }; });
    }));
  }

  /* ---------------- Корзина ---------------- */

  function quote(body) {
    return snap().then(function (d) {
      var items = (body && body.items) || [];
      var itemsTotal = 0;
      var issues = [];

      items.forEach(function (it) {
        var p = d.byId[it.productId];
        if (!p) { issues.push({ code: 'not_found', message: 'позиция недоступна' }); return; }
        var price = Number(p.price || 0);
        if (!price) {
          issues.push({ code: 'price_on_request', message: p.name + ' — цена по запросу' });
          return;
        }
        itemsTotal += price * (Number(it.qty) || 0);
      });

      var delivery = body && body.delivery;
      var deliveryTotal = !delivery || delivery.type === 'pickup' ? 0 : DELIVERY_DEMO_COST;

      return {
        itemsTotal: itemsTotal,
        discountTotal: 0,
        deliveryTotal: deliveryTotal,
        grandTotal: itemsTotal + deliveryTotal,
        promo: body && body.promoCode ? { valid: false } : null,
        issues: issues.concat([{
          code: 'demo',
          message: 'Демо-режим: сумма посчитана в браузере, доставка условная (' +
                   DELIVERY_DEMO_COST + ' ₽). На рабочем сайте итоги считает магазин.'
        }])
      };
    });
  }

  /* ---------------- Доставка (демо-справочники) ----------------
     Живые подсказки СДЭК требуют сервера с ключами договора. В демо отдаём
     небольшой статичный список, чтобы шаги оформления можно было пройти глазами. */

  var DEMO_CITIES = [
    { code: 44, name: 'Москва', region: 'Москва' },
    { code: 137, name: 'Санкт-Петербург', region: 'Санкт-Петербург' },
    { code: 250, name: 'Екатеринбург', region: 'Свердловская обл.' },
    { code: 270, name: 'Новосибирск', region: 'Новосибирская обл.' },
    { code: 428, name: 'Краснодар', region: 'Краснодарский край' },
    { code: 980, name: 'Всеволожск', region: 'Ленинградская обл.' }
  ];

  function cdekCities(q) {
    var s = String(q || '').toLowerCase();
    return Promise.resolve(DEMO_CITIES.filter(function (c) {
      return c.name.toLowerCase().indexOf(s) === 0;
    }));
  }

  function cdekPvz(cityCode) {
    var city = DEMO_CITIES.filter(function (c) { return String(c.code) === String(cityCode); })[0];
    var name = city ? city.name : 'город';
    return Promise.resolve([
      { code: 'DEMO1', name: 'Демо-ПВЗ №1', address: name + ', демонстрационный пункт выдачи №1' },
      { code: 'DEMO2', name: 'Демо-ПВЗ №2', address: name + ', демонстрационный пункт выдачи №2' }
    ]);
  }

  function cdekCalculate() {
    return Promise.resolve({ etaDays: 3, periodMin: 2, periodMax: 4, demo: true });
  }

  /* ---------------- Подмена ---------------- */

  window.EVR_API = {
    root: 'demo:' + DATA_URL,
    demo: true,

    products: products, allProducts: allProducts, product: product,
    categories: categories, brands: brands, settings: settings,
    pages: function () { return Promise.resolve([]); },
    page: unavailable('раздел'),

    productId: productId, toApiItems: toApiItems,
    quote: quote,

    cdekCities: cdekCities, cdekPvz: cdekPvz, cdekCalculate: cdekCalculate,

    createOrder: unavailable('оформление заказа'),
    order: unavailable('просмотр статуса заказа'),
    payInit: unavailable('оплата'),
    lead: unavailable('отправка заявки'),
    newsletter: unavailable('подписка'),

    idempotencyKey: real.idempotencyKey || function () { return 'demo'; }
  };

  /* ---------------- Плашка «демо» ----------------
     Посетитель должен понимать, почему заказ не оформляется. */

  function banner() {
    if (document.getElementById('demo-banner')) return;
    var el = document.createElement('div');
    el.id = 'demo-banner';
    el.setAttribute('role', 'status');
    el.style.cssText = 'background:#1a1d21;color:#fff;font-size:13px;line-height:1.5;' +
      'padding:8px 16px;text-align:center';
    el.innerHTML = 'Демонстрационная версия: каталог показан из сохранённого снимка, ' +
      'заказы и заявки не отправляются.';
    document.body.insertBefore(el, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', banner);
  } else {
    banner();
  }
})();
