# Judo Shop API

Учебный backend маркетплейса товаров для дзюдо (REST API) со страницей каталога.
Оплата реализована как заглушка, реальные платежи не принимаются.
Бренды и характеристики использованы для демонстрации.

## Стек
Node.js, Express, PostgreSQL (Neon), JWT, zod, helmet, express-rate-limit

## Возможности
- Регистрация и вход (access 15 минут + refresh 7 дней с ротацией), роли: buyer, seller, admin
- Каталог: поиск, фильтры (цена, категория, бренд, наличие), сортировка, пагинация
- Размеры товара с отдельными остатками
- Корзина и заказ в одной транзакции со списанием остатков
- Mock-оплата, откат при сбое, отмена заказа с возвратом остатков
- Кабинет продавца (только свои товары), модерация товаров админом
- Валидация входных данных (zod), лимит запросов, единый формат ошибок
- Тест на гонку: 10 одновременных заказов на последний товар, успешен один

## Запуск
1. npm install
2. Создай файл .env:
   DATABASE_URL=строка подключения PostgreSQL
   JWT_SECRET=длинная случайная строка (40+ символов)
3. node index.js (сервер на http://localhost:3000)
4. Тест гонки: node race-test.js

## Примеры
Регистрация:
curl -X POST localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"123456"}'

Каталог:
curl "localhost:3000/products?q=mizuno&sort=price_asc&page=1&limit=10"

Корзина и заказ (нужен токен):
curl -X POST localhost:3000/cart/items -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"variant_id":2,"quantity":1}'
curl -X POST localhost:3000/orders -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{}'

## Эндпоинты
- POST /auth/register, /auth/login, /auth/refresh, /auth/logout
- GET /products, /products/:id, /categories
- GET/POST /cart, POST /cart/items, PATCH/DELETE /cart/items/:variantId
- POST /orders, GET /orders, GET /orders/:id, POST /orders/:id/cancel
- PATCH /orders/:id/status (admin)
- GET/POST/PUT/DELETE /seller/products, PATCH /seller/variants/:id (seller)
- GET /admin/products/pending, PATCH /admin/products/:id/approve (admin)

## Ограничения
Учебный проект: заказы не выполняются, оплата не принимается.
