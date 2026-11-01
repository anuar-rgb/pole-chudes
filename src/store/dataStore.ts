import { create } from 'zustand';
import type { Category, Question, Theme, Wheel } from '@/types/game';
import { api } from '@/api/client';
import { PRESET_THEMES, PRESET_WHEELS } from '@/data/presets';
import { DEMO_CATEGORIES, DEMO_QUESTIONS } from '@/data/questions';

/**
 * Контент игры (барабаны, темы, категории, вопросы), загруженный с сервера.
 * Если API недоступен (например, открыт голый `vite` без сервера), игра работает
 * на встроенных пресетах в режиме offline — админка при этом недоступна.
 */

type Status = 'idle' | 'loading' | 'ready' | 'offline';

interface DataStore {
  status: Status;
  wheels: Wheel[];
  themes: Theme[];
  categories: Category[];
  questions: Question[];
  load(): Promise<void>;
  /** Заменить/добавить сущность в локальном состоянии после успешного ответа API */
  upsert<K extends Collection>(key: K, item: DataStore[K][number]): void;
  drop(key: Collection, id: string): void;
}

type Collection = 'wheels' | 'themes' | 'categories' | 'questions';

export const useDataStore = create<DataStore>()((set, get) => ({
  status: 'idle',
  wheels: PRESET_WHEELS,
  themes: PRESET_THEMES,
  categories: DEMO_CATEGORIES,
  questions: DEMO_QUESTIONS,

  async load() {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const data = await api.bootstrap();
      set({ ...data, status: 'ready' });
    } catch {
      set({ status: 'offline' });
    }
  },

  upsert(key, item) {
    const list = get()[key] as { id: string }[];
    const exists = list.some((x) => x.id === item.id);
    set({ [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] } as Partial<DataStore>);
  },

  drop(key, id) {
    const list = get()[key] as { id: string; categoryId?: string; wheelId?: string }[];
    const patch: Partial<DataStore> = { [key]: list.filter((x) => x.id !== id) };
    // повторяем на клиенте то, что сервер делает каскадом
    if (key === 'categories') patch.questions = get().questions.filter((q) => q.categoryId !== id);
    if (key === 'wheels') patch.questions = get().questions.map((q) => (q.wheelId === id ? { ...q, wheelId: undefined } : q));
    if (key === 'themes') patch.categories = get().categories.map((c) => (c.themeId === id ? { ...c, themeId: undefined } : c));
    set(patch);
  },
}));
