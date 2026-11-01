import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Play, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import type { BackgroundGradient, SoundKey, Theme, ThemeColors, WheelStyle } from '@/types/game';
import { SOUND_LABELS } from '@/types/game';
import { api } from '@/api/client';
import { useDataStore } from '@/store/dataStore';
import { contrastRatio, generatePalette } from '@/utils/color';
import { ensureFonts, FONT_CATALOG, fontStack, primaryFamily } from '@/utils/fonts';
import { playSound } from '@/utils/sound';
import { Button } from '@/components/ui/Button';
import { ColorInput, Field, Input, Select } from '@/components/ui/form';
import { withToast } from '@/components/ui/Toast';
import { MediaField } from './AssetLibrary';
import { ThemePreview } from './ThemePreview';

const COLOR_GROUPS: { title: string; keys: [keyof ThemeColors, string][] }[] = [
  { title: 'Фон и панели', keys: [['background', 'Фон'], ['surface', 'Панели'], ['surfaceAlt', 'Поля и клавиши']] },
  { title: 'Текст и акцент', keys: [['text', 'Текст'], ['textMuted', 'Второстепенный'], ['accent', 'Акцент'], ['accentText', 'Текст на акценте']] },
  { title: 'Табло', keys: [['tileBack', 'Закрытая плашка'], ['tileFront', 'Открытая плашка'], ['tileText', 'Буква']] },
  { title: 'Сигналы', keys: [['success', 'Успех'], ['danger', 'Ошибка']] },
];

/** Пары «текст на фоне», которые важно держать читаемыми. min: 4.5 — обычный текст, 3 — крупный */
const CONTRAST: { fg: keyof ThemeColors; bg: keyof ThemeColors; label: string; min: number }[] = [
  { fg: 'text', bg: 'background', label: 'Текст на фоне', min: 4.5 },
  { fg: 'text', bg: 'surface', label: 'Текст на панели', min: 4.5 },
  { fg: 'textMuted', bg: 'surface', label: 'Второстепенный на панели', min: 3 },
  { fg: 'accentText', bg: 'accent', label: 'Текст на кнопке', min: 4.5 },
  { fg: 'tileText', bg: 'tileFront', label: 'Буква на плашке', min: 3 },
  { fg: 'success', bg: 'surface', label: 'Успех на панели', min: 3 },
  { fg: 'danger', bg: 'surface', label: 'Ошибка на панели', min: 3 },
];

const WHEEL_KEYS: [keyof WheelStyle, string][] = [
  ['rimColor', 'Обод'],
  ['dividerColor', 'Разделители'],
  ['pointerColor', 'Стрелка'],
  ['hubColor', 'Центр'],
  ['lightColor', 'Лампочки'],
];

const DEFAULT_GRADIENT = (t: Theme): BackgroundGradient => ({
  kind: 'radial',
  from: t.colors.surfaceAlt,
  to: t.colors.background,
  angle: 180,
  x: 50,
  y: 30,
  opacity: 1,
});

export function ThemeEditor({ themeId }: { themeId: string }) {
  const navigate = useNavigate();
  const { themes, upsert } = useDataStore();
  const isNew = themeId === 'new';
  const original = useMemo(() => {
    if (!isNew) return themes.find((t) => t.id === themeId);
    const base = themes[0];
    return base && { ...base, id: '', name: 'Новая тема', preset: false, createdAt: undefined, updatedAt: undefined };
  }, [isNew, themeId, themes]);
  const [draft, setDraft] = useState<Theme | undefined>(original);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft((d) => (d && d.id === (isNew ? '' : themeId) ? d : original));
  }, [themeId, isNew, original]);

  const dirty = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Шрифты каталога показываем их же начертанием — грузим все при открытии редактора
  useEffect(() => ensureFonts(...FONT_CATALOG.map(fontStack)), []);

  if (!draft) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">Тема не найдена.</p>
        <Link to="/admin/themes" className="underline">
          К списку тем
        </Link>
      </div>
    );
  }

  const set = (patch: Partial<Theme>) => setDraft((d) => d && { ...d, ...patch });
  const setColor = (k: keyof ThemeColors, v: string) => setDraft((d) => d && { ...d, colors: { ...d.colors, [k]: v } });
  const setGradient = (patch: Partial<BackgroundGradient>) =>
    setDraft((d) => d && { ...d, backgroundGradient: { ...(d.backgroundGradient ?? DEFAULT_GRADIENT(d)), ...patch } });
  const setWheel = (k: keyof WheelStyle, v: string | undefined) =>
    setDraft((d) => {
      if (!d) return d;
      const ws = { ...d.wheelStyle } as Record<string, unknown>;
      if (v === undefined) delete ws[k];
      else ws[k] = v;
      return { ...d, wheelStyle: ws as Partial<WheelStyle> };
    });
  const setSound = (k: SoundKey, url: string | undefined) =>
    setDraft((d) => {
      if (!d) return d;
      const s = { ...d.sounds };
      if (url) s[k] = url;
      else delete s[k];
      return { ...d, sounds: s };
    });

  const save = async () => {
    setSaving(true);
    const { id: _id, createdAt: _c, updatedAt: _u, preset: _p, ...body } = draft;
    const saved = await withToast(isNew ? api.themes.create(body) : api.themes.update(draft), 'Тема сохранена');
    setSaving(false);
    if (!saved) return;
    upsert('themes', saved);
    setDraft(saved);
    if (isNew) navigate(`/admin/themes/${saved.id}`, { replace: true });
  };

  const g = draft.backgroundGradient;
  const lowContrast = CONTRAST.filter((c) => (contrastRatio(draft.colors[c.fg], draft.colors[c.bg]) ?? 21) < c.min).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/themes"
          onClick={(e) => dirty && !confirm('Есть несохранённые изменения. Уйти без сохранения?') && e.preventDefault()}
          className="rounded p-2 hover:bg-white/10"
          aria-label="К списку тем"
        >
          <ArrowLeft size={20} />
        </Link>
        <Input aria-label="Название темы" value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className="min-w-40 max-w-sm flex-1 basis-40 text-lg font-bold" />
        {draft.preset && <span className="rounded bg-white/10 px-2 py-0.5 text-xs">встроенная</span>}
        <span className="hidden text-sm text-[var(--c-muted)] sm:inline">{dirty ? 'Есть изменения' : isNew ? '' : 'Сохранено'}</span>
        <Button className="ml-auto" onClick={save} disabled={saving || (!dirty && !isNew) || !draft.name.trim()}>
          <Save size={18} /> {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* ---------- цвета */}
          <Section title="Цвета">
            {COLOR_GROUPS.map((grp) => (
              <div key={grp.title}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">{grp.title}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {grp.keys.map(([k, label]) => (
                    <Field key={k} label={label} group>
                      <ColorInput label={label} value={draft.colors[k]} onChange={(v) => setColor(k, v)} />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
            <details className="rounded-[calc(var(--radius)*0.6)] bg-black/15 p-3" open={lowContrast > 0}>
              <summary className="cursor-pointer text-sm font-bold">
                Читаемость {lowContrast ? <span className="text-[var(--c-danger)]">· {lowContrast} пар с низким контрастом</span> : <span className="text-[var(--c-success)]">· всё в порядке</span>}
              </summary>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {CONTRAST.map((c) => {
                  const r = contrastRatio(draft.colors[c.fg], draft.colors[c.bg]);
                  const ok = r === null || r >= c.min;
                  return (
                    <li key={c.label} className="flex items-center gap-2">
                      <span
                        className="flex h-6 w-9 shrink-0 items-center justify-center rounded text-xs font-bold"
                        style={{ background: draft.colors[c.bg], color: draft.colors[c.fg] }}
                      >
                        Аа
                      </span>
                      <span className="flex-1">{c.label}</span>
                      <span className={`tabular-nums ${ok ? 'text-[var(--c-muted)]' : 'font-bold text-[var(--c-danger)]'}`}>{r ? r.toFixed(1) : '—'}</span>
                      {ok ? <Check size={14} className="text-[var(--c-success)]" /> : <AlertTriangle size={14} className="text-[var(--c-danger)]" aria-label={`нужно не меньше ${c.min}`} />}
                    </li>
                  );
                })}
              </ul>
            </details>
          </Section>

          {/* ---------- шрифты */}
          <Section title="Шрифты и форма">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Основной текст">
                <FontSelect value={draft.fontFamily} onChange={(fontFamily) => set({ fontFamily: fontFamily ?? draft.fontFamily })} />
              </Field>
              <Field label="Заголовки">
                <FontSelect value={draft.headingFontFamily} allowEmpty="Как основной" onChange={(headingFontFamily) => set({ headingFontFamily })} />
              </Field>
              <Field label="Подписи на барабане">
                <FontSelect value={draft.wheelStyle?.fontFamily} allowEmpty="Как в барабане" onChange={(v) => setWheel('fontFamily', v)} />
              </Field>
            </div>
            <Field label={`Скругление углов: ${draft.borderRadius}px`}>
              <input type="range" min={0} max={28} value={draft.borderRadius} onChange={(e) => set({ borderRadius: +e.target.value })} className="h-8 max-w-sm accent-[var(--c-accent)]" />
            </Field>
          </Section>

          {/* ---------- фон */}
          <Section title="Фон игрового поля">
            <Field label="Картинка" group>
              <MediaField kind="image" value={draft.backgroundImage} onChange={(backgroundImage) => set({ backgroundImage })} />
            </Field>
            {!g && draft.backgroundOverlay ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-[var(--c-muted)]">Фон задан CSS-строкой.</span>
                <Button size="sm" variant="secondary" onClick={() => setGradient({})}>
                  Перейти на конструктор
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Градиент">
                  <Select value={g?.kind ?? 'radial'} onChange={(e) => setGradient({ kind: e.target.value as BackgroundGradient['kind'] })}>
                    <option value="radial">Радиальный</option>
                    <option value="linear">Линейный</option>
                    <option value="solid">Сплошной цвет</option>
                  </Select>
                </Field>
                <Field label={g?.kind === 'radial' ? 'Цвет в центре' : 'Цвет 1'} group>
                  <ColorInput label="Первый цвет фона" value={g?.from ?? draft.colors.surfaceAlt} onChange={(from) => setGradient({ from })} />
                </Field>
                {g?.kind !== 'solid' && (
                  <Field label={g?.kind === 'radial' ? 'Цвет по краям' : 'Цвет 2'} group>
                    <ColorInput label="Второй цвет фона" value={g?.to ?? draft.colors.background} onChange={(to) => setGradient({ to })} />
                  </Field>
                )}
                <Field label={`Непрозрачность ${Math.round((g?.opacity ?? 1) * 100)}%`}>
                  <input type="range" min={0} max={1} step={0.05} value={g?.opacity ?? 1} onChange={(e) => setGradient({ opacity: +e.target.value })} className="h-10 accent-[var(--c-accent)]" />
                </Field>
                {g?.kind === 'linear' && (
                  <Field label={`Угол ${g.angle}°`}>
                    <input type="range" min={0} max={360} step={5} value={g.angle} onChange={(e) => setGradient({ angle: +e.target.value })} className="h-10 accent-[var(--c-accent)]" />
                  </Field>
                )}
                {g?.kind === 'radial' && (
                  <>
                    <Field label={`Центр по горизонтали ${g.x}%`}>
                      <input type="range" min={0} max={100} value={g.x} onChange={(e) => setGradient({ x: +e.target.value })} className="h-10 accent-[var(--c-accent)]" />
                    </Field>
                    <Field label={`Центр по вертикали ${g.y}%`}>
                      <input type="range" min={0} max={100} value={g.y} onChange={(e) => setGradient({ y: +e.target.value })} className="h-10 accent-[var(--c-accent)]" />
                    </Field>
                  </>
                )}
              </div>
            )}
            {draft.backgroundImage && (g?.opacity ?? 1) > 0.9 && (
              <p className="text-xs text-[var(--c-muted)]">Градиент почти непрозрачный и закрывает картинку — уменьшите непрозрачность.</p>
            )}
          </Section>

          {/* ---------- палитра */}
          <Section title="Палитра секторов" hint="Барабаны с режимом «следовать теме» красят очковые секторы этими цветами.">
            <div className="flex flex-wrap gap-2">
              {draft.sectionPalette.map((c, i) => (
                <div key={i} className="flex items-center gap-1 rounded-[calc(var(--radius)*0.6)] bg-black/15 p-1">
                  <ColorInput label={`Цвет ${i + 1}`} value={c} onChange={(v) => set({ sectionPalette: draft.sectionPalette.map((x, j) => (j === i ? v : x)) })} />
                  <button
                    type="button"
                    aria-label={`Убрать цвет ${i + 1}`}
                    disabled={draft.sectionPalette.length <= 2}
                    onClick={() => set({ sectionPalette: draft.sectionPalette.filter((_, j) => j !== i) })}
                    className="rounded p-1.5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" disabled={draft.sectionPalette.length >= 24} onClick={() => set({ sectionPalette: [...draft.sectionPalette, draft.colors.accent] })}>
                <Plus size={16} /> Цвет
              </Button>
              <Button size="sm" variant="ghost" title="Равномерные оттенки от акцентного цвета" onClick={() => set({ sectionPalette: generatePalette(draft.colors.accent, draft.sectionPalette.length) })}>
                <Sparkles size={16} /> Сгенерировать от акцента
              </Button>
            </div>
          </Section>

          {/* ---------- барабан */}
          <Section title="Цвета барабана" hint="Применяются к барабанам с режимом «следовать теме». Без галочки — цвет из настроек барабана.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WHEEL_KEYS.map(([k, label]) => {
                const v = draft.wheelStyle?.[k] as string | undefined;
                return (
                  <div key={k} className="flex flex-col gap-1.5 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={v !== undefined} onChange={(e) => setWheel(k, e.target.checked ? draft.colors.accent : undefined)} className="h-4 w-4 accent-[var(--c-accent)]" />
                      <span className="text-[var(--c-muted)]">{label}</span>
                    </label>
                    {v !== undefined && <ColorInput label={label} value={v} onChange={(c) => setWheel(k, c)} />}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ---------- звуки */}
          <Section title="Звуки" hint="Без файла играет встроенный синтезированный звук.">
            <ul className="flex flex-col gap-2">
              {(Object.keys(SOUND_LABELS) as SoundKey[]).map((k) => (
                <li key={k} className="flex flex-wrap items-center gap-3">
                  <span className="w-40 text-sm">{SOUND_LABELS[k]}</span>
                  <Button size="sm" variant="ghost" aria-label={`Прослушать: ${SOUND_LABELS[k]}`} onClick={() => playSound(k, draft.sounds)}>
                    <Play size={14} />
                  </Button>
                  <MediaField kind="audio" value={draft.sounds?.[k]} onChange={(url) => setSound(k, url)} />
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <h2 className="mb-2 font-bold">Превью</h2>
          <ThemePreview theme={draft} />
        </aside>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="panel flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="text-xs text-[var(--c-muted)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Выбор шрифта из каталога; неизвестный стек (например, системный) сохраняется как есть */
function FontSelect({ value, onChange, allowEmpty }: { value?: string; onChange: (v: string | undefined) => void; allowEmpty?: string }) {
  const known = FONT_CATALOG.find((f) => value && f.family === primaryFamily(value));
  const groups = [...new Set(FONT_CATALOG.map((f) => f.group))];
  return (
    <Select
      value={value ? (known ? fontStack(known) : value) : ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      style={{ fontFamily: value }}
    >
      {allowEmpty && <option value="">{allowEmpty}</option>}
      {value && !known && <option value={value}>{primaryFamily(value)} (системный)</option>}
      {groups.map((grp) => (
        <optgroup key={grp} label={grp}>
          {FONT_CATALOG.filter((f) => f.group === grp).map((f) => (
            <option key={f.family} value={fontStack(f)} style={{ fontFamily: fontStack(f) }}>
              {f.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
