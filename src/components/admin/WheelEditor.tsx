import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Dices, Palette, Plus, Save, Scale } from 'lucide-react';
import type { Wheel, WheelSection } from '@/types/game';
import { SECTION_TYPE_LABELS, WHEEL_MAX_SECTIONS, WHEEL_MIN_SECTIONS } from '@/types/game';
import { api } from '@/api/client';
import { useDataStore } from '@/store/dataStore';
import { buildClassicSections, DEFAULT_WHEEL_STYLE } from '@/data/presets';
import { DEFAULT_PHYSICS, sectionProbabilities } from '@/utils/wheelMath';
import { applyThemeToWheel } from '@/utils/theme';
import { WheelCanvas } from '@/components/game/WheelCanvas';
import { useWheel } from '@/hooks/useWheel';
import { useAudio } from '@/hooks/useAudio';
import { Button } from '@/components/ui/Button';
import { ColorInput, Field, Input, NumberInput, Select, Toggle } from '@/components/ui/form';
import { withToast } from '@/components/ui/Toast';
import { MediaField } from './AssetLibrary';
import { SectionRow } from './SectionRow';

const sectionId = () => `sec_${crypto.randomUUID().slice(0, 8)}`;

const FONTS = [
  { label: 'Rubik (по умолчанию)', value: 'Rubik, system-ui, sans-serif' },
  { label: 'С засечками (Georgia)', value: 'Georgia, serif' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
  { label: 'Моноширинный', value: 'ui-monospace, "Share Tech Mono", monospace' },
  { label: 'Детский', value: '"Comic Sans MS", Rubik, sans-serif' },
];

function newWheel(palette: string[]): Wheel {
  return {
    id: '',
    name: 'Новый барабан',
    sections: buildClassicSections(8, palette).map((s) => ({ ...s, id: sectionId() })),
    style: DEFAULT_WHEEL_STYLE,
    physics: DEFAULT_PHYSICS,
    followTheme: false,
  };
}

export function WheelEditor({ wheelId }: { wheelId: string }) {
  const navigate = useNavigate();
  const { wheels, themes, upsert } = useDataStore();
  const isNew = wheelId === 'new';
  const original = useMemo(
    () => (isNew ? newWheel(themes[0]?.sectionPalette ?? ['#dc2626', '#2563eb']) : wheels.find((w) => w.id === wheelId)),
    // при сохранении wheels меняется — исходник должен обновиться вместе с ним
    [isNew, wheelId, wheels, themes],
  );
  const [draft, setDraft] = useState<Wheel | undefined>(original);
  const [saving, setSaving] = useState(false);
  const [previewThemeId, setPreviewThemeId] = useState(themes[0]?.id ?? '');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Черновик подменяем, только если он от другого барабана или ещё не создан
  // (страницу открыли по прямой ссылке до загрузки данных). Иначе правки не трогаем.
  useEffect(() => {
    setDraft((d) => (d && d.id === (isNew ? '' : wheelId) ? d : original));
  }, [wheelId, isNew, original]);

  const dirty = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const previewTheme = themes.find((t) => t.id === previewThemeId) ?? themes[0];
  const preview = useMemo(() => (draft && previewTheme ? applyThemeToWheel(draft, previewTheme) : draft), [draft, previewTheme]);
  const { wheelRef, spin, spinning, lastResult } = useWheel(preview ?? newWheel([]));
  const { play } = useAudio();

  if (!draft || !preview) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">Барабан не найден.</p>
        <Link to="/admin/wheels" className="underline">
          К списку барабанов
        </Link>
      </div>
    );
  }

  const n = draft.sections.length;
  const probs = sectionProbabilities(draft.sections);
  const setSections = (fn: (s: WheelSection[]) => WheelSection[]) => setDraft((d) => d && { ...d, sections: fn(d.sections) });
  const setStyle = (patch: Partial<Wheel['style']>) => setDraft((d) => d && { ...d, style: { ...d.style, ...patch } });
  const setPhysics = (patch: Partial<Wheel['physics']>) => setDraft((d) => d && { ...d, physics: { ...d.physics, ...patch } });

  const move = (from: number, to: number) =>
    setSections((ss) => {
      if (to < 0 || to >= ss.length || from === to) return ss;
      const next = [...ss];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const save = async () => {
    setSaving(true);
    const { id: _id, createdAt: _c, updatedAt: _u, ...body } = draft;
    const saved = await withToast(isNew ? api.wheels.create(body) : api.wheels.update(draft), 'Барабан сохранён');
    setSaving(false);
    if (!saved) return;
    upsert('wheels', saved);
    setDraft(saved);
    if (isNew) navigate(`/admin/wheels/${saved.id}`, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- шапка */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/wheels"
          onClick={(e) => dirty && !confirm('Есть несохранённые изменения. Уйти без сохранения?') && e.preventDefault()}
          className="rounded p-2 hover:bg-white/10"
          aria-label="К списку барабанов"
        >
          <ArrowLeft size={20} />
        </Link>
        <Input aria-label="Название барабана" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="min-w-40 max-w-sm flex-1 basis-40 text-lg font-bold" />
        <span className="hidden text-sm text-[var(--c-muted)] sm:inline">{dirty ? 'Есть изменения' : isNew ? '' : 'Сохранено'}</span>
        <Button className="ml-auto" onClick={save} disabled={saving || (!dirty && !isNew) || !draft.name.trim()}>
          <Save size={18} /> {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---------- секторы и настройки */}
        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">
                Секторы <span className="text-[var(--c-muted)]">{n} / {WHEEL_MAX_SECTIONS}</span>
              </h2>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  title="Перекрасить очковые секторы в палитру выбранной темы"
                  onClick={() => {
                    const pal = previewTheme.sectionPalette;
                    let i = 0;
                    setSections((ss) => ss.map((s) => (s.type === 'points' ? { ...s, fill: { kind: 'solid', color: pal[i++ % pal.length] } } : s)));
                  }}
                >
                  <Palette size={16} /> Палитра темы
                </Button>
                <Button size="sm" variant="ghost" title="Одинаковый шанс для всех секторов" onClick={() => setSections((ss) => ss.map((s) => ({ ...s, weight: 1 })))}>
                  <Scale size={16} /> Уравнять шансы
                </Button>
              </div>
            </div>
            <ol className="flex flex-col gap-2">
              {draft.sections.map((s, i) => (
                <SectionRow
                  key={s.id}
                  section={s}
                  index={i}
                  count={n}
                  probability={probs[i]}
                  canDelete={n > WHEEL_MIN_SECTIONS}
                  onChange={(next) => setSections((ss) => ss.map((x, j) => (j === i ? next : x)))}
                  onMove={(dir) => move(i, i + dir)}
                  onDuplicate={() => n < WHEEL_MAX_SECTIONS && setSections((ss) => [...ss.slice(0, i + 1), { ...s, id: sectionId() }, ...ss.slice(i + 1)])}
                  onDelete={() => setSections((ss) => ss.filter((_, j) => j !== i))}
                  drag={{
                    onDragStart: () => setDragFrom(i),
                    onDragOver: (e) => {
                      e.preventDefault();
                      setDragOver(i);
                    },
                    onDrop: () => dragFrom !== null && move(dragFrom, i),
                    onDragEnd: () => {
                      setDragFrom(null);
                      setDragOver(null);
                    },
                    isOver: dragOver === i && dragFrom !== null && dragFrom !== i,
                  }}
                />
              ))}
            </ol>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              disabled={n >= WHEEL_MAX_SECTIONS}
              onClick={() =>
                setSections((ss) => [
                  ...ss,
                  { id: sectionId(), type: 'points', label: '500', value: 500, weight: 1, fill: { kind: 'solid', color: previewTheme.sectionPalette[ss.length % previewTheme.sectionPalette.length] } },
                ])
              }
            >
              <Plus size={18} /> Добавить сектор
            </Button>
            {n <= WHEEL_MIN_SECTIONS && <p className="mt-2 text-xs text-[var(--c-muted)]">Минимум {WHEEL_MIN_SECTIONS} секторов.</p>}
          </section>

          <section className="panel flex flex-col gap-4 p-4">
            <h2 className="text-lg font-bold">Оформление барабана</h2>
            <Toggle checked={!!draft.followTheme} onChange={(followTheme) => setDraft({ ...draft, followTheme })}>
              Следовать теме игры: цвета обода и стрелки берутся из темы, очковые секторы без картинок перекрашиваются в её палитру
            </Toggle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Обод" group>
                <ColorInput label="Цвет обода" value={draft.style.rimColor} onChange={(rimColor) => setStyle({ rimColor })} />
              </Field>
              <Field label="Разделители" group>
                <ColorInput label="Цвет разделителей" value={draft.style.dividerColor} onChange={(dividerColor) => setStyle({ dividerColor })} />
              </Field>
              <Field label="Стрелка" group>
                <ColorInput label="Цвет стрелки" value={draft.style.pointerColor} onChange={(pointerColor) => setStyle({ pointerColor })} />
              </Field>
              <Field label="Центр" group>
                <ColorInput label="Цвет центра" value={draft.style.hubColor} onChange={(hubColor) => setStyle({ hubColor })} />
              </Field>
              <Field label="Лампочки" group>
                <ColorInput label="Цвет лампочек" value={draft.style.lightColor} onChange={(lightColor) => setStyle({ lightColor })} />
              </Field>
              <Field label="Картинка в центре" group>
                <MediaField kind="image" value={draft.style.hubImage} onChange={(hubImage) => setStyle({ hubImage })} />
              </Field>
              <Field label={`Толщина обода: ${draft.style.rimWidth}`}>
                <input type="range" min={6} max={40} value={draft.style.rimWidth} onChange={(e) => setStyle({ rimWidth: +e.target.value })} className="h-10 accent-[var(--c-accent)]" />
              </Field>
              <Field label={`Толщина разделителей: ${draft.style.dividerWidth}`}>
                <input type="range" min={0} max={8} step={0.5} value={draft.style.dividerWidth} onChange={(e) => setStyle({ dividerWidth: +e.target.value })} className="h-10 accent-[var(--c-accent)]" />
              </Field>
              <Field label="Подписи">
                <Select value={draft.style.labelOrientation} onChange={(e) => setStyle({ labelOrientation: e.target.value as 'radial' | 'tangential' })}>
                  <option value="radial">Вдоль радиуса</option>
                  <option value="tangential">По кругу</option>
                </Select>
              </Field>
              <Field label="Шрифт" className="col-span-2">
                <Select value={draft.style.fontFamily} onChange={(e) => setStyle({ fontFamily: e.target.value })}>
                  {!FONTS.some((f) => f.value === draft.style.fontFamily) && <option value={draft.style.fontFamily}>{draft.style.fontFamily}</option>}
                  {FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end pb-2">
                <Toggle checked={draft.style.showLights} onChange={(showLights) => setStyle({ showLights })}>
                  Лампочки
                </Toggle>
              </div>
            </div>
          </section>

          <section className="panel flex flex-col gap-4 p-4">
            <h2 className="text-lg font-bold">Физика вращения</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Длительность, сек">
                <NumberInput value={draft.physics.durationMs / 1000} min={1} max={20} step={0.5} onChange={(v) => setPhysics({ durationMs: Math.round((v ?? 6) * 1000) })} />
              </Field>
              <Field label="Мин. оборотов">
                <NumberInput value={draft.physics.minTurns} min={1} max={20} onChange={(v) => setPhysics({ minTurns: v ?? 3 })} />
              </Field>
              <Field label="Макс. оборотов">
                <NumberInput value={draft.physics.maxTurns} min={draft.physics.minTurns} max={30} onChange={(v) => setPhysics({ maxTurns: v ?? 6 })} />
              </Field>
              <Field label="Разброс остановки" hint="0 — ровно в центр сектора">
                <NumberInput value={draft.physics.landingJitter} min={0} max={0.49} step={0.05} onChange={(v) => setPhysics({ landingJitter: v ?? 0 })} />
              </Field>
            </div>
          </section>
        </div>

        {/* ---------- живое превью */}
        <aside className="flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
          <div className="panel flex flex-col items-center gap-3 p-4">
            <div className="flex w-full items-center justify-between gap-2">
              <h2 className="font-bold">Превью</h2>
              <Select aria-label="Тема превью" value={previewThemeId} onChange={(e) => setPreviewThemeId(e.target.value)} className="w-auto text-sm">
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full max-w-[360px]">
              <WheelCanvas
                ref={wheelRef}
                wheel={preview}
                highlightIndex={lastResult?.sectionIndex ?? null}
                onTick={(_, speed) => play('spinTick', Math.min(1, 0.35 + speed / 25))}
              />
            </div>
            <Button onClick={() => void spin()} disabled={spinning}>
              <Dices size={18} /> Тестовое вращение
            </Button>
            <p className="min-h-5 text-center text-sm">
              {lastResult && !spinning && (
                <>
                  Выпало: <b>{lastResult.section.label}</b> · {SECTION_TYPE_LABELS[lastResult.section.type]}
                </>
              )}
            </p>
          </div>
          <div className="panel p-4">
            <h3 className="mb-2 text-sm font-bold">Шансы по типам</h3>
            <TypeOdds sections={draft.sections} probs={probs} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function TypeOdds({ sections, probs }: { sections: WheelSection[]; probs: number[] }) {
  const byType = new Map<string, number>();
  sections.forEach((s, i) => byType.set(s.type, (byType.get(s.type) ?? 0) + probs[i]));
  const rows = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {rows.map(([type, p]) => (
        <li key={type} className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-[var(--c-muted)]">{SECTION_TYPE_LABELS[type as WheelSection['type']]}</span>
          <span className="h-2 flex-1 overflow-hidden rounded bg-white/10">
            <span className="block h-full rounded bg-[var(--c-accent)]" style={{ width: `${p * 100}%` }} />
          </span>
          <span className="w-12 text-right tabular-nums">{(p * 100).toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}
