import { useEffect, useState } from 'react';
import { Bot, Minus, Play, Plus, Timer, User } from 'lucide-react';
import type { BotLevel, GameMode, GameSettings } from '@/types/game';
import { useDataStore } from '@/store/dataStore';
import { RU_ALPHABET, type PlayerDraft } from '@/utils/gameLogic';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/Button';

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];
const STORAGE_KEY = 'pole.setup.v1';

const MODES: { id: GameMode; title: string; text: string }[] = [
  { id: 'solo', title: 'Соло', text: 'Один игрок, на время или для тренировки' },
  { id: 'vsBot', title: 'Против бота', text: 'Вы и 1–3 компьютерных соперника' },
  { id: 'local', title: 'За одним экраном', text: '2–4 игрока или команды по очереди' },
  { id: 'host', title: 'Ведущий', text: 'Ведущий видит ответ и вводит буквы за участников' },
];

const BOT_LEVELS: { id: BotLevel; label: string }[] = [
  { id: 'easy', label: 'Лёгкий' },
  { id: 'medium', label: 'Средний' },
  { id: 'hard', label: 'Сильный' },
];

interface SetupState {
  settings: GameSettings;
  players: PlayerDraft[];
}

function defaultPlayers(mode: GameMode): PlayerDraft[] {
  switch (mode) {
    case 'solo':
      return [{ name: 'Игрок', color: COLORS[0] }];
    case 'vsBot':
      return [
        { name: 'Вы', color: COLORS[0] },
        { name: 'Бот Алдияр', color: COLORS[1], isBot: true, botLevel: 'medium' },
      ];
    default:
      return [
        { name: 'Игрок 1', color: COLORS[0] },
        { name: 'Игрок 2', color: COLORS[1] },
        { name: 'Игрок 3', color: COLORS[2] },
      ];
  }
}

const BOT_NAMES = ['Бот Алдияр', 'Бот Айгерим', 'Бот Вася'];

function initial(): SetupState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SetupState;
  } catch {
    /* приватный режим / битые данные — берём значения по умолчанию */
  }
  return {
    settings: {
      mode: 'vsBot',
      wheelId: '',
      themeId: '',
      categoryIds: [],
      rounds: 3,
      turnTimer: { enabled: false, seconds: 30 },
      allowFullWordGuess: true,
      wrongWordEliminates: true,
      fullWordBonusPerLetter: 100,
      alphabet: RU_ALPHABET,
    },
    players: defaultPlayers('vsBot'),
  };
}

export function GameSetup({ onThemePreview }: { onThemePreview: (themeId: string) => void }) {
  const { wheels, themes, categories, questions } = useDataStore();
  const start = useGameStore((s) => s.start);
  const error = useGameStore((s) => s.error);
  const [state, setState] = useState<SetupState>(initial);
  const { players } = state;

  // Сохранённые настройки могли ссылаться на удалённые в админке барабан/тему/категории
  const settings: GameSettings = {
    ...state.settings,
    wheelId: wheels.some((w) => w.id === state.settings.wheelId) ? state.settings.wheelId : wheels[0]?.id ?? '',
    themeId: themes.some((t) => t.id === state.settings.themeId) ? state.settings.themeId : themes[0]?.id ?? '',
    categoryIds: state.settings.categoryIds.filter((id) => categories.some((c) => c.id === id)),
  };

  const set = (patch: Partial<GameSettings>) => setState((s) => ({ ...s, settings: { ...settings, ...patch } }));
  const setPlayers = (fn: (p: PlayerDraft[]) => PlayerDraft[]) => setState((s) => ({ ...s, players: fn(s.players) }));

  useEffect(() => onThemePreview(settings.themeId), [settings.themeId, onThemePreview]);

  const minP = settings.mode === 'solo' ? 1 : 2;
  const maxP = settings.mode === 'solo' ? 1 : 4;
  const canBot = settings.mode === 'vsBot' || settings.mode === 'local';
  const available = questions.filter((q) => !settings.categoryIds.length || settings.categoryIds.includes(q.categoryId)).length;

  const valid =
    available > 0 &&
    players.length >= minP &&
    players.length <= maxP &&
    (settings.mode !== 'vsBot' || (players.some((p) => p.isBot) && players.some((p) => !p.isBot)));

  const begin = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, players }));
    } catch {
      /* не критично */
    }
    start(settings, settings.mode === 'host' ? players.map((p) => ({ ...p, isBot: false })) : players);
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 pb-12 sm:px-6 lg:grid-cols-2">
      <section className="panel flex flex-col gap-5 p-5">
        <div>
          <h2 className="mb-3 text-lg font-bold">Режим игры</h2>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setState((s) => ({ settings: { ...s.settings, mode: m.id }, players: defaultPlayers(m.id) }))}
                className={`rounded-[var(--radius)] border p-3 text-left transition ${
                  settings.mode === m.id ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/15' : 'border-white/15 hover:bg-white/5'
                }`}
                aria-pressed={settings.mode === m.id}
              >
                <div className="font-bold">{m.title}</div>
                <div className="mt-0.5 text-xs text-[var(--c-muted)]">{m.text}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Участники</h2>
            {maxP > 1 && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Убрать участника"
                  disabled={players.length <= minP}
                  onClick={() => setPlayers((p) => p.slice(0, -1))}
                >
                  <Minus size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Добавить участника"
                  disabled={players.length >= maxP}
                  onClick={() =>
                    setPlayers((p) => [
                      ...p,
                      settings.mode === 'vsBot'
                        ? { name: BOT_NAMES[p.length - 1] ?? `Бот ${p.length}`, color: COLORS[p.length], isBot: true, botLevel: 'medium' }
                        : { name: `Игрок ${p.length + 1}`, color: COLORS[p.length] },
                    ])
                  }
                >
                  <Plus size={16} />
                </Button>
              </div>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {players.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={p.color}
                  aria-label={`Цвет участника ${i + 1}`}
                  onChange={(e) => setPlayers((ps) => ps.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
                  className="h-10 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                />
                <input
                  value={p.name}
                  maxLength={24}
                  aria-label={`Имя участника ${i + 1}`}
                  onChange={(e) => setPlayers((ps) => ps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className={`${inputCls} min-w-0 flex-1`}
                />
                {canBot && (
                  <button
                    onClick={() => setPlayers((ps) => ps.map((x, j) => (j === i ? { ...x, isBot: !x.isBot, botLevel: x.botLevel ?? 'medium' } : x)))}
                    className="flex h-10 items-center gap-1.5 rounded-[var(--radius)] border border-white/15 px-3 text-sm"
                    aria-label={p.isBot ? 'Сделать человеком' : 'Сделать ботом'}
                  >
                    {p.isBot ? <Bot size={16} /> : <User size={16} />}
                  </button>
                )}
                {canBot && p.isBot && (
                  <select
                    value={p.botLevel}
                    aria-label="Уровень бота"
                    onChange={(e) => setPlayers((ps) => ps.map((x, j) => (j === i ? { ...x, botLevel: e.target.value as BotLevel } : x)))}
                    className={`${inputCls} w-auto`}
                  >
                    {BOT_LEVELS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel flex flex-col gap-5 p-5">
        <div>
          <h2 className="mb-3 text-lg font-bold">Темы вопросов</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = settings.categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  aria-pressed={on}
                  onClick={() => {
                    const ids = on ? settings.categoryIds.filter((x) => x !== c.id) : [...settings.categoryIds, c.id];
                    // одна категория со своей темой — сразу подставляем оформление
                    const theme = ids.length === 1 ? categories.find((x) => x.id === ids[0])?.themeId : undefined;
                    set({ categoryIds: ids, ...(theme ? { themeId: theme } : {}) });
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    on ? 'border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-accent-text)]' : 'border-white/15 hover:bg-white/5'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--c-muted)]">
            {settings.categoryIds.length ? '' : 'Ничего не выбрано — вопросы из всех тем. '}Доступно вопросов: {available}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[var(--c-muted)]">Барабан</span>
            <select className={inputCls} value={settings.wheelId} onChange={(e) => set({ wheelId: e.target.value })}>
              {wheels.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[var(--c-muted)]">Оформление</span>
            <select className={inputCls} value={settings.themeId} onChange={(e) => set({ themeId: e.target.value })}>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[var(--c-muted)]">Раундов</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, available)}
              value={settings.rounds}
              onChange={(e) => set({ rounds: Math.max(1, Math.min(available || 1, +e.target.value || 1)) })}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-[var(--c-muted)]">
              <Timer size={14} /> Таймер хода, сек
            </span>
            <div className="flex gap-2">
              <input
                type="checkbox"
                checked={settings.turnTimer.enabled}
                onChange={(e) => set({ turnTimer: { ...settings.turnTimer, enabled: e.target.checked } })}
                aria-label="Включить таймер"
                className="h-10 w-5 accent-[var(--c-accent)]"
              />
              <input
                type="number"
                min={5}
                max={180}
                disabled={!settings.turnTimer.enabled}
                value={settings.turnTimer.seconds}
                onChange={(e) => set({ turnTimer: { ...settings.turnTimer, seconds: Math.max(5, +e.target.value || 30) } })}
                className={`${inputCls} min-w-0`}
              />
            </div>
          </label>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <Check checked={settings.allowFullWordGuess} onChange={(v) => set({ allowFullWordGuess: v })}>
            Можно назвать слово целиком (бонус {settings.fullWordBonusPerLetter} за каждую закрытую букву)
          </Check>
          <Check
            checked={settings.wrongWordEliminates}
            disabled={!settings.allowFullWordGuess}
            onChange={(v) => set({ wrongWordEliminates: v })}
          >
            Неверное слово — выбывание из раунда
          </Check>
        </div>

        {error && <p className="text-sm text-[var(--c-danger)]">{error}</p>}

        <Button size="lg" className="mt-auto" disabled={!valid} onClick={begin}>
          <Play size={20} /> Начать игру
        </Button>
      </section>
    </main>
  );
}

const inputCls =
  'h-10 w-full rounded-[var(--radius)] border border-white/15 bg-[var(--c-surface-alt)] px-3 text-[var(--c-text)] disabled:opacity-50';

function Check({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex items-start gap-2.5 ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--c-accent)]"
      />
      <span>{children}</span>
    </label>
  );
}
