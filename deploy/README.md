# Развёртывание «Тепловодоучет» на VPS

Стенд поднят на **<VPS_IP>** (Ubuntu 24.04, 2 CPU / 3.9 ГБ RAM) в **режиме по IP**:
домена ещё нет, поэтому Caddy и HTTPS не поднимаются.

| Что | Адрес |
|---|---|
| Витрина | http://<VPS_IP>/ |
| Админка | http://<VPS_IP>:8080/admin/login |
| Storefront API | http://<VPS_IP>:8080/api/storefront/v1/* |
| Медиа (MinIO) | http://<VPS_IP>:9100/admik-media |

Код на сервере — `/root/pribuch` (`Uni_BD/`, `storefront/`, `tools/`).
Секреты — только в `/root/pribuch/Uni_BD/.env` (в git его нет).

## Как это собрано

```bash
# 1. Подготовка сервера (docker, swap, ufw) — один раз
bash Uni_BD/scripts/server-bootstrap.sh
ufw allow 8080/tcp && ufw allow 9100/tcp     # порты режима стенда

# 2. Конфигурация инстанса
#    .env под IP-режим + оверрайд компоуза
cp deploy/docker-compose.vps.yml Uni_BD/docker-compose.override.yml

# 3. Стек — ЯВНЫМ списком сервисов (иначе поднимутся caddy/cron/backup)
cd Uni_BD && docker compose up -d app storefront

# 4. Инициализация БД: миграции + права + владелец (пароль печатается ОДИН раз)
docker compose exec -T app /app/scripts/init-shop.sh

# 5. Каталог и настройки магазина
docker compose exec -T -e PGPASSWORD=<MIGRATOR_PASSWORD> postgres \
  psql -h 127.0.0.1 -U admik_migrator -d admik -v ON_ERROR_STOP=1 -f - < ../tools/catalog-tvu.sql
docker compose exec -T -e PGPASSWORD=<MIGRATOR_PASSWORD> postgres \
  psql -h 127.0.0.1 -U admik_migrator -d admik -v ON_ERROR_STOP=1 -f - < ../tools/shop-settings.sql
docker compose restart app     # прямая правка БД не сбрасывает кэш настроек
```

## Выкатка изменений витрины

Витрина запечена в образ (nginx + статика), bind-mount'а нет:

```bash
# с рабочей машины
tar czf storefront.tgz -C PribUch storefront
scp storefront.tgz root@<VPS_IP>:/root/
ssh root@<VPS_IP> 'cd /root/pribuch && tar xzf /root/storefront.tgz && \
  cd Uni_BD && docker compose build storefront && docker compose up -d storefront'
```

После выкатки проверять с обходом кэша браузера (hard-reload или `?nocache=<ts>`).

## СДЭК — боевой контур

Ключи договора владельца лежат в `/root/pribuch/Uni_BD/.env` (`CDEK_ACCOUNT`/`CDEK_SECRET`,
`CDEK_BASE_URL=https://api.cdek.ru`, `CDEK_TEST_MODE=false`). Живьём работают подсказки
городов, справочник ПВЗ и расчёт стоимости/срока.

**Точка отгрузки — свой ПВЗ СДЭК VSL16** (Всеволожск, пр-т Всеволожский, 56). Задаётся
ДВУМЯ переменными, и они обязаны указывать на одно место:

| Переменная | Значение | Куда идёт |
|---|---|---|
| `CDEK_SHIPMENT_POINT` | `VSL16` | создание отправления (взаимоисключимо с `from_location`) |
| `CDEK_FROM_LOCATION_CODE` | `980` (Всеволожск) | калькулятор тарифа — у него параметра `shipment_point` НЕТ |

Если поменять только одну, расчёт для покупателя разойдётся с фактической отгрузкой.

- **`CDEK_CREATE_ENABLED=false`** — авто-создание отправлений выключено намеренно: ключи
  боевые, и тестовый заказ иначе превратился бы в настоящую отправку. Включать вместе с
  cron-контейнером (`CDEK_CRON_SECRET` + `docker compose up -d cron`) на боевом запуске.
- **Webhook статусов не настроен.** В боевом режиме пустой `CDEK_WEBHOOK_IPS` означает, что
  вебхуки отклоняются. Пока статусы подтягивает `cron refresh-active` (когда включат cron).
- **Проверка ключей без магазина:**
  `curl -X POST 'https://api.cdek.ru/v2/oauth/token?parameters' -d grant_type=client_credentials
  -d client_id=… -d client_secret=…` → 200 и `access_token`.
- **Вес товаров в каталоге не заполнен** — расчёт идёт по `CDEK_DEFAULT_WEIGHT_G` (1500 г на
  позицию). Проставить реальные вес/габариты в карточках товаров.

## Грабли, на которые уже наступили

- **`pnpm-workspace.yaml` ломает сборку app.** Локальный pnpm 11 создаёт этот файл без поля
  `packages`, `COPY . .` тащит его в образ, и `pnpm build` падает с
  `ERROR packages field missing or empty`. Файла не должно быть в контексте сборки.
- **Порт 9000 занимать нельзя** — базовый compose уже держит `127.0.0.1:9000` под MinIO, а
  списки `ports` в оверрайде складываются: конфликт роняет весь `up`. Медиа наружу — на 9100.
- **`STOREFRONT_ALLOWED_ORIGINS` включает строгую проверку:** запросы без заголовка `Origin`
  получают 401. Это норма (витрина статическая, браузер Origin всегда шлёт), но curl-проверки
  надо делать с `-H "Origin: http://<VPS_IP>"`.
- **Стек поднимать списком сервисов.** `docker compose up -d` без аргументов потянет
  caddy/cron/backup, которых в режиме стенда быть не должно.

## Переезд на домен (когда купят)

1. Три A-записи: `<домен>`, `www.<домен>`, `admin.<домен>` → <VPS_IP>.
2. В `.env`: `SHOP_DOMAIN`/`ADMIN_DOMAIN` на домен, `NEXT_PUBLIC_ADMIK_API_URL` и
   `STOREFRONT_ALLOWED_ORIGINS` — на `https://…`, `S3_PUBLIC_URL=https://admin.<домен>/media/admik-media`.
3. Удалить `docker-compose.override.yml` (публикацию 80/8080/9100) и поднять `caddy` —
   TLS он получит сам. Витрина сама начнёт бить в `https://admin.<домен>` (см. `js/config.js`).
4. Снять `STOREFRONT_NOINDEX=1`, когда магазин можно индексировать.
