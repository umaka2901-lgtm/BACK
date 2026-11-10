# Judo Shop API

Учебный backend маркетплейса товаров для дзюдо (REST API).
Оплата реализована как заглушка, реальные платежи не принимаются.
Бренды и характеристики использованы для демонстрации.

## Стек
Node.js, Express, PostgreSQL (Neon), JWT

## Возможности
- Регистрация и вход (access + refresh токены), роли: buyer, seller, admin
- Каталог: поиск, фильтры по цене, категории, бренду, пагинация
- Размеры товара с отдельными остатками
- Корзина и заказ в одной транзакции со списанием остатков
- Mock-оплата, откат при сбое, отмена заказа с возвратом остатков
- Кабинет продавца, модерация товаров админом
- Тест на гонку: 10 одновременных заказов на последний товар, успешен один

## Запуск
1. npm install
2. Создай файл .env:
   DATABASE_URL=строка подключения PostgreSQL
   JWT_SECRET=длинная случайная строка
3. node index.js
4. Тест гонки: node race-test.js

## Основные эндпоинты
- POST /auth/register, /auth/login, /auth/refresh, /auth/logout
- GET /products, /products/:id, /categories
- GET/POST /cart, PATCH/DELETE /cart/items/:variantId
- POST /orders, GET /orders, POST /orders/:id/cancel
- /seller/products (продавец), /admin/products/pending (админ)
