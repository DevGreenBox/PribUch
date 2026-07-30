/* Тепловодоучет — конфигурация витрины.
   Витрина не хранит данные: каталог, корзину-расчёт, заказы, доставку и оплату
   считает платформа Admik. Здесь задаётся ТОЛЬКО адрес её публичного API.

   Как выбирается адрес (в порядке приоритета):
     1) ?api=<url> в адресной строке — разовое переопределение для отладки
        (запоминается в localStorage, сбрасывается через ?api=reset);
     2) API_BASE ниже, если он задан явно (боевой стенд по IP, свой порт и т.п.);
     3) авто: localhost → http://localhost:3100 (локальный стенд),
        иначе admin.<домен-витрины> (схема двух доменов, docs/09 платформы).
*/
(function () {
  'use strict';

  // Явный адрес Admik. Пусто → авто-определение (см. ниже).
  var API_BASE = '';

  var STORE_KEY = 'tvu_api_base';

  function fromQuery() {
    var v = new URLSearchParams(location.search).get('api');
    if (!v) return null;
    if (v === 'reset') { try { localStorage.removeItem(STORE_KEY); } catch (e) {} return null; }
    try { localStorage.setItem(STORE_KEY, v); } catch (e) {}
    return v;
  }
  function fromStore() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function auto() {
    var h = location.hostname;
    // Разработка: витрина с локального http-сервера, Admik — на :3100.
    if (!h || h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3100';
    // Стенд по IP (домена ещё нет): витрина на :80, Admik — на :8080 того же хоста.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return location.protocol + '//' + h + ':8080';
    // Боевая схема двух доменов: витрина на apex/www, Admik — на поддомене admin.
    return location.protocol + '//admin.' + h.replace(/^www\./, '');
  }

  var base = fromQuery() || API_BASE || fromStore() || auto();

  window.EVR_CONFIG = {
    apiBase: String(base).replace(/\/+$/, ''),
    apiPath: '/api/storefront/v1',
    // Сколько секунд держать каталог в sessionStorage между переходами по
    // страницам. Маленькое значение: правка в админке должна быть видна быстро.
    catalogTtlSec: 60
  };
})();
