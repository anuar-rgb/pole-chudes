import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Asset, Category, Question, Theme, Wheel } from '@/types/game';
import { PRESET_THEMES, PRESET_WHEELS } from '@/data/presets';
import { DEMO_CATEGORIES, DEMO_QUESTIONS } from '@/data/questions';

/**
 * Хранилище: SQLite, одна таблица на сущность.
 * Сущности (барабан с секторами, тема с цветами) — вложенные документы, поэтому
 * они лежат целиком в колонке data (JSON), а в отдельные колонки вынесено только то,
 * по чему нужны связи и фильтры (category_id у вопросов).
 *
 * DATA_DIR — каталог для БД и загрузок. На Railway туда монтируется Volume (/data),
 * иначе данные пропадут при следующем деплое.
 */

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'pole.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS wheels (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS themes (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS questions_category ON questions(category_id);
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

type Row = { data: string; created_at: string; updated_at: string };

/** Репозиторий документов: list / get / save / remove для одной таблицы */
function repo<T extends { id: string; createdAt?: string; updatedAt?: string }>(table: string, extra?: (e: T) => Record<string, string>) {
  const hydrate = (r: Row): T => ({ ...JSON.parse(r.data), createdAt: r.created_at, updatedAt: r.updated_at });
  const listStmt = db.prepare<[], Row>(`SELECT data, created_at, updated_at FROM ${table} ORDER BY created_at, rowid`);
  const getStmt = db.prepare<[string], Row>(`SELECT data, created_at, updated_at FROM ${table} WHERE id = ?`);
  const delStmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`);

  return {
    list: (): T[] => listStmt.all().map(hydrate),
    get: (id: string): T | undefined => {
      const r = getStmt.get(id);
      return r ? hydrate(r) : undefined;
    },
    save(entity: T): T {
      const now = new Date().toISOString();
      // даты живут в колонках, в JSON их не дублируем
      const { createdAt: _c, updatedAt: _u, ...rest } = entity;
      const cols = { id: entity.id, data: JSON.stringify(rest), ...extra?.(entity) };
      const names = Object.keys(cols);
      db.prepare(
        `INSERT INTO ${table} (${names.join(', ')}, created_at, updated_at)
         VALUES (${names.map((n) => '@' + n).join(', ')}, @now, @now)
         ON CONFLICT(id) DO UPDATE SET ${names
           .filter((n) => n !== 'id')
           .map((n) => `${n} = excluded.${n}`)
           .join(', ')}, updated_at = excluded.updated_at`,
      ).run({ ...cols, now });
      return this.get(entity.id)!;
    },
    remove: (id: string) => delStmt.run(id).changes > 0,
  };
}

export const wheels = repo<Wheel>('wheels');
export const themes = repo<Theme>('themes');
export const categories = repo<Category>('categories');
export const questions = repo<Question>('questions', (q) => ({ category_id: q.categoryId }));
export const assets = repo<Asset>('assets');

/** Первый запуск: наполняем базу встроенными пресетами и демо-вопросами */
export function seedIfEmpty() {
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  db.transaction(() => {
    if (count('wheels') === 0) PRESET_WHEELS.forEach((w) => wheels.save(w));
    if (count('themes') === 0) PRESET_THEMES.forEach((t) => themes.save(t));
    if (count('categories') === 0) {
      DEMO_CATEGORIES.forEach((c) => categories.save(c));
      DEMO_QUESTIONS.forEach((q) => questions.save(q));
    }
  })();
}
