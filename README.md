# Поле чудес

Веб-игра в стиле «Поле чудес»: барабан на Canvas, табло с переворачивающимися буквами, бот, локальный мультиплеер, режим ведущего, темы оформления.

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173 — игра, /wheel — песочница барабана
npm test         # тесты правил игры
npm run build && npm start   # продакшен-сервер (Express) на $PORT или 3001
```

## Деплой на Railway

Railway → New Project → Deploy from GitHub repo. Сборка и запуск описаны в `railway.json`
(`npm run build` → `npm start`, healthcheck `/api/health`).

## Структура

- `src/types/game.ts` — все типы (барабан, секторы, вопросы, темы, игроки, состояние партии)
- `src/utils/gameLogic.ts` — чистая логика партии `(state, action) → state`, покрыта тестами
- `src/utils/wheelMath.ts` — углы, взвешенный выбор сектора, кривая замедления
- `src/utils/bot.ts` — бот трёх уровней
- `src/components/game/` — WheelCanvas, WordBoard, Keyboard, PlayerCard, GameSetup, GameScreen
- `src/data/` — пресеты барабанов и тем, демо-вопросы
- `server/` — Express-сервер, схема БД (Prisma + SQLite)

## Дорожная карта

1. ✅ Типы и схема БД
2. ✅ Движок барабана
3. ✅ Табло и логика игры
4. ⬜ Админ-панель + API + SQLite + загрузка медиа
5. ⬜ Редактор тем
