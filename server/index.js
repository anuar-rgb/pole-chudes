// Продакшен-сервер: раздаёт собранный фронтенд (dist/) и API.
// API, загрузка медиа и SQLite добавляются на этапе 4.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 3001;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

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

// SPA: все остальные GET-маршруты (/admin, /wheel…) отдают index.html
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(port, () => console.log(`Поле чудес: http://localhost:${port}`));
