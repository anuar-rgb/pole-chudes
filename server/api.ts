import express, { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import type { Asset, AssetKind } from '@/types/game';
import { RU_ALPHABET } from '@/utils/gameLogic';
import { assets, categories, db, newId, questions, themes, UPLOADS_DIR, wheels } from './db';
import { authMode, isAuthorized, login, requireAdmin } from './auth';
import { HttpError, parseCategory, parseQuestion, parseTheme, parseWheel } from './validate';

export const api = Router();
// Парсер внутри роутера — тогда ошибки битого JSON попадают в обработчик ниже
api.use(express.json({ limit: '1mb' }));

type Handler = (req: Request, res: Response) => unknown;
/** Express 4 не ловит ошибки async-обработчиков — оборачиваем */
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  try {
    Promise.resolve(fn(req, res)).catch(next);
  } catch (e) {
    next(e);
  }
};

const notFound = (what: string): never => {
  throw new HttpError(404, `${what} не найден(а)`);
};

/* ------------------------------------------------------------------ служебное */

api.get('/health', (_req, res) => res.json({ ok: true }));
api.post('/admin/login', login);
api.get('/admin/me', (req, res) => res.json({ mode: authMode, authorized: isAuthorized(req) }));

/** Всё, что нужно игре, одним запросом */
api.get(
  '/bootstrap',
  h((_req, res) => {
    res.json({ wheels: wheels.list(), themes: themes.list(), categories: categories.list(), questions: questions.list() });
  }),
);

/* ------------------------------------------------------------------ барабаны */

api.get('/wheels', h((_req, res) => res.json(wheels.list())));
api.post('/wheels', requireAdmin, h((req, res) => res.status(201).json(wheels.save(parseWheel(req.body, newId('wheel'))))));
api.put(
  '/wheels/:id',
  requireAdmin,
  h((req, res) => {
    if (!wheels.get(req.params.id)) notFound('Барабан');
    res.json(wheels.save(parseWheel(req.body, req.params.id)));
  }),
);
api.delete(
  '/wheels/:id',
  requireAdmin,
  h((req, res) => {
    if (wheels.list().length <= 1) throw new HttpError(409, 'Нельзя удалить последний барабан');
    db.transaction(() => {
      if (!wheels.remove(req.params.id)) notFound('Барабан');
      // отвязываем вопросы, которые ссылались на этот барабан
      for (const q of questions.list()) if (q.wheelId === req.params.id) questions.save({ ...q, wheelId: undefined });
    })();
    res.status(204).end();
  }),
);

/* ------------------------------------------------------------------ темы */

api.get('/themes', h((_req, res) => res.json(themes.list())));
api.post('/themes', requireAdmin, h((req, res) => res.status(201).json(themes.save(parseTheme(req.body, newId('theme'), false)))));
api.put(
  '/themes/:id',
  requireAdmin,
  h((req, res) => {
    const existing = themes.get(req.params.id) ?? notFound('Тема');
    res.json(themes.save(parseTheme(req.body, req.params.id, !!existing.preset)));
  }),
);
api.delete(
  '/themes/:id',
  requireAdmin,
  h((req, res) => {
    const t = themes.get(req.params.id) ?? notFound('Тема');
    if (t.preset) throw new HttpError(409, 'Встроенную тему удалить нельзя');
    db.transaction(() => {
      themes.remove(t.id);
      for (const c of categories.list()) if (c.themeId === t.id) categories.save({ ...c, themeId: undefined });
    })();
    res.status(204).end();
  }),
);

/* ------------------------------------------------------------------ категории */

api.get('/categories', h((_req, res) => res.json(categories.list())));
api.post('/categories', requireAdmin, h((req, res) => res.status(201).json(categories.save(parseCategory(req.body, newId('cat'))))));
api.put(
  '/categories/:id',
  requireAdmin,
  h((req, res) => {
    if (!categories.get(req.params.id)) notFound('Категория');
    res.json(categories.save(parseCategory(req.body, req.params.id)));
  }),
);
api.delete(
  '/categories/:id',
  requireAdmin,
  h((req, res) => {
    // вопросы категории удаляются каскадом (FOREIGN KEY ... ON DELETE CASCADE)
    if (!categories.remove(req.params.id)) notFound('Категория');
    res.status(204).end();
  }),
);

/* ------------------------------------------------------------------ вопросы */

function checkRefs(q: { categoryId: string; wheelId?: string }) {
  if (!categories.get(q.categoryId)) throw new HttpError(400, 'Категория не существует');
  if (q.wheelId && !wheels.get(q.wheelId)) throw new HttpError(400, 'Барабан не существует');
}

api.get(
  '/questions',
  h((req, res) => {
    const cat = typeof req.query.categoryId === 'string' ? req.query.categoryId : '';
    res.json(questions.list().filter((q) => !cat || q.categoryId === cat));
  }),
);
api.post(
  '/questions',
  requireAdmin,
  h((req, res) => {
    const q = parseQuestion(req.body, newId('q'), RU_ALPHABET);
    checkRefs(q);
    res.status(201).json(questions.save(q));
  }),
);
api.put(
  '/questions/:id',
  requireAdmin,
  h((req, res) => {
    if (!questions.get(req.params.id)) notFound('Вопрос');
    const q = parseQuestion(req.body, req.params.id, RU_ALPHABET);
    checkRefs(q);
    res.json(questions.save(q));
  }),
);
api.delete(
  '/questions/:id',
  requireAdmin,
  h((req, res) => {
    if (!questions.remove(req.params.id)) notFound('Вопрос');
    res.status(204).end();
  }),
);

/* ------------------------------------------------------------------ ассеты */

const MIME_EXT: Record<string, { ext: string; kind: 'image' | 'audio' }> = {
  'image/png': { ext: 'png', kind: 'image' },
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/gif': { ext: 'gif', kind: 'image' },
  'image/svg+xml': { ext: 'svg', kind: 'image' },
  'audio/mpeg': { ext: 'mp3', kind: 'audio' },
  'audio/ogg': { ext: 'ogg', kind: 'audio' },
  'audio/wav': { ext: 'wav', kind: 'audio' },
  'audio/x-wav': { ext: 'wav', kind: 'audio' },
  'audio/webm': { ext: 'webm', kind: 'audio' },
};
const MAX_BYTES = 15 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    // имя генерируем сами: исходное имя файла в путь не попадает
    filename: (_req, file, cb) => cb(null, `${newId('f')}.${MIME_EXT[file.mimetype].ext}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) =>
    MIME_EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(415, 'Поддерживаются PNG, JPG, WEBP, GIF, SVG, MP3, OGG, WAV, WEBM')),
});

api.get('/assets', h((_req, res) => res.json(assets.list().reverse())));
api.post(
  '/assets',
  requireAdmin,
  upload.single('file'),
  h((req, res) => {
    const f = req.file;
    if (!f) throw new HttpError(400, 'Файл не передан');
    const base = MIME_EXT[f.mimetype].kind;
    const requested = req.body?.kind as AssetKind | undefined;
    const kind: AssetKind = requested === 'background' && base === 'image' ? 'background' : base;
    const tags = typeof req.body?.tags === 'string' ? req.body.tags.split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 20) : [];
    const asset: Asset = {
      id: path.parse(f.filename).name,
      kind,
      url: `/uploads/${f.filename}`,
      // имя только для отображения в галерее
      fileName: Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 200),
      mimeType: f.mimetype,
      sizeBytes: f.size,
      tags,
      createdAt: new Date().toISOString(),
    };
    res.status(201).json(assets.save(asset));
  }),
);
api.delete(
  '/assets/:id',
  requireAdmin,
  h((req, res) => {
    const a = assets.get(req.params.id) ?? notFound('Файл');
    // Где файл используется: ищем его адрес в JSON всех сущностей
    const usedIn = [
      ...wheels.list().filter((x) => JSON.stringify(x).includes(a.url)).map((x) => `барабан «${x.name}»`),
      ...themes.list().filter((x) => JSON.stringify(x).includes(a.url)).map((x) => `тема «${x.name}»`),
      ...categories.list().filter((x) => JSON.stringify(x).includes(a.url)).map((x) => `категория «${x.name}»`),
      ...questions.list().filter((x) => JSON.stringify(x).includes(a.url)).map((x) => `вопрос «${x.answer}»`),
    ];
    if (usedIn.length && req.query.force !== '1') {
      return res.status(409).json({ error: `Файл используется: ${usedIn.slice(0, 5).join(', ')}`, usedIn });
    }
    assets.remove(a.id);
    const file = path.join(UPLOADS_DIR, path.basename(a.url));
    fs.rm(file, { force: true }, () => {});
    res.status(204).end();
  }),
);

/* ------------------------------------------------------------------ ошибки */

api.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `Файл больше ${MAX_BYTES / 1024 / 1024} МБ` : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Некорректный JSON' });
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});
