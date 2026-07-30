/* Тепловодоучет — оформление заказа (гость).
   Боевой путь через платформу Admik:
     POST /cart/quote                  — итоги, скидка, стоимость и срок доставки;
     GET  /delivery/cdek/cities|pvz    — город и пункт выдачи СДЭК;
     POST /orders                      — создание заказа (Idempotency-Key);
     POST /payments/tbank/init         — оплата картой → редирект на страницу оплаты.
   Витрина НЕ считает суммы и НЕ шлёт их на сервер — только выбор покупателя. */
(function () {
  'use strict';
  var esc = EVR.esc, I = EVR.icons;
  var root = document.getElementById('checkout-root');

  var state = {
    items: [],            // позиции корзины (товар + количество)
    apiItems: null,       // они же в форме API ([{productId, qty}])
    quote: null,          // последний ответ /cart/quote
    delivery: { type: 'pvz', city: '', cityCode: null, address: '', pvzCode: '', pvzName: '' },
    promo: '',
    busy: false
  };

  EVR.ready.then(start).catch(function (err) { EVR.dataError(root, err); });

  function start() {
    state.items = EVR.cart.items();
    if (!state.items.length) {
      root.innerHTML = '<div class="empty">' + I.cart.replace('viewBox', 'width="56" height="56" viewBox') +
        '<h2>Корзина пуста</h2>' +
        '<p class="muted">Добавьте товары, прежде чем оформлять заказ.</p>' +
        '<p><a class="btn btn--primary" href="catalog.html">В каталог</a></p></div>';
      return;
    }
    renderForm();
    // Позиции для API резолвим один раз (slug → productId), дальше переиспользуем.
    EVR_API.toApiItems(EVR.cart.lines()).then(function (items) {
      state.apiItems = items;
      refreshQuote();
    }).catch(function (err) {
      note('Не удалось связаться с магазином: ' + (err.message || 'нет связи'), true);
    });
  }

  /* ---------------- Разметка ---------------- */

  function renderForm() {
    var localTotal = EVR.cart.total();
    root.innerHTML =
      '<form id="checkout-form" novalidate><div class="cart-layout">' +
        '<div>' +
          '<div class="card-block">' +
            '<h3>Тип покупателя</h3>' +
            '<div class="radio-row">' +
              '<label class="radio-card"><input type="radio" name="buyer" value="person" checked>' +
                '<span><b>Физическое лицо</b><span>Розничная покупка</span></span></label>' +
              '<label class="radio-card"><input type="radio" name="buyer" value="company">' +
                '<span><b>Юридическое лицо / опт</b><span>Счёт и договор, накладная</span></span></label>' +
            '</div>' +
          '</div>' +

          '<div class="card-block">' +
            '<h3>Контактные данные</h3>' +
            '<div class="form-grid">' +
              '<div class="field"><label>Имя <span class="req">*</span></label><input name="name" required></div>' +
              '<div class="field"><label>Телефон <span class="req">*</span></label><input name="phone" required placeholder="+7 ___ ___-__-__"></div>' +
              '<div class="field field--full"><label>E-mail <span class="req">*</span></label>' +
                '<input type="email" name="email" required placeholder="you@example.ru">' +
                '<span class="hint">На него придёт подтверждение заказа и ссылка на его статус</span></div>' +
            '</div>' +
          '</div>' +

          '<div class="card-block hidden" id="company-block">' +
            '<h3>Реквизиты организации</h3>' +
            '<div class="form-grid">' +
              '<div class="field field--full"><label>Название организации</label><input name="company"></div>' +
              '<div class="field"><label>ИНН</label><input name="inn" inputmode="numeric"></div>' +
              '<div class="field"><label>КПП</label><input name="kpp" inputmode="numeric"></div>' +
            '</div>' +
            '<div class="summary__note">Реквизиты передаются менеджеру вместе с заказом — по ним выставляется счёт.</div>' +
          '</div>' +

          '<div class="card-block">' +
            '<h3>Доставка</h3>' +
            '<div class="radio-row">' +
              '<label class="radio-card"><input type="radio" name="dtype" value="pvz" checked>' +
                '<span><b>Пункт выдачи СДЭК</b><span>Забрать самому, дешевле</span></span></label>' +
              '<label class="radio-card"><input type="radio" name="dtype" value="courier">' +
                '<span><b>Курьером до двери</b><span>СДЭК по адресу</span></span></label>' +
              '<label class="radio-card"><input type="radio" name="dtype" value="pickup">' +
                '<span><b>Самовывоз</b><span>Со склада, бесплатно</span></span></label>' +
            '</div>' +
            '<div class="form-grid" id="delivery-fields" style="margin-top:14px">' +
              '<div class="field field--full" data-need="city"><label>Город <span class="req">*</span></label>' +
                '<input name="city" autocomplete="off" placeholder="Начните вводить: Москва">' +
                '<span class="hint" id="city-hint">Выберите город из подсказок СДЭК</span>' +
                '<div id="city-list" class="hidden"></div></div>' +
              '<div class="field field--full hidden" data-need="pvz"><label>Пункт выдачи <span class="req">*</span></label>' +
                '<select name="pvz"><option value="">— сначала выберите город —</option></select></div>' +
              '<div class="field field--full hidden" data-need="address"><label>Адрес доставки <span class="req">*</span></label>' +
                '<input name="address" placeholder="улица, дом, квартира"></div>' +
            '</div>' +
          '</div>' +

          '<div class="card-block">' +
            '<h3>Промокод</h3>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
              '<input name="promo" placeholder="Если есть" style="max-width:240px">' +
              '<button type="button" class="btn btn--outline" id="promo-apply">Применить</button>' +
              '<span id="promo-result" class="muted"></span>' +
            '</div>' +
          '</div>' +

          '<div class="card-block">' +
            '<h3>Оплата</h3>' +
            '<div class="radio-row">' +
              '<label class="radio-card"><input type="radio" name="pay" value="card" checked>' +
                '<span><b>Онлайн картой</b><span>Переход на защищённую страницу оплаты</span></span></label>' +
              '<label class="radio-card"><input type="radio" name="pay" value="invoice">' +
                '<span><b>По счёту</b><span>Для юрлиц, безнал</span></span></label>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<aside class="summary">' +
          '<h3>Ваш заказ</h3>' +
          '<div id="summary-items"></div>' +
          '<div class="summary__row"><span>Товары, ' + state.items.length + ' поз.</span><b id="sum-items">' + EVR.money(localTotal) + '</b></div>' +
          '<div class="summary__row hidden" id="row-discount"><span>Скидка</span><b id="sum-discount"></b></div>' +
          '<div class="summary__row"><span>Доставка</span><span id="sum-delivery" class="muted">укажите город</span></div>' +
          '<div class="summary__row summary__row--total"><span>Итого</span><span id="sum-total">' + EVR.money(localTotal) + '</span></div>' +
          '<button type="submit" class="btn btn--primary btn--lg btn--block" style="margin-top:12px" id="submit-btn">Подтвердить заказ</button>' +
          '<div class="summary__note" id="note">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</div>' +
        '</aside>' +
      '</div></form>';

    document.getElementById('summary-items').innerHTML = state.items.map(function (it) {
      var sum = it.product.price != null ? EVR.money(it.product.price * it.qty) : 'по запросу';
      return '<div class="summary__row"><span>' + esc(it.product.name) + ' × ' + it.qty +
        '</span><span class="nowrap">' + sum + '</span></div>';
    }).join('') + '<div style="border-top:1px solid var(--color-border);margin:8px 0"></div>';

    bind();
    applyDeliveryType('pvz');
  }

  function note(text, danger) {
    var el = document.getElementById('note');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('text-danger', !!danger);
  }

  /* ---------------- Итоги: считает сервер ---------------- */

  function deliveryPayload() {
    var d = state.delivery;
    if (d.type === 'pickup') return { type: 'pickup' };
    var out = { type: d.type };
    if (d.city) out.city = d.city;
    if (d.cityCode) out.cityCode = d.cityCode;
    if (d.type === 'pvz' && d.pvzCode) out.pvzCode = d.pvzCode;
    if (d.type === 'courier' && d.address) out.address = d.address;
    return out;
  }

  /** Готова ли выбранная доставка к серверному расчёту стоимости. */
  function deliveryReady() {
    var d = state.delivery;
    if (d.type === 'pickup') return true;
    if (!d.city) return false;
    if (d.type === 'pvz') return !!d.pvzCode;
    return true;                                   // курьер: адрес нужен только при создании заказа
  }

  /* Срок доставки в /cart/quote не приходит (там деньги), поэтому спрашиваем его
     отдельно у расчёта СДЭК. Стоимость при этом ОСТАЁТСЯ из quote — там учтены
     скидки и порог бесплатной доставки. Нужен числовой код города из подсказок. */
  function showEta(el, costText) {
    var d = state.delivery;
    if (d.type === 'pickup' || !d.cityCode || !state.apiItems) return;
    EVR_API.cdekCalculate({
      to: { city_code: d.cityCode },
      deliveryMode: d.type === 'courier' ? 'door' : 'pvz',
      items: state.apiItems
    }).then(function (calc) {
      if (!calc || !calc.etaDays) return;
      var days = calc.periodMin && calc.periodMax && calc.periodMin !== calc.periodMax
        ? calc.periodMin + '–' + calc.periodMax
        : calc.etaDays;
      el.textContent = costText + ' · ' + days + ' дн.';
    }).catch(function () { /* срок не критичен: стоимость уже показана */ });
  }

  function refreshQuote() {
    if (!state.apiItems) return Promise.resolve(null);
    var body = { items: state.apiItems };
    if (state.promo) body.promoCode = state.promo;
    if (deliveryReady()) body.delivery = deliveryPayload();

    return EVR_API.quote(body).then(function (q) {
      state.quote = q;
      document.getElementById('sum-items').textContent = EVR.money(Number(q.itemsTotal));
      document.getElementById('sum-total').textContent = EVR.money(Number(q.grandTotal));

      var disc = Number(q.discountTotal || 0);
      document.getElementById('row-discount').classList.toggle('hidden', !(disc > 0));
      if (disc > 0) document.getElementById('sum-discount').textContent = '−' + EVR.money(disc);

      var dEl = document.getElementById('sum-delivery');
      if (body.delivery) {
        var cost = Number(q.deliveryTotal || 0);
        dEl.textContent = cost > 0 ? EVR.money(cost) : 'бесплатно';
        dEl.classList.remove('muted');
        showEta(dEl, dEl.textContent);
      } else {
        dEl.textContent = state.delivery.type === 'pvz' ? 'выберите город и ПВЗ' : 'укажите город';
        dEl.classList.add('muted');
      }

      var pr = document.getElementById('promo-result');
      if (state.promo && pr) {
        var ok = q.promo && q.promo.valid;
        pr.textContent = ok ? 'Промокод применён' : 'Промокод не действует';
        pr.classList.toggle('text-danger', !ok);
      }

      if (q.issues && q.issues.length) {
        note(q.issues.map(function (i) { return i.message || i.code; }).join('; '), true);
      }
      return q;
    }).catch(function (err) {
      note('Не удалось пересчитать заказ: ' + (err.message || 'нет связи'), true);
      return null;
    });
  }

  /* ---------------- Доставка: город и ПВЗ СДЭК ---------------- */

  function applyDeliveryType(type) {
    state.delivery.type = type;
    document.querySelectorAll('#delivery-fields [data-need]').forEach(function (f) {
      var need = f.getAttribute('data-need');
      var show = (need === 'city' && type !== 'pickup') ||
                 (need === 'pvz' && type === 'pvz') ||
                 (need === 'address' && type === 'courier');
      f.classList.toggle('hidden', !show);
    });
    refreshQuote();
  }

  function loadPvz() {
    var sel = root.querySelector('select[name="pvz"]');
    if (!sel) return;
    if (!state.delivery.cityCode) {
      sel.innerHTML = '<option value="">— выберите город из подсказок —</option>';
      return;
    }
    sel.innerHTML = '<option value="">Загружаем пункты выдачи…</option>';
    EVR_API.cdekPvz(state.delivery.cityCode).then(function (list) {
      if (!list || !list.length) {
        sel.innerHTML = '<option value="">В этом городе нет пунктов выдачи</option>';
        return;
      }
      sel.innerHTML = '<option value="">— выберите пункт —</option>' + list.map(function (p) {
        return '<option value="' + esc(p.code) + '">' + esc(p.address || p.name) + '</option>';
      }).join('');
    }).catch(function () {
      sel.innerHTML = '<option value="">Не удалось загрузить пункты выдачи</option>';
    });
  }

  function suggestCities(q) {
    var box = document.getElementById('city-list');
    if (!box) return;
    if (q.length < 2) { box.classList.add('hidden'); return; }
    EVR_API.cdekCities(q).then(function (list) {
      if (!list || !list.length) {
        box.classList.add('hidden');
        document.getElementById('city-hint').textContent =
          'Города нет в подсказках — можно оставить название как есть, менеджер уточнит доставку.';
        return;
      }
      box.innerHTML = list.map(function (c) {
        return '<button type="button" class="btn btn--ghost btn--block" data-city="' + esc(c.code) + '" ' +
          'data-city-name="' + esc(c.name) + '" style="justify-content:flex-start">' +
          esc(c.name) + (c.region ? ' <span class="muted">· ' + esc(c.region) + '</span>' : '') + '</button>';
      }).join('');
      box.classList.remove('hidden');
    }).catch(function () { box.classList.add('hidden'); });
  }

  /* ---------------- События ---------------- */

  function bind() {
    var form = document.getElementById('checkout-form');

    root.addEventListener('change', function (e) {
      if (e.target.name === 'buyer') {
        var isCompany = e.target.value === 'company';
        document.getElementById('company-block').classList.toggle('hidden', !isCompany);
        if (isCompany) root.querySelector('input[name="pay"][value="invoice"]').checked = true;
      }
      if (e.target.name === 'dtype') applyDeliveryType(e.target.value);
      if (e.target.name === 'pvz') {
        var opt = e.target.options[e.target.selectedIndex];
        state.delivery.pvzCode = e.target.value;
        state.delivery.pvzName = opt ? opt.textContent : '';
        refreshQuote();
      }
      if (e.target.name === 'address') {
        state.delivery.address = e.target.value.trim();
      }
    });

    var cityInput = form.querySelector('input[name="city"]');
    var t;
    cityInput.addEventListener('input', function () {
      state.delivery.city = cityInput.value.trim();
      state.delivery.cityCode = null;
      state.delivery.pvzCode = '';
      clearTimeout(t);
      t = setTimeout(function () { suggestCities(state.delivery.city); }, 300);
    });

    document.getElementById('city-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-city]');
      if (!b) return;
      state.delivery.cityCode = Number(b.getAttribute('data-city'));
      state.delivery.city = b.getAttribute('data-city-name');
      cityInput.value = state.delivery.city;
      this.classList.add('hidden');
      document.getElementById('city-hint').textContent = 'Город выбран из справочника СДЭК';
      loadPvz();
      refreshQuote();
    });

    document.getElementById('promo-apply').addEventListener('click', function () {
      state.promo = (form.querySelector('input[name="promo"]').value || '').trim();
      refreshQuote();
    });

    form.addEventListener('submit', submit);
  }

  /* ---------------- Создание заказа ---------------- */

  function invalidField(form) {
    var bad = null;
    form.querySelectorAll('[required]').forEach(function (f) {
      if (!f.value.trim()) { f.style.borderColor = 'var(--color-danger)'; if (!bad) bad = f; }
      else f.style.borderColor = '';
    });
    var d = state.delivery;
    if (!bad && d.type !== 'pickup' && !d.city) bad = form.querySelector('input[name="city"]');
    if (!bad && d.type === 'pvz' && !d.pvzCode) bad = form.querySelector('select[name="pvz"]');
    if (!bad && d.type === 'courier' && !(form.querySelector('input[name="address"]').value || '').trim()) {
      bad = form.querySelector('input[name="address"]');
    }
    return bad;
  }

  function submit(e) {
    e.preventDefault();
    if (state.busy) return;
    var form = e.target;

    var bad = invalidField(form);
    if (bad) {
      bad.focus();
      bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      note('Заполните обязательные поля заказа.', true);
      return;
    }
    if (!state.apiItems) { note('Позиции ещё не подтверждены магазином, подождите пару секунд.', true); return; }

    state.delivery.address = (form.querySelector('input[name="address"]').value || '').trim();

    // Реквизиты юрлица отдельных полей в заказе не имеют — уходят в комментарий,
    // менеджер видит их в админке вместе с заказом.
    var comment = '';
    if (form.buyer.value === 'company') {
      comment = ['Юридическое лицо',
        form.company.value.trim() ? 'Организация: ' + form.company.value.trim() : '',
        form.inn.value.trim() ? 'ИНН: ' + form.inn.value.trim() : '',
        form.kpp.value.trim() ? 'КПП: ' + form.kpp.value.trim() : ''
      ].filter(Boolean).join('; ');
    }
    if (state.delivery.type === 'pvz' && state.delivery.pvzName) {
      comment += (comment ? '. ' : '') + 'ПВЗ: ' + state.delivery.pvzName;
    }

    var payMethod = form.pay.value === 'invoice' ? 'invoice' : 'card';
    var body = {
      items: state.apiItems,
      customer: {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim()
      },
      delivery: deliveryPayload(),
      paymentMethod: payMethod
    };
    if (state.promo) body.promoCode = state.promo;
    if (comment) body.comment = comment;
    if (state.delivery.type === 'courier') body.delivery.address = state.delivery.address;

    state.busy = true;
    var btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Оформляем заказ…';
    note('Отправляем заказ в магазин…');

    EVR_API.createOrder(body, EVR_API.idempotencyKey()).then(function (order) {
      try {
        localStorage.setItem('tvu_last_order', JSON.stringify({
          number: order.number, token: order.accessToken, at: Date.now()
        }));
      } catch (err) {}
      EVR.cart.clear();

      if (payMethod !== 'card') { location.href = 'order-success.html'; return; }

      // Оплата картой: инициируем платёж и уходим на страницу оплаты.
      var back = location.href.replace(/checkout\.html.*$/, 'order-success.html');
      return EVR_API.payInit({
        orderNumber: order.number, accessToken: order.accessToken, returnUrl: back
      }).then(function (pay) {
        location.href = pay && pay.paymentUrl ? pay.paymentUrl : 'order-success.html';
      }).catch(function () {
        location.href = 'order-success.html';   // заказ создан, оплату повторим со страницы заказа
      });
    }).catch(function (err) {
      state.busy = false;
      btn.disabled = false;
      btn.textContent = 'Подтвердить заказ';
      var msg = err && err.status === 409
        ? 'Часть позиций разобрали, пока вы оформляли заказ — обновите корзину.'
        : (err && err.message ? err.message : 'не удалось создать заказ');
      note('Заказ не оформлен: ' + msg, true);
    });
  }
})();
