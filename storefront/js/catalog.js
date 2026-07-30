/* Тепловодоучет — логика каталога: фильтры, поиск, сортировка, пагинация */
(function () {
  'use strict';

  /* Данные каталога приезжают из Storefront API (см. js/site.js) — стартуем,
     когда они загружены; при обрыве связи показываем понятную ошибку. */
  EVR.ready.then(start).catch(function (err) { EVR.dataError('grid', err); });

  function start() {
  var D = EVR.data, esc = EVR.esc;
  var PER_PAGE = 24;

  var state = {
    categories: [],           // выбранная категория (не больше одной)
    sub: '',                  // выбранная подкатегория
    makers: [],               // выбранные производители
    min: null, max: null,
    inStock: false,           // только товары с ценой
    onOrder: false,           // только товары без цены («под заказ»)
    q: (EVR.qs('q') || '').trim(),
    sort: 'pop',
    page: 1
  };

  var initialCat = EVR.qs('cat');
  if (initialCat && D.categories.indexOf(initialCat) !== -1) state.categories = [initialCat];

  var initialSub = EVR.qs('sub');
  if (initialSub && state.categories.length &&
      (D.subcategories[state.categories[0]] || []).indexOf(initialSub) !== -1) state.sub = initialSub;

  // Раскрытой может быть только одна категория — выбранная
  state.openCat = state.categories.length ? state.categories[0] : '';

  var initialMaker = EVR.qs('maker');
  if (initialMaker) state.makers = [initialMaker];

  var grid = document.getElementById('grid');
  var countEl = document.getElementById('count');
  var pagEl = document.getElementById('pagination');
  var applyCountEl = document.getElementById('f-apply-count');
  var activeCountEl = document.getElementById('f-active-count');

  /* Сколько фильтров активно — цифра на кнопке «Фильтры» (мобильная панель закрыта,
     иначе выбранные условия не видны) */
  function activeFilters() {
    return (state.categories.length ? 1 : 0) + (state.sub ? 1 : 0) + state.makers.length +
      (state.min != null ? 1 : 0) + (state.max != null ? 1 : 0) +
      (state.inStock ? 1 : 0) + (state.onOrder ? 1 : 0);
  }

  /* ---------- Заголовок и крошки ---------- */
  function setHead() {
    var cat = state.categories.length === 1 ? state.categories[0] : '';
    var title = state.q ? 'Поиск: «' + state.q + '»' : (state.sub || cat || 'Каталог');
    document.getElementById('page-title').textContent = title;
    document.title = (state.q ? 'Поиск' : title) + ' — Тепловодоучет';

    var crumbs = '<a href="index.html">Главная</a><span class="sep">/</span>';
    if (state.q) {
      crumbs += '<a href="catalog.html">Каталог</a><span class="sep">/</span><span>Поиск</span>';
    } else if (cat) {
      crumbs += '<a href="catalog.html">Каталог</a><span class="sep">/</span>';
      if (state.sub) {
        crumbs += '<a href="catalog.html?cat=' + encodeURIComponent(cat) + '">' + esc(cat) + '</a>' +
                  '<span class="sep">/</span><span>' + esc(state.sub) + '</span>';
      } else {
        crumbs += '<span>' + esc(cat) + '</span>';
      }
    } else {
      crumbs += '<span>Каталог</span>';
    }
    document.getElementById('crumbs').innerHTML = crumbs;
  }

  /* ---------- Построение фильтров ---------- */
  function makerName(p) { return p.maker || ''; }

  var CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function buildFilters() {
    // Категории — одиночный выбор; подкатегории вложены и раскрываются стрелкой
    var catCounts = {}, subCounts = {};
    D.products.forEach(function (p) {
      catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      if (p.sub) subCounts[p.category + '|' + p.sub] = (subCounts[p.category + '|' + p.sub] || 0) + 1;
    });
    var items = [['', 'Все товары', D.products.length]].concat(D.categories.map(function (c) {
      return [c, c, catCounts[c] || 0];
    }));
    var current = state.categories.length === 1 ? state.categories[0] : '';

    document.getElementById('f-category').innerHTML = items.map(function (it) {
      var cat = it[0];
      var subs = cat ? (D.subcategories[cat] || []) : [];
      var open = subs.length && cat === state.openCat;
      var html = '<div class="cat-row">' +
        '<button type="button" class="cat-filter' + (cat === current && !state.sub ? ' is-active' : '') + '"' +
          ' data-cat="' + esc(cat) + '"><span>' + esc(it[1]) + '</span>' +
          '<span class="count">' + it[2] + '</span></button>' +
        (subs.length
          ? '<button type="button" class="cat-toggle' + (open ? ' is-open' : '') + '"' +
            ' data-toggle-cat="' + esc(cat) + '" aria-expanded="' + (open ? 'true' : 'false') + '"' +
            ' aria-label="Подкатегории: ' + esc(cat) + '">' + CHEVRON + '</button>'
          : '') +
        '</div>';
      if (subs.length) {
        html += '<div class="cat-subs"' + (open ? '' : ' hidden') + '>' + subs.map(function (s) {
          return '<button type="button" class="cat-filter cat-filter--sub' +
            (cat === current && s === state.sub ? ' is-active' : '') +
            '" data-sub="' + esc(s) + '" data-owner="' + esc(cat) + '">' +
            '<span>' + esc(s) + '</span>' +
            '<span class="count">' + (subCounts[cat + '|' + s] || 0) + '</span></button>';
        }).join('') + '</div>';
      }
      return html;
    }).join('');

    // Производители (топ по количеству). Товары без производителя в список не попадают —
    // у них в исходной таблице в этой колонке стоит подкатегория.
    var makerCounts = {};
    D.products.forEach(function (p) { var m = makerName(p); if (m) makerCounts[m] = (makerCounts[m] || 0) + 1; });
    var makers = Object.keys(makerCounts).sort(function (a, b) { return makerCounts[b] - makerCounts[a]; });
    document.getElementById('f-maker').innerHTML = makers.map(function (m) {
      var on = state.makers.indexOf(m) !== -1 ? ' checked' : '';
      return '<label class="check"><input type="checkbox" data-f="maker" value="' + esc(m) + '"' + on + '>' +
        '<span>' + esc(m) + '</span><span class="count">' + makerCounts[m] + '</span></label>';
    }).join('');
  }

  /* ---------- Фильтрация ---------- */
  function match(p) {
    if (state.categories.length && state.categories.indexOf(p.category) === -1) return false;
    if (state.sub && p.sub !== state.sub) return false;
    if (state.makers.length && state.makers.indexOf(makerName(p)) === -1) return false;
    if (state.inStock && p.price == null) return false;
    if (state.onOrder && p.price != null) return false;
    if (state.min != null && (p.price == null || p.price < state.min)) return false;
    if (state.max != null && (p.price == null || p.price > state.max)) return false;
    if (state.q) {
      var hay = (p.name + ' ' + p.brand + ' ' + p.category).toLowerCase();
      var terms = state.q.toLowerCase().split(/\s+/);
      for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  function sortList(list) {
    var s = state.sort;
    var arr = list.slice();
    if (s === 'price-asc') arr.sort(function (a, b) { return (a.price == null) - (b.price == null) || a.price - b.price; });
    else if (s === 'price-desc') arr.sort(function (a, b) { return (a.price == null) - (b.price == null) || b.price - a.price; });
    else if (s === 'name') arr.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    else arr.sort(function (a, b) { return (a.price == null) - (b.price == null) || a._i - b._i; });
    return arr;
  }

  /* ---------- Рендер ---------- */
  function render() {
    var filtered = sortList(D.products.filter(match));
    var total = filtered.length;
    var pages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (state.page > pages) state.page = 1;
    var start = (state.page - 1) * PER_PAGE;
    var pageItems = filtered.slice(start, start + PER_PAGE);

    countEl.textContent = total ? ('Найдено: ' + total + ' ' + plural(total, ['товар', 'товара', 'товаров'])) : '';
    applyCountEl.textContent = total
      ? (total + ' ' + plural(total, ['товар', 'товара', 'товаров']))
      : 'результаты';
    var active = activeFilters();
    activeCountEl.textContent = active ? active : '';

    if (!total) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' + EVR.icons.empty +
        '<h3>Ничего не найдено</h3><p class="muted">Попробуйте изменить фильтры или запрос.</p></div>';
      pagEl.innerHTML = '';
      return;
    }
    grid.innerHTML = pageItems.map(EVR.productCard).join('');

    // Пагинация
    if (pages > 1) {
      var html = '<button ' + (state.page === 1 ? 'disabled' : '') + ' data-page="' + (state.page - 1) + '">←</button>';
      for (var i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || Math.abs(i - state.page) <= 1) {
          html += '<button class="' + (i === state.page ? 'is-active' : '') + '" data-page="' + i + '">' + i + '</button>';
        } else if (i === state.page - 2 || i === state.page + 2) {
          html += '<button disabled>…</button>';
        }
      }
      html += '<button ' + (state.page === pages ? 'disabled' : '') + ' data-page="' + (state.page + 1) + '">→</button>';
      pagEl.innerHTML = html;
    } else pagEl.innerHTML = '';
  }

  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  /* ---------- События ---------- */
  document.addEventListener('change', function (e) {
    var f = e.target.getAttribute && e.target.getAttribute('data-f');
    if (f === 'maker') toggle(state.makers, e.target.value, e.target.checked);
    else return;
    state.page = 1; setHead(); render();
  });

  // Категория — выбирается только одна (или «Все товары»); её список подкатегорий раскрывается
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-cat]');
    if (!b) return;
    var cat = b.getAttribute('data-cat');
    state.categories = cat ? [cat] : [];
    state.sub = '';                       // подкатегории у каждой категории свои
    state.openCat = cat;                  // предыдущая категория при этом закрывается
    state.page = 1;
    afterFilterChange();
  });

  // Стрелка — раскрыть/свернуть список, не меняя выбранную категорию
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-toggle-cat]');
    if (!b) return;
    var cat = b.getAttribute('data-toggle-cat');
    state.openCat = state.openCat === cat ? '' : cat;
    buildFilters();
  });

  // Подкатегория — тоже одиночный выбор
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sub]');
    if (!b) return;
    var owner = b.getAttribute('data-owner');
    state.categories = [owner];           // подкатегория всегда выбирается вместе со своей категорией
    state.openCat = owner;
    state.sub = b.getAttribute('data-sub');
    state.page = 1;
    afterFilterChange();
  });

  // Мобильная панель фильтров остаётся открытой: пользователь может выбрать
  // ещё производителя или цену, а число найденных видно на кнопке «Показать».
  function afterFilterChange() {
    syncUrl();
    buildFilters(); setHead(); render();
  }

  function syncUrl() {
    var url = new URL(location.href);
    if (state.categories.length) url.searchParams.set('cat', state.categories[0]);
    else url.searchParams.delete('cat');
    if (state.sub) url.searchParams.set('sub', state.sub); else url.searchParams.delete('sub');
    history.replaceState(null, '', url);
  }
  function toggle(arr, val, on) {
    var i = arr.indexOf(val);
    if (on && i === -1) arr.push(val);
    if (!on && i !== -1) arr.splice(i, 1);
  }

  var minEl = document.getElementById('f-min'), maxEl = document.getElementById('f-max');
  function priceChange() {
    state.min = minEl.value ? +minEl.value : null;
    state.max = maxEl.value ? +maxEl.value : null;
    state.page = 1; render();
  }
  minEl.addEventListener('input', debounce(priceChange, 350));
  maxEl.addEventListener('input', debounce(priceChange, 350));

  // «Только с ценой» и «Под заказ» исключают друг друга — вместе они не дали бы ни одного товара
  var inStockEl = document.getElementById('f-instock');
  var onOrderEl = document.getElementById('f-onorder');
  inStockEl.addEventListener('change', function (e) {
    state.inStock = e.target.checked;
    if (state.inStock) { state.onOrder = false; onOrderEl.checked = false; }
    state.page = 1; render();
  });
  onOrderEl.addEventListener('change', function (e) {
    state.onOrder = e.target.checked;
    if (state.onOrder) { state.inStock = false; inStockEl.checked = false; }
    state.page = 1; render();
  });
  document.getElementById('sort').addEventListener('change', function (e) {
    state.sort = e.target.value; render();
  });
  document.getElementById('f-reset').addEventListener('click', function () {
    state.categories = []; state.sub = ''; state.openCat = ''; state.makers = []; state.min = state.max = null;
    state.inStock = false; state.onOrder = false; state.q = ''; state.page = 1;
    minEl.value = ''; maxEl.value = '';
    inStockEl.checked = false; onOrderEl.checked = false;
    var url = new URL(location.href); url.searchParams.delete('q');
    history.replaceState(null, '', url);
    syncUrl();
    buildFilters(); setHead(); render();
  });
  pagEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    state.page = +b.getAttribute('data-page');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
  });

  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /* ---------- Старт ---------- */
  buildFilters(); setHead(); render();
  }
})();
