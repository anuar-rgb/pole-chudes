import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, seedIfEmpty, UPLOADS_DIR } from './db';
import { api } from './api';
import { authMode } from './auth';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 3001;

seedIfEmpty();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway стоит за прокси — нужен настоящий IP для лимита входа

app.use('/api', api);

// Загрузки: имена файлов уникальны → кэшируем надолго.
// CSP+sandbox: SVG, открытый напрямую, не сможет выполнить скрипт на нашем домене.
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    maxAge: '365d',
    immutable: true,
    setHeaders(res) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }),
);
// Отсутствующий файл — честный 404, а не index.html из SPA-фолбэка
app.use('/uploads', (_req, res) => res.status(404).end());

if (fs.existsSync(dist)) {
  // Хэшированные ассеты Vite кэшируем навсегда, index.html — никогда
  app.use(
    express.static(dist, {
      index: false,
      setHeaders(res, file) {
        if (file.includes(`${path.sep}assets${path.sep}`) && /-[\w-]{8}\.\w+$/.test(file)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  // SPA: остальные GET-маршруты (/admin, /wheel…) отдают index.html
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Поле чудес: http://localhost:${port}`);
  console.log(`Данные: ${DATA_DIR}`);
  if (authMode === 'open') console.log('Админка открыта без пароля (локальный режим). Задайте ADMIN_PASSWORD для защиты.');
  if (authMode === 'locked') console.warn('ВНИМАНИЕ: ADMIN_PASSWORD не задан — редактирование через админку отключено.');
});
