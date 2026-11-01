import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dices, Settings, Volume2, VolumeX } from 'lucide-react';
import { WheelCanvas } from '@/components/game/WheelCanvas';
import { useWheel } from '@/hooks/useWheel';
import { useAudio } from '@/hooks/useAudio';
import { buildClassicSections, PRESET_THEMES, PRESET_WHEELS } from '@/data/presets';
import { SECTION_TYPE_LABELS, WHEEL_MAX_SECTIONS, WHEEL_MIN_SECTIONS, type Wheel } from '@/types/game';
import { sectionProbabilities } from '@/utils/wheelMath';
import { applyThemeCss, applyThemeToWheel } from '@/utils/theme';

/**
 * Песочница барабана (этап 2): проверка отрисовки, физики, звука, тем и
 * «серверного» предопределённого результата. Позже здесь будет игровой экран.
 */
export function WheelPlayground() {
  const [wheelId, setWheelId] = useState(PRESET_WHEELS[0].id);
  const [themeId, setThemeId] = useState(PRESET_THEMES[0].id);
  const [count, setCount] = useState(16);
  const [orientation, setOrientation] = useState<'radial' | 'tangential'>('radial');
  const [sound, setSound] = useState(true);
  const [forced, setForced] = useState<number | ''>('');

  const theme = PRESET_THEMES.find((t) => t.id === themeId)!;

  const wheel: Wheel = useMemo(() => {
    const base = PRESET_WHEELS.find((w) => w.id === wheelId)!;
    const sized = base.id === 'wheel_classic' ? { ...base, sections: buildClassicSections(count, theme.sectionPalette) } : base;
    const themed = applyThemeToWheel(sized, theme, base.id === 'wheel_classic');
    return { ...themed, style: { ...themed.style, labelOrientation: orientation } };
  }, [wheelId, count, theme, orientation]);

  useEffect(() => applyThemeCss(theme), [theme]);

  const { wheelRef, spin, spinning, lastResult, setLastResult } = useWheel(wheel);

  // Сменился набор секторов — старый результат и «серверный» индекс больше не валидны
  useEffect(() => {
    setForced('');
    setLastResult(null);
  }, [wheelId, count, setLastResult]);
  const { play } = useAudio(theme.sounds, sound);

  useEffect(() => {
    if (!lastResult) return;
    const t = lastResult.section.type;
    play(t === 'bankrupt' ? 'bankrupt' : t === 'skip' ? 'wrong' : t === 'prize' ? 'win' : 'correct');
  }, [lastResult, play]);

  const doSpin = () => void spin(forced === '' ? undefined : { forcedIndex: forced });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        doSpin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const probs = sectionProbabilities(wheel.sections);
  const res = lastResult?.section;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Поле <span className="text-[var(--c-accent)]">чудес</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound((s) => !s)}
            className="panel p-2.5"
            aria-label={sound ? 'Выключить звук' : 'Включить звук'}
          >
            {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <Link to="/admin" className="panel flex items-center gap-2 px-3 py-2 text-sm">
            <Settings size={18} /> Админка
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col items-center gap-5">
          <div className="w-full max-w-[640px]">
            <WheelCanvas
              ref={wheelRef}
              wheel={wheel}
              highlightIndex={lastResult?.sectionIndex ?? null}
              onTick={(_, speed) => play('spinTick', Math.min(1, 0.35 + speed / 25))}
              onHubClick={doSpin}
              hubLabel={spinning ? '' : 'КРУТИ'}
            />
          </div>

          <button
            onClick={doSpin}
            disabled={spinning}
            className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--c-accent)] px-8 py-3.5 text-lg font-black uppercase tracking-wide text-[var(--c-accent-text)] shadow-lg transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            <Dices size={22} /> {spinning ? 'Крутится…' : 'Крутить барабан'}
          </button>
          <p className="text-sm text-[var(--c-muted)]">Пробел или клик по центру барабана — тоже крутят</p>

          <div aria-live="polite" className="panel min-h-[84px] w-full max-w-[640px] p-4 text-center">
            {res ? (
              <>
                <div className="text-sm uppercase tracking-widest text-[var(--c-muted)]">{SECTION_TYPE_LABELS[res.type]}</div>
                <div className="mt-1 text-3xl font-black">
                  {res.type === 'points' && `${res.value} очков за букву`}
                  {res.type === 'multiplier' && `Очки ×${res.value}`}
                  {res.type === 'bankrupt' && <span className="text-[var(--c-danger)]">Банкрот!</span>}
                  {res.type === 'plus' && 'Откройте любую букву'}
                  {res.type === 'skip' && 'Переход хода'}
                  {res.type === 'prize' && `Приз: ${res.prizeName ?? res.label}`}
                  {res.type === 'mystery' && 'Загадка!'}
                </div>
              </>
            ) : (
              <div className="pt-4 text-[var(--c-muted)]">{spinning ? 'Барабан вращается…' : 'Крутите барабан'}</div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="panel flex flex-col gap-4 p-4">
            <h2 className="text-lg font-bold">Настройки</h2>

            <Field label="Барабан">
              <select className={inputCls} value={wheelId} disabled={spinning} onChange={(e) => setWheelId(e.target.value)}>
                {PRESET_WHEELS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Тема">
              <select className={inputCls} value={themeId} disabled={spinning} onChange={(e) => setThemeId(e.target.value)}>
                {PRESET_THEMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            {wheelId === 'wheel_classic' && (
              <Field label={`Секторов: ${count}`}>
                <input
                  type="range"
                  min={WHEEL_MIN_SECTIONS}
                  max={WHEEL_MAX_SECTIONS}
                  value={count}
                  disabled={spinning}
                  onChange={(e) => setCount(+e.target.value)}
                  className="w-full accent-[var(--c-accent)]"
                />
              </Field>
            )}

            <Field label="Подписи" group>
              <div className="grid grid-cols-2 gap-2">
                {(['radial', 'tangential'] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOrientation(o)}
                    className={`rounded-[var(--radius)] border px-3 py-2 text-sm ${
                      orientation === o
                        ? 'border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-accent-text)]'
                        : 'border-white/15'
                    }`}
                  >
                    {o === 'radial' ? 'Вдоль радиуса' : 'По кругу'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Результат задаёт «сервер»">
              <select
                className={inputCls}
                value={forced}
                disabled={spinning}
                onChange={(e) => setForced(e.target.value === '' ? '' : +e.target.value)}
              >
                <option value="">Случайно (по весам)</option>
                {wheel.sections.map((s, i) => (
                  <option key={s.id} value={i}>
                    #{i + 1} — {s.type === 'points' ? s.label : SECTION_TYPE_LABELS[s.type]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="panel p-4">
            <h2 className="mb-3 text-lg font-bold">Вероятности секторов</h2>
            <ul className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1 text-sm">
              {wheel.sections.map((s, i) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-2 rounded px-1.5 py-0.5 ${lastResult?.sectionIndex === i ? 'bg-white/10' : ''}`}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                    style={{ background: s.fill.kind === 'solid' ? s.fill.color : `linear-gradient(${s.fill.from}, ${s.fill.to})` }}
                  />
                  <span className="w-14 shrink-0 font-semibold">{s.label}</span>
                  <span className="flex-1 truncate text-[var(--c-muted)]">{SECTION_TYPE_LABELS[s.type]}</span>
                  <span className="tabular-nums">{(probs[i] * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

const inputCls =
  'w-full rounded-[var(--radius)] border border-white/15 bg-[var(--c-surface-alt)] px-3 py-2 text-[var(--c-text)] disabled:opacity-60';

/** group — для набора кнопок: <label> вокруг кнопок перехватывал бы клики */
function Field({ label, group, children }: { label: string; group?: boolean; children: React.ReactNode }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="flex flex-col gap-1.5 text-sm" role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span className="text-[var(--c-muted)]">{label}</span>
      {children}
    </Tag>
  );
}
