import type { Asset, AssetKind, Category, Question, Theme, Wheel } from '@/types/game';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const TOKEN_KEY = 'pole.admin.token';

export const authToken = {
  get(): string {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? '';
    } catch {
      return '';
    }
  },
  set(t: string) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* приватный режим — останется только на эту сессию */
    }
  },
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = authToken.get();
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Ошибка ${res.status}`);
  return data as T;
}

export interface Bootstrap {
  wheels: Wheel[];
  themes: Theme[];
  categories: Category[];
  questions: Question[];
}

export type AuthMode = 'password' | 'open' | 'locked';

/** Без id — сервер присваивает его сам */
type New<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

function crud<T extends { id: string }>(path: string) {
  return {
    list: () => request<T[]>('GET', path),
    create: (e: New<T>) => request<T>('POST', path, e),
    update: (e: T) => request<T>('PUT', `${path}/${e.id}`, e),
    remove: (id: string) => request<void>('DELETE', `${path}/${id}`),
  };
}

export const api = {
  bootstrap: () => request<Bootstrap>('GET', '/bootstrap'),
  me: () => request<{ mode: AuthMode; authorized: boolean }>('GET', '/admin/me'),
  login: (password: string) => request<{ token: string; mode: AuthMode }>('POST', '/admin/login', { password }),

  wheels: crud<Wheel>('/wheels'),
  themes: crud<Theme>('/themes'),
  categories: crud<Category>('/categories'),
  questions: crud<Question>('/questions'),

  assets: {
    list: () => request<Asset[]>('GET', '/assets'),
    upload(file: File, kind?: AssetKind, tags?: string) {
      const fd = new FormData();
      fd.append('file', file);
      if (kind) fd.append('kind', kind);
      if (tags) fd.append('tags', tags);
      return request<Asset>('POST', '/assets', fd);
    },
    remove: (id: string, force = false) => request<void>('DELETE', `/assets/${id}${force ? '?force=1' : ''}`),
  },
};
