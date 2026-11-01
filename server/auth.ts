import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Защита админки одним паролем из переменной окружения ADMIN_PASSWORD.
 * Клиент получает токен = HMAC(пароль), сам пароль в браузере не хранится.
 * Смена пароля автоматически аннулирует все выданные токены.
 *
 * Без ADMIN_PASSWORD: локально запись открыта (удобно для разработки),
 * в продакшене (Railway / NODE_ENV=production) — запрещена.
 */

const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

export type AuthMode = 'password' | 'open' | 'locked';
export const authMode: AuthMode = PASSWORD ? 'password' : IS_PROD ? 'locked' : 'open';

const tokenFor = (password: string) => createHmac('sha256', 'pole-chudes-admin').update(password).digest('hex');
const EXPECTED = PASSWORD ? tokenFor(PASSWORD) : '';

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function isAuthorized(req: Request) {
  if (authMode === 'open') return true;
  if (authMode === 'locked') return false;
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') && safeEqual(h.slice(7), EXPECTED);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (isAuthorized(req)) return next();
  res.status(authMode === 'locked' ? 503 : 401).json({
    error: authMode === 'locked' ? 'Админка отключена: задайте переменную ADMIN_PASSWORD на сервере' : 'Требуется вход',
  });
}

/* Простое ограничение перебора: 10 попыток за 10 минут с одного IP */
const attempts = new Map<string, { n: number; until: number }>();

export function login(req: Request, res: Response) {
  if (authMode !== 'password') return res.json({ token: '', mode: authMode });
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.until > now && a.n >= 10) return res.status(429).json({ error: 'Слишком много попыток, подождите 10 минут' });

  const pwd = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!safeEqual(tokenFor(pwd), EXPECTED)) {
    attempts.set(ip, { n: (a && a.until > now ? a.n : 0) + 1, until: now + 10 * 60_000 });
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  attempts.delete(ip);
  res.json({ token: EXPECTED, mode: authMode });
}
