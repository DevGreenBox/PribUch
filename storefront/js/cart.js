/* Тепловодоучет — страница корзины.
   Позиции хранятся в браузере (slug + количество), а ИТОГИ считает сервер:
   POST /cart/quote — единственный источник истины по ценам, скидкам и наличию
   (anti-tamper, ADR-010 платформы). Локальная сумма показывается только как
   предварительная, пока не ответил сервер. */
(function () {
  'use strict';
  var esc = EVR.esc, I = EVR.icons;
  var root = document.getElementById('cart-root');

  EVR.ready.then(render).catch(function (err) { EVR.dataError(root, err); });

  function empty() {
    root.innerHTML = '<div class="empty">' + I.cart.replace('viewBox', 'width="56" height="56" viewBox') +
      '<h2>Корзина пуста</h2>' +
      '<p class="muted">Добавьте приборы из каталога, чтобы оформить заказ.</p>' +
      '<p><a class="btn btn--primary btn--lg" href="catalog.html">Перейти в каталог</a></p></div>';
  }

  function render() {
    var items = EVR.cart.items();
    if (!items.length) { empty(); return; }

    var rows = items.map(function (it) {
      var p = it.product;
      var link = 'product.html?slug=' + encodeURIComponent(p.slug);
      var priceCell = p.price != null ? EVR.money(p.price) : '<span class="muted">по запросу</span>';
      var sumCell = p.price != null ? EVR.money(p.price * it.qty) : '—';
      return '<div class="cart-item" data-id="' + esc(p.slug) + '">' +
        '<a class="cart-item__media" href="' + link + '">' + EVR.catIcon(p.category) + '</a>' +
        '<div class="cart-item__info">' +
          '<div class="cart-item__brand">' + esc(p.makerLabel) + '</div>' +
          '<a class="cart-item__title" href="' + link + '">' + esc(p.name) + '</a>' +
          '<div class="cart-item__price cart-item__unit">' + priceCell + ' / шт</div>' +
          (p.availableQty && it.qty > p.availableQty
            ? '<div class="summary__note">В наличии только ' + p.availableQty + ' шт</div>' : '') +
        '</div>' +
        '<div class="qty">' +
          '<button type="button" data-q="-1" aria-label="Меньше">−</button>' +
          '<input type="text" value="' + it.qty + '" data-qty inputmode="numeric" aria-label="Количество">' +
          '<button type="button" data-q="1" aria-label="Больше">+</button>' +
        '</div>' +
        '<div class="cart-item__price cart-item__sum">' + sumCell + '</div>' +
        '<button class="cart-item__remove" data-remove title="Удалить" aria-label="Удалить из корзины">' + I.trash + '</button>' +
      '</div>';
    }).join('');

    var local = EVR.cart.total();

    root.innerHTML =
      '<div class="cart-layout">' +
        '<div class="cart-items">' + rows +
          '<div style="margin-top:8px"><button class="btn btn--ghost" id="clear">Очистить корзину</button></div>' +
        '</div>' +
        '<aside class="summary">' +
          '<h3>Итого</h3>' +
          '<div class="summary__row"><span>Товары, ' + items.length + ' поз.</span><b id="sum-items">' + EVR.money(local) + '</b></div>' +
          '<div class="summary__row hidden" id="row-discount"><span>Скидка</span><b id="sum-discount"></b></div>' +
          '<div class="summary__row"><span>Доставка СДЭК</span><span class="muted">рассчитается при оформлении</span></div>' +
          '<div class="summary__row summary__row--total"><span>К оплате</span><span id="sum-total">' + EVR.money(local) + '</span></div>' +
          '<div class="summary__note" id="quote-note">Проверяем цены и наличие…</div>' +
          '<a class="btn btn--primary btn--lg btn--block" href="checkout.html" style="margin-top:12px">Оформить заказ</a>' +
          '<a class="btn btn--outline btn--block" href="catalog.html" style="margin-top:10px">Продолжить покупки</a>' +
        '</aside>' +
      '</div>';

    refreshQuote();
  }

  /* Пересчёт на сервере: цены/скидки/наличие берутся из каталога, не из браузера. */
  function refreshQuote() {
    var lines = EVR.cart.lines();
    var note = document.getElementById('quote-note');
    if (!lines.length || !note) return;

    EVR_API.toApiItems(lines)
      .then(function (items) { return EVR_API.quote({ items: items }); })
      .then(function (q) {
        document.getElementById('sum-items').textContent = EVR.money(Number(q.itemsTotal));
        document.getElementById('sum-total').textContent = EVR.money(Number(q.grandTotal));
        var disc = Number(q.discountTotal || 0);
        if (disc > 0) {
          document.getElementById('row-discount').classList.remove('hidden');
          document.getElementById('sum-discount').textContent = '−' + EVR.money(disc);
        }
        if (q.issues && q.issues.length) {
          note.innerHTML = q.issues.map(function (i) {
            return esc(i.message || i.code || 'позиция недоступна');
          }).join('<br>');
          note.classList.add('text-danger');
        } else {
          note.textContent = 'Цены и наличие подтверждены магазином.';
        }
      })
      .catch(function (err) {
        note.textContent = 'Не удалось сверить цены с магазином (' +
          (err && err.message ? err.message : 'нет связи') + '). Сумма показана предварительно.';
      });
  }

  root.addEventListener('click', function (e) {
    var item = e.target.closest('.cart-item');
    if (e.target.closest('#clear')) { EVR.cart.clear(); render(); return; }
    if (!item) return;
    var id = item.getAttribute('data-id');
    if (e.target.closest('[data-remove]')) { EVR.cart.remove(id); render(); return; }
    var q = e.target.closest('[data-q]');
    if (q) {
      var input = item.querySelector('[data-qty]');
      var v = Math.max(1, (parseInt(input.value, 10) || 1) + (+q.getAttribute('data-q')));
      EVR.cart.set(id, v); render();
    }
  });
  root.addEventListener('change', function (e) {
    if (!e.target.matches('[data-qty]')) return;
    var item = e.target.closest('.cart-item');
    var v = Math.max(1, parseInt(e.target.value, 10) || 1);
    EVR.cart.set(item.getAttribute('data-id'), v); render();
  });
})();
