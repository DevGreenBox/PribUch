# Витрина «Тепловодоучет» — статический многостраничный сайт (HTML/CSS/JS).
# Данные она берёт из Storefront API платформы Admik, своей серверной части нет.
#
# ВАЖНО (docs/20 платформы, раздел «Правило раздачи статики»): у каждого маршрута
# свой .html, а состояние живёт в query-строке (?cat=, ?slug=, ?token=). Поэтому
# SPA-fallback ОТКЛЮЧЁН: несуществующий путь отдаёт 404.html, а не подменяет собой
# index.html, и query-строка не теряется.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY css /usr/share/nginx/html/css
COPY js  /usr/share/nginx/html/js
COPY *.html /usr/share/nginx/html/

# Контейнер слушает 3000 — как ожидает docker-compose платформы.
EXPOSE 3000
