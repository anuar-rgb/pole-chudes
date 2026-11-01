import { useMemo, useState } from 'react';
import { Image as ImageIcon, Music, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Category, Difficulty, Question } from '@/types/game';
import { api } from '@/api/client';
import { useDataStore } from '@/store/dataStore';
import { normalizeAnswer, RU_ALPHABET } from '@/utils/gameLogic';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { withToast } from '@/components/ui/Toast';
import { MediaField } from './AssetLibrary';

const DIFF: Record<Difficulty, { label: string; cls: string }> = {
  easy: { label: 'Лёгкий', cls: 'bg-[var(--c-success)]/20 text-[var(--c-success)]' },
  medium: { label: 'Средний', cls: 'bg-[var(--c-accent)]/20 text-[var(--c-accent)]' },
  hard: { label: 'Сложный', cls: 'bg-[var(--c-danger)]/20 text-[var(--c-danger)]' },
};

type QDraft = Omit<Question, 'id'> & { id?: string };
type CDraft = Omit<Category, 'id'> & { id?: string };

export function QuestionManager() {
  const { categories, questions, wheels, themes, upsert, drop } = useDataStore();
  const [catId, setCatId] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [diff, setDiff] = useState<Difficulty | ''>('');
  const [editQ, setEditQ] = useState<QDraft | null>(null);
  const [editC, setEditC] = useState<CDraft | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    questions.forEach((q) => m.set(q.categoryId, (m.get(q.categoryId) ?? 0) + 1));
    return m;
  }, [questions]);

  const list = useMemo(() => {
    const qn = query.trim().toLocaleLowerCase('ru-RU');
    return questions.filter(
      (q) =>
        (catId === 'all' || q.categoryId === catId) &&
        (!diff || q.difficulty === diff) &&
        (!qn || `${q.answer} ${q.prompt} ${q.hint ?? ''}`.toLocaleLowerCase('ru-RU').includes(qn)),
    );
  }, [questions, catId, diff, query]);

  const removeQuestion = async (q: Question) => {
    if (!confirm(`Удалить вопрос «${q.answer}»?`)) return;
    if ((await withToast(api.questions.remove(q.id).then(() => true), 'Вопрос удалён')) === true) drop('questions', q.id);
  };

  const removeCategory = async (c: Category) => {
    const n = counts.get(c.id) ?? 0;
    if (!confirm(n ? `Удалить категорию «${c.name}» вместе с ${n} вопрос(ами)?` : `Удалить категорию «${c.name}»?`)) return;
    if ((await withToast(api.categories.remove(c.id).then(() => true), 'Категория удалена')) === true) {
      drop('categories', c.id);
      setCatId('all');
    }
  };

  const currentCat = categories.find((c) => c.id === catId);

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black">Вопросы и категории</h1>
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ---------- категории */}
        <aside className="flex flex-col gap-2">
          <CatButton active={catId === 'all'} onClick={() => setCatId('all')} name="Все вопросы" count={questions.length} />
          {categories.map((c) => (
            <CatButton key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)} name={c.name} count={counts.get(c.id) ?? 0} />
          ))}
          <Button variant="ghost" size="sm" onClick={() => setEditC({ name: '' })}>
            <Plus size={16} /> Категория
          </Button>
        </aside>

        {/* ---------- вопросы */}
        <section className="flex min-w-0 flex-col gap-3">
          {currentCat && (
            <div className="panel flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{currentCat.name}</div>
                <div className="text-xs text-[var(--c-muted)]">
                  Тема оформления: {themes.find((t) => t.id === currentCat.themeId)?.name ?? 'не задана'}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditC(currentCat)}>
                <Pencil size={16} /> Изменить
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeCategory(currentCat)} aria-label="Удалить категорию">
                <Trash2 size={16} />
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-muted)]" />
              <Input aria-label="Поиск" placeholder="Поиск по ответу, заданию, подсказке" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
            </div>
            <Select aria-label="Сложность" value={diff} onChange={(e) => setDiff(e.target.value as Difficulty | '')} className="w-auto">
              <option value="">Любая сложность</option>
              {Object.entries(DIFF).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Button
              disabled={!categories.length}
              onClick={() =>
                setEditQ({ categoryId: currentCat?.id ?? categories[0].id, answer: '', prompt: '', difficulty: 'medium' })
              }
            >
              <Plus size={18} /> Вопрос
            </Button>
          </div>

          {list.length === 0 ? (
            <p className="panel p-8 text-center text-[var(--c-muted)]">{questions.length ? 'Ничего не найдено' : 'Вопросов пока нет'}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((q) => (
                <li key={q.id} className="panel flex items-center gap-3 p-3">
                  {q.image ? (
                    <img src={q.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-black/20 font-black text-[var(--c-muted)]">
                      {normalizeAnswer(q.answer).replace(/[^А-Я]/g, '').length}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black tracking-wide">{normalizeAnswer(q.answer)}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${DIFF[q.difficulty].cls}`}>{DIFF[q.difficulty].label}</span>
                      {q.image && <ImageIcon size={14} className="text-[var(--c-muted)]" aria-label="есть картинка" />}
                      {q.audio && <Music size={14} className="text-[var(--c-muted)]" aria-label="есть аудио" />}
                      {q.wheelId && <span className="text-xs text-[var(--c-muted)]">· {wheels.find((w) => w.id === q.wheelId)?.name}</span>}
                    </div>
                    <p className="truncate text-sm text-[var(--c-muted)]">{q.prompt}</p>
                    {catId === 'all' && <p className="text-xs text-[var(--c-muted)]/70">{categories.find((c) => c.id === q.categoryId)?.name}</p>}
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Изменить «${q.answer}»`} onClick={() => setEditQ(q)}>
                    <Pencil size={16} />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Удалить «${q.answer}»`} onClick={() => removeQuestion(q)}>
                    <Trash2 size={16} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editQ && (
        <QuestionModal
          draft={editQ}
          onClose={() => setEditQ(null)}
          onSaved={(q) => {
            upsert('questions', q);
            setEditQ(null);
          }}
        />
      )}
      {editC && (
        <CategoryModal
          draft={editC}
          onClose={() => setEditC(null)}
          onSaved={(c) => {
            upsert('categories', c);
            setCatId(c.id);
            setEditC(null);
          }}
        />
      )}
    </div>
  );
}

function CatButton({ active, onClick, name, count }: { active: boolean; onClick: () => void; name: string; count: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-between gap-2 rounded-[calc(var(--radius)*0.6)] px-3 py-2 text-left text-sm transition ${
        active ? 'bg-[var(--c-accent)] font-bold text-[var(--c-accent-text)]' : 'hover:bg-white/10'
      }`}
    >
      <span className="truncate">{name}</span>
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function QuestionModal({ draft, onClose, onSaved }: { draft: QDraft; onClose: () => void; onSaved: (q: Question) => void }) {
  const { categories, wheels } = useDataStore();
  const [q, setQ] = useState(draft);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<QDraft>) => setQ((x) => ({ ...x, ...patch }));

  const norm = normalizeAnswer(q.answer);
  const letters = [...norm].filter((c) => RU_ALPHABET.includes(c)).length;
  const valid = letters >= 2 && q.prompt.trim().length > 0;

  const save = async () => {
    setSaving(true);
    const { id, createdAt: _c, updatedAt: _u, ...body } = q;
    const saved = await withToast(id ? api.questions.update({ ...body, id }) : api.questions.create(body), 'Вопрос сохранён');
    setSaving(false);
    if (saved) onSaved(saved);
  };

  return (
    <Modal open title={q.id ? 'Редактирование вопроса' : 'Новый вопрос'} onClose={onClose}>
      <form
        className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void save();
        }}
      >
        <Field label="Ответ (загаданное слово или фраза)" hint={q.answer ? `${letters} букв · на табло: ${norm}` : 'Пробелы и дефисы будут видны сразу'}>
          <Input autoFocus value={q.answer} maxLength={60} onChange={(e) => set({ answer: e.target.value })} />
        </Field>
        <Field label="Задание">
          <Textarea value={q.prompt} maxLength={500} onChange={(e) => set({ prompt: e.target.value })} />
        </Field>
        <Field label="Подсказка" hint="Открывается сектором «Загадка» или ведущим">
          <Input value={q.hint ?? ''} maxLength={500} onChange={(e) => set({ hint: e.target.value || undefined })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Категория">
            <Select value={q.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Сложность">
            <Select value={q.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
              {Object.entries(DIFF).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Барабан для этого вопроса">
          <Select value={q.wheelId ?? ''} onChange={(e) => set({ wheelId: e.target.value || undefined })}>
            <option value="">Барабан партии</option>
            {wheels.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Картинка-подсказка" group>
            <MediaField kind="image" value={q.image} onChange={(image) => set({ image })} />
          </Field>
          <Field label="Аудио" group>
            <MediaField kind="audio" value={q.audio} onChange={(audio) => set({ audio })} />
          </Field>
        </div>
        {!valid && q.answer && letters < 2 && <p className="text-sm text-[var(--c-danger)]">В ответе нужно хотя бы 2 русские буквы.</p>}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({ draft, onClose, onSaved }: { draft: CDraft; onClose: () => void; onSaved: (c: Category) => void }) {
  const themes = useDataStore((s) => s.themes);
  const [c, setC] = useState(draft);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { id, createdAt: _c, updatedAt: _u, ...body } = c;
    const saved = await withToast(id ? api.categories.update({ ...body, id }) : api.categories.create(body), 'Категория сохранена');
    setSaving(false);
    if (saved) onSaved(saved);
  };

  return (
    <Modal open title={c.id ? 'Категория' : 'Новая категория'} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (c.name.trim()) void save();
        }}
      >
        <Field label="Название">
          <Input autoFocus value={c.name} maxLength={120} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Например, «Казахская история»" />
        </Field>
        <Field label="Описание">
          <Textarea value={c.description ?? ''} maxLength={1000} onChange={(e) => setC({ ...c, description: e.target.value || undefined })} />
        </Field>
        <Field label="Тема оформления" hint="Подставится автоматически, если выбрать только эту категорию">
          <Select value={c.themeId ?? ''} onChange={(e) => setC({ ...c, themeId: e.target.value || undefined })}>
            <option value="">Не задана</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Обложка" group>
          <MediaField kind="image" value={c.coverImage} onChange={(coverImage) => setC({ ...c, coverImage })} />
        </Field>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={!c.name.trim() || saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
