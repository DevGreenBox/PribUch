/**
 * Живой прогон пути покупателя с доставкой СДЭК (Playwright).
 *
 * Запуск (playwright ставится отдельно, в репозитории его нет):
 *   npm i playwright && npx playwright install chromium-headless-shell
 *   SITE=http://<VPS_IP> node e2e-cdek.mjs
 *   SITE=http://localhost:8899 node e2e-cdek.mjs        # локальная витрина
 *
 * Проверяет: каталог → корзина → чекаут с ЖИВЫМ СДЭК (подсказки города,
 * список ПВЗ, стоимость и срок) → создание заказа → страница статуса.
 * Создаёт тестовый заказ на @example.com — после прогона его надо удалить
 * (см. deploy/README.md, раздел про чистку тестовых данных).
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE || 'http://<VPS_IP>';
const CITY = process.env.CITY || 'Санкт';
const fails = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(SITE + '/catalog.html', { waitUntil: 'networkidle' });
await page.waitForSelector('#grid .card', { timeout: 20000 });
await page.locator('#grid .card__add').first().click();
await page.waitForTimeout(500);

await page.goto(SITE + '/checkout.html', { waitUntil: 'networkidle' });
await page.waitForSelector('#checkout-form', { timeout: 20000 });
await page.fill('input[name="name"]', 'Проверка СДЭК');
await page.fill('input[name="phone"]', '+79001234567');
await page.fill('input[name="email"]', 'cdek-check@example.com');

await page.fill('input[name="city"]', CITY);
await page.waitForSelector('#city-list [data-city]', { timeout: 20000 });
const suggestions = await page.locator('#city-list [data-city]').count();
const firstCity = (await page.locator('#city-list [data-city]').first().textContent()).trim();
console.log(`подсказки города «${CITY}»: ${suggestions} → «${firstCity}»`);
if (!suggestions) fails.push('автокомплит города пуст');
await page.locator('#city-list [data-city]').first().click();

await page.waitForFunction(() => {
  const s = document.querySelector('select[name="pvz"]');
  return s && s.options.length > 1;
}, { timeout: 30000 });
const pvzCount = await page.locator('select[name="pvz"] option').count();
const pvzText = (await page.locator('select[name="pvz"] option').nth(1).textContent()).trim();
console.log(`ПВЗ в городе: ${pvzCount - 1} → «${pvzText.slice(0, 60)}»`);
if (pvzCount < 2) fails.push('список ПВЗ пуст');
await page.selectOption('select[name="pvz"]', { index: 1 });

await page.waitForFunction(() => {
  const el = document.getElementById('sum-delivery');
  return el && /₽|бесплатно/.test(el.textContent);
}, { timeout: 30000 });
await page.waitForTimeout(2500);
const deliv = (await page.locator('#sum-delivery').textContent()).trim();
const total = (await page.locator('#sum-total').textContent()).trim();
console.log(`доставка: ${deliv} · итого: ${total}`);
if (!/дн\./.test(deliv)) fails.push('срок доставки не показан: ' + deliv);

await page.locator('input[name="pay"][value="invoice"]').check();
await page.locator('#submit-btn').click();
await page.waitForURL(/order-success/, { timeout: 30000 }).catch(() => {});
if (!/order-success/.test(page.url())) {
  fails.push('заказ не создан: ' + (await page.locator('#note').textContent()));
} else {
  await page.waitForSelector('h1', { timeout: 20000 });
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const at = body.indexOf('Заказ оформлен');
  console.log('заказ: ' + body.slice(at, at + 200));
}

console.log('JS-ошибки:', errors.length ? errors.join(' | ') : 'нет');
if (errors.length) fails.push('JS-ошибки');
await browser.close();
console.log('\n' + (fails.length ? '❌ ' + fails.join('\n- ') : '✅ ВСЁ ЗЕЛЁНОЕ'));
process.exit(fails.length ? 1 : 0);
