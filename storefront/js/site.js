/* Тепловодоучет — общий скрипт: логотип, иконки, шапка, футер, корзина, хелперы.
   Каталог и настройки магазина приезжают из Storefront API платформы Admik
   (js/services/api.js), поэтому витрине нужен HTTP-сервер — через file:// она
   больше не работает. */
(function () {
  'use strict';

  /* ---------------- Иконки (inline SVG) ---------------- */
  var I = {
    // Прежний знак логотипа (сейчас не используется — логотип шрифтовой): капля (вода) + шкала/деление (учёт) в квадратном знаке
    logo: '<svg class="logo__mark" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<rect x="1.5" y="1.5" width="37" height="37" rx="9" stroke="currentColor" stroke-width="2.5"/>' +
          '<path d="M20 9c4.2 4.6 7 8.2 7 11.6a7 7 0 1 1-14 0C13 17.2 15.8 13.6 20 9z" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
          '<path d="M20 20.5v5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
          '<path d="M17 23.2l3 2.8 3-2.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.3a1.5 1.5 0 0 0 1.5 1.2h8.5a1.5 1.5 0 0 0 1.5-1.2L22 7H6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6h14v10H1zM15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.2V5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8z"/><path d="M7.5 7.5h.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/></svg>',
    empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4M8 11h6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3z"/></svg>',
    // Молния — быстрая отгрузка
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
    // Гарнитура — поддержка и подбор оборудования
    support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
             '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="13" width="4.5" height="7" rx="2"/><rect x="17.5" y="13" width="4.5" height="7" rx="2"/>' +
             '<path d="M19.8 20v.5a2.5 2.5 0 0 1-2.5 2.5H14"/></svg>',
    // Карта + часы — отсрочка платежа
    credit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="2" y="4" width="12" height="8" rx="2"/><path d="M2 7h12"/>' +
            '<circle cx="17.5" cy="17" r="4.8"/><path d="M17.5 14.6V17l1.7 1.1"/></svg>',
    // Календарь с галочкой — работа без выходных
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>' +
              '<path d="M9 15.2l2.2 2.3 4-4.2"/></svg>'
  };

  /* Иконки категорий */
  var CAT_ICONS = {
    'calc':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><rect x="7" y="5" width="10" height="4"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/></svg>',
    'gauge': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-4"/><path d="M4 15h2M18 15h2M12 5v2"/></svg>',
    'drop':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4 4.4 7 7.8 7 11a7 7 0 1 1-14 0c0-3.2 3-6.6 7-11z"/></svg>',
    'flame': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 3 5 5 5 9a5 5 0 0 1-10 0c0-1.5.6-2.7 1.5-3.7C9 9 10 7 12 3z"/><path d="M12 21v-4"/></svg>',
    'therm': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13V5a2 2 0 1 1 4 0v8a4 4 0 1 1-4 0z"/><path d="M12 13V8"/></svg>',
    'press': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 12l4-3M12 4v2"/></svg>',
    // Оборудование для монтажа — гаечный ключ с отвёрткой
    'tool':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
             '<path d="M14.6 6.4a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.2-3.2a5.5 5.5 0 0 1-7.3 7.3l-6.2 6.2a2 2 0 0 1-2.8-2.8l6.2-6.2a5.5 5.5 0 0 1 7.3-7.3l-3.4 3z"/>' +
             '<path d="M4 4l4 4M6.5 2.5l-4 4"/></svg>',
    // Сервисные устройства — модем/адаптер связи
    'router': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
             '<rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7.5 17.5h.01M11 17.5h6"/>' +
             '<path d="M12 14v-4"/><path d="M9 7.5a4.2 4.2 0 0 1 6 0"/><path d="M6.6 4.9a7.6 7.6 0 0 1 10.8 0"/></svg>',
    'plug':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/></svg>',
    'box':   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    'chip':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>'
  };

  var CATEGORY_META = {
    'Тепловычислители': 'calc',
    'Расходомеры': 'gauge',
    'Счетчики воды': 'drop',
    'Корректоры газа': 'flame',
    'Термопреобразователи': 'therm',
    'Датчики давления': 'press',
    'КИПиА': 'chip',
    'Сервисные устройства': 'router',
    'Электротехническое оборудование': 'plug',
    'Оборудование для монтажа': 'tool'
  };

  function catIcon(cat) { return CAT_ICONS[CATEGORY_META[cat] || 'box'] || CAT_ICONS.box; }

  /* ---------------- Данные: Storefront API платформы Admik ----------------
     Витрина ничего не хранит и не пересчитывает: каталог, категории и остатки
     приезжают из /api/storefront/v1/* (см. js/services/api.js). Локального
     файла с товарами больше нет — источник истины один, админка.

     Форма товара на витрине (совместима с прежней разметкой):
       { id (=slug), slug, name, category, sub, maker, makerLabel, brand,
         price (null = «Цена по запросу»), inStock, availableQty, segment, _i } */

  var DATA = { categories: [], subcategories: {}, products: [], loaded: false };

  // Ценовой сегмент — витринная эвристика по цене (в каталоге такого поля нет).
  function segmentOf(price) {
    if (price == null) return 'Опт';
    if (price < 5000) return 'Эконом';
    if (price < 25000) return 'Средний';
    return 'Опт';
  }

  /* Кэш каталога на вкладку: между переходами по страницам не дёргаем API заново.
     TTL намеренно короткий — правка в админке должна становиться видной быстро. */
  var CACHE_KEY = 'tvu_catalog_v1';
  function cacheRead() {
    try {
      var raw = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (!raw || !raw.ts) return null;
      var ttl = ((window.EVR_CONFIG && window.EVR_CONFIG.catalogTtlSec) || 60) * 1000;
      if (Date.now() - raw.ts > ttl) return null;
      return raw;
    } catch (e) { return null; }
  }
  function cacheWrite(payload) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch (e) {}
  }

  /* Дерево категорий → плоский индекс: slug → { name, parent }, порядок корней. */
  function indexTree(tree) {
    var idx = { bySlug: {}, roots: [], subsOf: {} };
    (tree || []).forEach(function (root) {
      idx.bySlug[root.slug] = { name: root.name, parent: '' };
      idx.roots.push(root.name);
      idx.subsOf[root.name] = (root.children || []).map(function (child) {
        idx.bySlug[child.slug] = { name: child.name, parent: root.name };
        return child.name;
      });
    });
    return idx;
  }

  function adapt(raw, idx, i) {
    var cat = '', sub = '';
    (raw.categories || []).forEach(function (slug) {
      var node = idx.bySlug[slug];
      if (!node || (cat && sub)) return;
      if (node.parent) { sub = node.name; cat = node.parent; }
      else if (!cat) { cat = node.name; }
    });
    var price = raw.price == null ? null : Number(raw.price);
    if (!(price > 0)) price = null;                 // 0 в каталоге = «Цена по запросу»
    var maker = raw.brand ? raw.brand.name : '';
    return {
      id: raw.slug,                                  // витрина адресует товар slug'ом
      slug: raw.slug,
      name: raw.name,
      category: cat,
      sub: sub,
      maker: maker,
      makerLabel: maker || sub || cat,
      brand: [maker, sub].filter(Boolean).join(' '), // строка для поиска
      price: price,
      inStock: !!raw.inStock,
      availableQty: raw.availableQty || 0,
      segment: segmentOf(price),
      _i: i
    };
  }

  function apply(payload) {
    var idx = indexTree(payload.tree);
    DATA.categories = idx.roots;
    DATA.subcategories = idx.subsOf;
    DATA.products = (payload.products || []).map(function (raw, i) { return adapt(raw, idx, i); });
    DATA.loaded = true;
    return DATA;
  }

  function loadCatalog() {
    var cached = cacheRead();
    if (cached) return Promise.resolve(apply(cached));
    return Promise.all([EVR_API.categories(), EVR_API.allProducts()]).then(function (res) {
      var payload = { tree: res[0], products: res[1], ts: Date.now() };
      cacheWrite(payload);
      return apply(payload);
    });
  }

  /* Единый вид ошибки загрузки: страница не должна молча показывать пустоту. */
  function dataError(el, err) {
    var host = typeof el === 'string' ? document.getElementById(el) : el;
    if (!host) return;
    var detail = err && err.message ? err.message : 'нет связи с сервером магазина';
    host.innerHTML = '<div class="empty" style="grid-column:1/-1">' + I.info +
      '<h3>Каталог временно недоступен</h3>' +
      '<p class="muted">' + esc(detail) + '</p>' +
      '<p><button class="btn btn--outline" onclick="location.reload()">Обновить страницу</button></p></div>';
  }

  /* ---------------- Хелперы ---------------- */
  var COMPANY = {
    legalName: 'ИП Бажуков Алексей Андреевич',
    legalShort: 'ИП Бажуков А.А.',      // краткая форма — только для боковой сводки на «Контактах»
    inn: '470306908187',
    ogrnip: '317470400079659',
    phone: '+7 (964) 390-71-39',
    phoneRaw: '+79643907139',
    email: 'ip-bazhukov@yandex.ru',
    hours: 'Пн–Пт 9:00–18:00',
    address: 'г. Москва, ул. Примерная, д. 1, оф. 10'
  };

  /* Контакты и реквизиты — из настроек магазина (GET /settings), значения выше
     остаются запасным вариантом, если магазин недоступен. Владелец правит их в
     админке, и правка доезжает до витрины без правки кода. */
  function applySettings(s) {
    if (!s) return;
    var c = s.contacts || {}, le = s.legalEntity || {}, b = s.branding || {};
    if (c.phone) {
      COMPANY.phone = c.phone;
      COMPANY.phoneRaw = '+' + String(c.phone).replace(/\D/g, '');
    } else if (b.supportPhone) {
      COMPANY.phone = b.supportPhone;
      COMPANY.phoneRaw = '+' + String(b.supportPhone).replace(/\D/g, '');
    }
    if (c.email || b.supportEmail) COMPANY.email = c.email || b.supportEmail;
    if (c.address) COMPANY.address = c.address;
    if (c.workingHours) COMPANY.hours = c.workingHours;
    if (le.name) COMPANY.legalName = le.name;
    if (le.inn) COMPANY.inn = le.inn;
    if (le.ogrn) COMPANY.ogrnip = le.ogrn;
  }

  /* Ссылки раздела «Покупателям» — используются и в шапке, и в подвале */
  var BUYER_LINKS = [
    { href: 'wholesale.html',     label: 'Оптовым покупателям' },
    { href: 'delivery.html',      label: 'Доставка и оплата' },
    { href: 'returns.html',       label: 'Возвраты' },
    { href: 'warranty.html',      label: 'Гарантии' },
    { href: 'manufacturers.html', label: 'Производители' },
    { href: 'about.html',         label: 'О компании' },
    { href: 'contacts.html',      label: 'Контакты' }
  ];
  function currentPage() {
    var p = location.pathname.split('/').pop();
    return p || 'index.html';
  }

  /* Рубли: целые — без копеек; дробные (стоимость доставки СДЭК приходит с
     копейками) — с двумя знаками и запятой, как принято в русской типографике. */
  function money(n) {
    var num = Number(n);
    if (!isFinite(num)) num = 0;
    var frac = Math.abs(num % 1) > 0.004 ? 2 : 0;
    return num.toLocaleString('ru-RU', {
      minimumFractionDigits: frac, maximumFractionDigits: frac
    }) + ' \u20bd';
  }
  function priceHtml(p, cls) {
    if (p.price == null) return '<span class="price-request">Цена по запросу</span>';
    return '<span class="' + (cls || 'card__price') + '">' + money(p.price) + '</span>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }

  /* ---------------- Корзина (localStorage) ---------------- */
  // v2: с переходом на Admik товар адресуется slug'ом, а не номером строки прайса —
  // старые корзины (evr_cart) несовместимы, поэтому ключ новый.
  var CART_KEY = 'tvu_cart_v2';
  function cartRead() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; } catch (e) { return {}; }
  }
  function cartWrite(c) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {}
    updateCartCount();
    document.dispatchEvent(new CustomEvent('cart:change'));
  }
  function cartCount() {
    var c = cartRead(), n = 0;
    for (var k in c) n += c[k];
    return n;
  }
  function cartAdd(id, qty) {
    var c = cartRead();
    c[id] = (c[id] || 0) + (qty || 1);
    if (c[id] < 1) delete c[id];
    cartWrite(c);
  }
  function cartSet(id, qty) {
    var c = cartRead();
    if (qty < 1) delete c[id]; else c[id] = qty;
    cartWrite(c);
  }
  function cartRemove(id) { var c = cartRead(); delete c[id]; cartWrite(c); }
  function cartClear() { cartWrite({}); }
  function cartItems() {
    var c = cartRead(), out = [];
    for (var id in c) {
      var p = DATA.products.find(function (x) { return String(x.id) === String(id); });
      if (p) out.push({ product: p, qty: c[id] });
    }
    return out;
  }
  function cartTotal() {
    return cartItems().reduce(function (s, it) { return s + (it.product.price || 0) * it.qty; }, 0);
  }
  function updateCartCount() {
    document.querySelectorAll('.cart-count').forEach(function (el) {
      var n = cartCount();
      el.textContent = n; el.setAttribute('data-count', n);
    });
  }

  /* ---------------- Toast ---------------- */
  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = I.check + '<span>' + msg + ' <a href="cart.html">Перейти в корзину →</a></span>';
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 3200);
  }

  /* ---------------- Карточка товара (разметка) ---------------- */
  function productCard(p) {
    var badges = '';
    if (p.segment === 'Опт') badges += '<span class="badge badge--opt">Опт</span>';
    if (p.price != null && p.price < 3000) badges += '<span class="badge badge--stock">В наличии</span>';
    // Кнопка одного формата в обеих карточках: с ценой — синяя «В корзину», без цены — «Запрос»
    var buyBtn = p.price != null
      ? '<button class="btn btn--primary card__add" data-add="' + esc(p.slug) + '">В корзину</button>'
      : '<a class="btn btn--outline card__add" href="product.html?slug=' + encodeURIComponent(p.slug) + '">Запрос</a>';
    return '' +
      '<article class="card">' +
        '<a class="card__media" href="product.html?slug=' + encodeURIComponent(p.slug) + '">' +
          (badges ? '<div class="card__badges">' + badges + '</div>' : '') +
          catIcon(p.category) +
        '</a>' +
        '<div class="card__body">' +
          '<div class="card__brand">' + esc(p.makerLabel) + '</div>' +
          '<a class="card__title" href="product.html?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.name) + '</a>' +
          '<div class="card__cat">' + esc(p.category) + '</div>' +
          '<div class="card__footer">' + priceHtml(p) + buyBtn + '</div>' +
        '</div>' +
      '</article>';
  }

  /* ---------------- Шапка / Футер ---------------- */
  function renderHeader() {
    var host = document.getElementById('site-header');
    if (!host) return;
    var page = currentPage();
    var navItems = [{ href: 'catalog.html', label: 'Каталог' }].concat(BUYER_LINKS);
    var nav = navItems.map(function (it) {
      var cls = (page === it.href) ? ' class="is-active"' : '';
      return '<li><a' + cls + ' href="' + it.href + '">' + esc(it.label) + '</a></li>';
    }).join('');
    host.innerHTML = '' +
      '<header class="header">' +
        '<div class="container header__top">' +
          '<a class="logo" href="index.html" aria-label="ТЕПЛОВОДОУЧЕТ — на главную">' +
            '<span class="logo__name"><span class="logo__dark">ТЕПЛО</span>ВОДОУЧЕТ</span></a>' +
          '<form class="search" action="catalog.html" method="get" role="search">' +
            '<input type="search" name="q" placeholder="Поиск: счётчик воды, ТВ7, расходомер…" value="' + esc(qs('q') || '') + '" aria-label="Поиск по каталогу">' +
            '<button type="submit" aria-label="Найти">' + I.search + '</button>' +
          '</form>' +
          '<div class="header__actions">' +
            '<div class="header__contact">' +
              '<div class="header__phone"><a href="tel:' + COMPANY.phoneRaw + '">' + COMPANY.phone + '</a></div>' +
              '<div class="header__hours">' + COMPANY.hours + '</div>' +
            '</div>' +
            '<a class="header__call" href="tel:' + COMPANY.phoneRaw + '" aria-label="Позвонить: ' + COMPANY.phone + '">' + I.phone + '</a>' +
            '<a class="cart-link" href="cart.html">' + I.cart + '<span>Корзина</span>' +
              '<span class="cart-count" data-count="0">0</span></a>' +
            // Бургер — последний в строке: панель меню выезжает с той же, правой стороны
            '<button class="burger" type="button" data-nav-toggle aria-expanded="false" aria-controls="mobile-nav" aria-label="Меню">' + I.menu + '</button>' +
          '</div>' +
        '</div>' +
        '<nav class="nav" aria-label="Основное меню"><div class="container"><ul class="nav__list">' + nav + '</ul></div></nav>' +
      '</header>' +
      renderMobileNav(page);
    updateCartCount();
  }

  /* Мобильное меню: категории каталога + разделы «Покупателям» + телефон.
     На десктопе панель скрыта (CSS), открывается кнопкой-бургером. */
  function renderMobileNav(page) {
    var counts = {};
    DATA.products.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
    var cats = DATA.categories.map(function (c) {
      return '<a href="catalog.html?cat=' + encodeURIComponent(c) + '">' + catIcon(c) +
        '<span>' + esc(c) + '</span><span class="mnav__cat-count">' + (counts[c] || 0) + '</span></a>';
    }).join('');
    var links = [{ href: 'catalog.html', label: 'Весь каталог' }].concat(BUYER_LINKS).map(function (it) {
      return '<a' + (page === it.href ? ' class="is-active"' : '') + ' href="' + it.href + '">' +
        esc(it.label) + '</a>';
    }).join('');
    return '' +
      '<div class="drawer-backdrop" data-nav-close></div>' +
      '<nav class="mnav" id="mobile-nav" aria-label="Мобильное меню" aria-hidden="true">' +
        '<div class="mnav__head">' +
          '<a class="logo" href="index.html">' +
            '<span class="logo__name"><span class="logo__dark">ТЕПЛО</span>ВОДОУЧЕТ</span></a>' +
          '<button class="mnav__close" type="button" data-nav-close aria-label="Закрыть меню">' + I.close + '</button>' +
        '</div>' +
        '<div class="mnav__section"><div class="mnav__title">Каталог</div>' + cats + '</div>' +
        '<div class="mnav__section"><div class="mnav__title">Покупателям</div>' + links + '</div>' +
        '<div class="mnav__foot">' +
          '<a class="mnav__phone" href="tel:' + COMPANY.phoneRaw + '">' + COMPANY.phone + '</a>' +
          '<div class="mnav__hours">' + COMPANY.hours + '</div>' +
        '</div>' +
      '</nav>';
  }

  /* ---------------- Выезжающие панели (меню, фильтры) ---------------- */
  function lockScroll(on) { document.body.classList.toggle('is-locked', !!on); }

  function setNav(open) {
    var nav = document.getElementById('mobile-nav');
    var back = document.querySelector('.drawer-backdrop');
    var btn = document.querySelector('[data-nav-toggle]');
    if (!nav) return;
    nav.classList.toggle('is-open', open);
    nav.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (back) back.classList.toggle('is-open', open);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    lockScroll(open || isFiltersOpen());
  }

  function isFiltersOpen() {
    var f = document.querySelector('.filters');
    return !!(f && f.classList.contains('is-open'));
  }

  function setFilters(open) {
    var f = document.querySelector('.filters');
    if (!f) return;
    f.classList.toggle('is-open', open);
    f.setAttribute('aria-hidden', open ? 'false' : 'true');
    lockScroll(open);
    if (open) f.scrollTop = 0;
  }

  function renderFooter() {
    var host = document.getElementById('site-footer');
    if (!host) return;
    var catLinks = DATA.categories.slice(0, 6).map(function (c) {
      return '<a href="catalog.html?cat=' + encodeURIComponent(c) + '">' + esc(c) + '</a>';
    }).join('') + '<a class="footer__all" href="catalog.html">Весь каталог →</a>';
    var buyerLinks = BUYER_LINKS.map(function (it) {
      return '<a href="' + it.href + '">' + esc(it.label) + '</a>';
    }).join('');
    host.innerHTML = '' +
      '<footer class="footer">' +
        '<div class="container footer__top">' +
          '<div class="footer__col footer__logo">' +
            '<a class="logo" href="index.html">' +
              '<span class="logo__name"><span class="logo__dark">ТЕПЛО</span>ВОДОУЧЕТ</span></a>' +
            '<p class="footer__about">Приборы учёта воды и тепловой энергии. Розница и опт. Доставка по всей России через СДЭК.</p>' +
          '</div>' +
          '<div class="footer__col"><h4>Каталог</h4>' + catLinks + '</div>' +
          '<div class="footer__col"><h4>Покупателям</h4>' + buyerLinks + '</div>' +
          '<div class="footer__col"><h4>Контакты</h4>' +
            '<div class="footer__contact">' +
              '<b>' + COMPANY.phone + '</b><br>' + COMPANY.email + '<br>' +
              COMPANY.hours + '<br>' + COMPANY.address +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="container footer__bottom">' +
          '<span>© 2026 Тепловодоучет. Все права защищены.</span>' +
          '<span>' + COMPANY.legalName + ' · ИНН ' + COMPANY.inn + ' · ОГРНИП ' + COMPANY.ogrnip + '</span>' +
        '</div>' +
      '</footer>';
  }

  /* ---------------- Преимущества ----------------
     Показываются только на главной; renderFeatures принимает и свой набор — на случай другой страницы. */
  function features() {
    return [
      [I.truck, 'Доставка СДЭК', 'По всей России, стоимость рассчитывается автоматически при оформлении'],
      [I.doc, 'Документы для юрлиц', 'Счёт, договор и автоматическая накладная к каждому заказу'],
      [I.shield, 'Поверенные приборы', 'Заводская гарантия, первичная поверка, паспорт на изделие'],
      [I.box, 'Широкий ассортимент', 'Тепловычислители, расходомеры, счётчики воды и комплектующие'],
      [I.bolt, 'Отгрузка в день оплаты', 'Товары в наличии передаём в доставку в день поступления оплаты'],
      [I.support, 'Бесплатный подбор', 'Поможем подобрать прибор под ваш объект и задачу — без доплат'],
      [I.credit, 'Отсрочка платежа', 'Организациям и оптовым покупателям отгружаем с отсрочкой по договору'],
      [I.calendar, 'Без выходных и обедов', 'Принимаем заказы и отвечаем на вопросы каждый день, без перерывов']
    ];
  }

  // list — необязательный свой набор [иконка, заголовок, подпись]; без него берутся общие преимущества
  function renderFeatures(el, list) {
    var host = typeof el === 'string' ? document.getElementById(el) : el;
    if (!host) return;
    host.innerHTML = (list || features()).map(function (f) {
      return '<div class="feature">' + f[0] + '<b>' + esc(f[1]) + '</b><span>' + esc(f[2]) + '</span></div>';
    }).join('');
  }

  /* ---------------- Глобальные обработчики ---------------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (btn) {
      e.preventDefault();
      cartAdd(btn.getAttribute('data-add'), 1);
      toast('Товар добавлен в корзину');
    }
    if (e.target.closest('[data-filters-toggle]')) setFilters(!isFiltersOpen());
    if (e.target.closest('[data-filters-close]')) setFilters(false);
    if (e.target.closest('[data-nav-toggle]')) setNav(!document.getElementById('mobile-nav').classList.contains('is-open'));
    if (e.target.closest('[data-nav-close]')) setNav(false);
  });

  // Esc закрывает открытую панель
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (isFiltersOpen()) setFilters(false);
    setNav(false);
  });

  // Возврат к десктопной раскладке (поворот экрана, ресайз) не должен оставлять
  // страницу заблокированной уже скрытой панелью.
  // MediaQueryList храним в EVR: без внешней ссылки объект вместе со слушателем
  // может быть собран сборщиком мусора, и событие перестанет приходить.
  var mqDesktop = window.matchMedia('(min-width: 861px)');
  function onBreakpoint(e) { if (e.matches) { setNav(false); setFilters(false); } }
  if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onBreakpoint);
  else if (mqDesktop.addListener) mqDesktop.addListener(onBreakpoint);   // Safari < 14

  /* ---------------- Экспорт ---------------- */
  window.EVR = {
    data: DATA, icons: I, company: COMPANY,
    money: money, priceHtml: priceHtml, esc: esc, qs: qs, catIcon: catIcon,
    productCard: productCard, toast: toast, renderFeatures: renderFeatures,
    // Управление мобильными панелями (снимает и блокировку прокрутки страницы)
    ui: {
      closeFilters: function () { setFilters(false); },
      openFilters: function () { setFilters(true); },
      closeNav: function () { setNav(false); },
      mqDesktop: mqDesktop        // ссылка, удерживающая слушатель точки перелома
    },
    cart: {
      read: cartRead, add: cartAdd, set: cartSet, remove: cartRemove,
      clear: cartClear, items: cartItems, total: cartTotal, count: cartCount,
      // Позиции в форме API: [{ slug, qty }] — их превращает в productId клиент API.
      lines: function () {
        var c = cartRead(), out = [];
        for (var slug in c) out.push({ slug: slug, qty: c[slug] });
        return out;
      }
    },
    dataError: dataError,
    // Промис готовности каталога: страницы, которым нужны товары, стартуют по нему.
    ready: null,
    // Промис готовности настроек магазина (контакты, реквизиты): его ждут
    // страницы «О компании» и «Контакты».
    settingsReady: null,
    settings: null
  };

  /* ---------------- Инициализация ----------------
     Шапка/подвал рисуются сразу (им данные каталога не нужны), каталог грузится
     параллельно; страницы ждут EVR.ready. */
  function init() { renderHeader(); renderFooter(); updateCartCount(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.EVR.ready = loadCatalog().then(function () {
    updateCartCount();
    return DATA;
  });

  // Настройки магазина: приехали — перерисовываем шапку и подвал с реальными
  // контактами. Не приехали — витрина продолжает работать на значениях выше.
  window.EVR.settingsReady = EVR_API.settings().then(function (s) {
    applySettings(s);
    window.EVR.settings = s;
    renderHeader();
    renderFooter();
    updateCartCount();
    return s;
  }).catch(function () { return null; });
})();
