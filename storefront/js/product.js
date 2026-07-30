/* Тепловодоучет — карточка товара (PDP).
   Данные — из Storefront API: список каталога даёт категорию/производителя,
   GET /products/:slug — артикул, описание, характеристики, фото и остаток. */
(function () {
  'use strict';
  var esc = EVR.esc, I = EVR.icons;
  var slug = (EVR.qs('slug') || EVR.qs('id') || '').trim();
  var root = document.getElementById('pdp-root');

  function notFound() {
    document.getElementById('crumbs').innerHTML =
      '<a href="index.html">Главная</a><span class="sep">/</span><a href="catalog.html">Каталог</a>';
    root.innerHTML = '<div class="empty">' + I.empty + '<h2>Товар не найден</h2>' +
      '<p class="muted">Возможно, он снят с продажи или ссылка неверна.</p>' +
      '<p><a class="btn btn--primary" href="catalog.html">В каталог</a></p></div>';
  }

  var detailReq = slug
    ? EVR_API.product(slug).catch(function (err) {
        if (err && err.status === 404) return null;   // нет такого товара — не ошибка сети
        throw err;
      })
    : Promise.resolve(null);

  Promise.all([EVR.ready, detailReq])
    .then(function (res) { render(res[1]); })
    .catch(function (err) { EVR.dataError(root, err); });

  function render(d) {
    if (!d) { notFound(); return; }

    // Категория/подкатегория/производитель — из общего каталога витрины.
    var p = EVR.data.products.find(function (x) { return x.slug === d.slug; }) || {
      category: '', sub: '', maker: d.brand ? d.brand.name : '', makerLabel: d.brand ? d.brand.name : '',
      segment: '', price: null
    };
    var price = d.price == null ? null : Number(d.price);
    if (!(price > 0)) price = null;                    // 0 = «Цена по запросу»
    var maxQty = Math.max(0, d.availableQty || 0);

    document.title = d.name + ' — Тепловодоучет';
    document.getElementById('crumbs').innerHTML =
      '<a href="index.html">Главная</a><span class="sep">/</span>' +
      '<a href="catalog.html">Каталог</a><span class="sep">/</span>' +
      (p.category
        ? '<a href="catalog.html?cat=' + encodeURIComponent(p.category) + '">' + esc(p.category) + '</a>' +
          '<span class="sep">/</span>'
        : '') +
      '<span>' + esc(d.name) + '</span>';

    var badges = '';
    badges += '<span class="badge badge--' + (d.inStock ? 'stock' : 'opt') + '">' +
      (d.inStock ? 'В наличии' : 'Под заказ') + '</span>';
    if (p.category) badges += '<span class="badge badge--new">' + esc(p.category) + '</span>';

    // Характеристики: свои поля витрины + характеристики, заведённые в админке.
    var specs = [
      ['Категория', p.category],
      ['Подкатегория', p.sub],
      ['Производитель', p.maker],
      ['Модель / наименование', d.name],
      ['Артикул', d.sku],
      ['Наличие', d.inStock ? 'В наличии' + (maxQty ? ' (' + maxQty + ' шт)' : '') : 'Под заказ / по запросу']
    ];
    Object.keys(d.attributes || {}).forEach(function (k) {
      specs.push([k, Array.isArray(d.attributes[k]) ? d.attributes[k].join(', ') : d.attributes[k]]);
    });
    var specsHtml = specs.filter(function (s) { return s[1]; }).map(function (s) {
      return '<tr><td>' + esc(s[0]) + '</td><td>' + esc(s[1]) + '</td></tr>';
    }).join('');

    var buyBlock;
    if (price != null) {
      buyBlock =
        '<div class="pdp__buy">' +
          '<div class="pdp__price">' + EVR.money(price) + ' <small>/ шт</small></div>' +
          (maxQty && maxQty <= 5 ? '<div class="summary__note">Осталось ' + maxQty + ' шт</div>' : '') +
          '<div class="pdp__buy-row">' +
            '<div class="qty">' +
              '<button type="button" data-q="-1" aria-label="Меньше">−</button>' +
              '<input type="text" id="qty" value="1" inputmode="numeric" aria-label="Количество">' +
              '<button type="button" data-q="1" aria-label="Больше">+</button>' +
            '</div>' +
            '<button class="btn btn--primary btn--lg" id="add-btn"' + (maxQty ? '' : ' disabled') + '>' +
              I.cart + (maxQty ? ' В корзину' : ' Нет в наличии') + '</button>' +
          '</div>' +
          '<div class="summary__note" style="margin-top:12px">Стоимость доставки СДЭК рассчитывается при оформлении заказа.</div>' +
        '</div>';
    } else {
      buyBlock =
        '<div class="pdp__buy">' +
          '<div class="pdp__price" style="font-size:var(--fs-xl)">Цена по запросу</div>' +
          '<p class="muted" style="margin-bottom:16px">Уточните актуальную цену и наличие — ответим в рабочее время.</p>' +
          '<a class="btn btn--primary btn--lg" href="contacts.html">Запросить цену</a>' +
        '</div>';
    }

    var primary = (d.media || []).filter(function (m) { return m.isPrimary; })[0] || (d.media || [])[0];
    var mediaHtml = primary
      ? '<img src="' + esc(primary.url) + '" alt="' + esc(primary.alt || d.name) + '" loading="lazy">'
      : EVR.catIcon(p.category);

    var descHtml = (d.description || '').trim()
      ? d.description                                   // HTML из админки (санитизирован платформой)
      : '<p class="muted" style="max-width:720px">' + esc(d.name) + ' — прибор' +
        (p.category ? ' из категории «' + esc(p.category) + '»' : '') +
        (p.maker ? ' производства ' + esc(p.maker) : '') + '. Подробное техническое описание и паспорт ' +
        'изделия предоставляются по запросу. Оборудование поставляется с заводской гарантией и ' +
        'первичной поверкой.</p>';

    root.innerHTML =
      '<div class="pdp">' +
        '<div class="pdp__media">' + mediaHtml + '</div>' +
        '<div>' +
          '<div class="pdp__brand">' + esc(p.makerLabel || '') + '</div>' +
          '<h1>' + esc(d.name) + '</h1>' +
          '<div class="pdp__meta">' + badges + '</div>' +
          buyBlock +
          '<div class="pdp__features">' +
            '<div class="pdp__feature">' + I.truck + '<span>Доставка СДЭК по всей России, расчёт стоимости при оформлении</span></div>' +
            '<div class="pdp__feature">' + I.doc + '<span>Полный пакет документов и накладная для юрлиц</span></div>' +
            '<div class="pdp__feature">' + I.shield + '<span>Заводская гарантия и первичная поверка</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tabs">' +
        '<div class="tabs__nav">' +
          '<button class="is-active" data-tab="specs">Характеристики</button>' +
          '<button data-tab="desc">Описание</button>' +
          '<button data-tab="delivery">Доставка и оплата</button>' +
        '</div>' +
        '<div class="tabs__panel" data-panel="specs"><table class="specs">' + specsHtml + '</table></div>' +
        '<div class="tabs__panel hidden" data-panel="desc">' + descHtml + '</div>' +
        '<div class="tabs__panel hidden" data-panel="delivery">' +
          '<p class="muted" style="max-width:720px">Доставка осуществляется службой СДЭК по всей России. ' +
          'Точная стоимость и срок рассчитываются при оформлении заказа по вашему адресу. ' +
          'Оплата — онлайн картой или по счёту для юридических лиц.</p>' +
        '</div>' +
      '</div>';

    // Количество
    var qtyInput = document.getElementById('qty');
    if (qtyInput) {
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-q]');
        if (!b) return;
        var v = (parseInt(qtyInput.value, 10) || 1) + (+b.getAttribute('data-q'));
        qtyInput.value = Math.min(maxQty || 1, Math.max(1, v));
      });
      qtyInput.addEventListener('input', function () {
        qtyInput.value = qtyInput.value.replace(/\D/g, '') || '1';
      });
      var addBtn = document.getElementById('add-btn');
      if (addBtn && maxQty) {
        addBtn.addEventListener('click', function () {
          var qty = Math.min(maxQty, Math.max(1, parseInt(qtyInput.value, 10) || 1));
          EVR.cart.add(d.slug, qty);
          EVR.toast('Товар добавлен в корзину');
        });
      }
    }

    // Табы
    document.querySelector('.tabs__nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      document.querySelectorAll('.tabs__nav button').forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
      var t = b.getAttribute('data-tab');
      document.querySelectorAll('[data-panel]').forEach(function (x) {
        x.classList.toggle('hidden', x.getAttribute('data-panel') !== t);
      });
    });

    // Похожие — из того же раздела каталога
    var related = EVR.data.products.filter(function (x) {
      return x.category === p.category && x.slug !== d.slug;
    }).slice(0, 4);
    if (related.length) {
      document.getElementById('related-section').style.display = '';
      document.getElementById('related').innerHTML = related.map(EVR.productCard).join('');
    }
  }
})();
