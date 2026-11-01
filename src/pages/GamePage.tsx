import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { selectQuestion, useGameStore } from '@/store/gameStore';
import { useDataStore } from '@/store/dataStore';
import { GameSetup } from '@/components/game/GameSetup';
import { GameScreen } from '@/components/game/GameScreen';
import { applyThemeCss, applyThemeToWheel } from '@/utils/theme';

export function GamePage() {
  const game = useGameStore((s) => s.game);
  const question = useGameStore(selectQuestion);
  const { status, wheels, themes, load } = useDataStore();
  const [previewTheme, setPreviewTheme] = useState<string>('');
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  const themeId = game?.settings.themeId ?? previewTheme;
  const theme = themes.find((t) => t.id === themeId) ?? themes[0];
  // Вопрос может быть привязан к своему барабану — он важнее барабана партии
  const wheelId = question?.wheelId ?? game?.settings.wheelId;

  const wheel = useMemo(() => {
    const base = wheels.find((w) => w.id === wheelId) ?? wheels[0];
    return applyThemeToWheel(base, theme);
  }, [wheels, wheelId, theme]);

  useEffect(() => applyThemeCss(theme), [theme]);
  const onThemePreview = useCallback((id: string) => setPreviewTheme(id), []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Поле <span className="text-[var(--c-accent)]">чудес</span>
        </h1>
        <div className="flex items-center gap-2">
          {status === 'offline' && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--c-muted)]" title="Сервер недоступен — используются встроенные вопросы">
              <WifiOff size={16} /> офлайн
            </span>
          )}
          <button onClick={() => setSoundOn((s) => !s)} className="panel p-2.5" aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}>
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          {!game && (
            <Link to="/admin" className="panel flex items-center gap-2 px-3 py-2 text-sm">
              <Settings size={18} /> Админка
            </Link>
          )}
        </div>
      </header>
      {status === 'loading' || status === 'idle' ? (
        <p className="py-20 text-center text-[var(--c-muted)]">Загрузка…</p>
      ) : game ? (
        <GameScreen wheel={wheel} theme={theme} soundOn={soundOn} />
      ) : (
        <GameSetup onThemePreview={onThemePreview} />
      )}
    </div>
  );
}
