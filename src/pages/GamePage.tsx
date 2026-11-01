import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import { PRESET_THEMES, PRESET_WHEELS } from '@/data/presets';
import { useGameStore } from '@/store/gameStore';
import { GameSetup } from '@/components/game/GameSetup';
import { GameScreen } from '@/components/game/GameScreen';
import { applyThemeCss, applyThemeToWheel } from '@/utils/theme';

export function GamePage() {
  const game = useGameStore((s) => s.game);
  const [previewTheme, setPreviewTheme] = useState(PRESET_THEMES[0].id);
  const [soundOn, setSoundOn] = useState(true);

  const themeId = game?.settings.themeId ?? previewTheme;
  const theme = PRESET_THEMES.find((t) => t.id === themeId) ?? PRESET_THEMES[0];
  const wheelId = game?.settings.wheelId;

  const wheel = useMemo(() => {
    const base = PRESET_WHEELS.find((w) => w.id === wheelId) ?? PRESET_WHEELS[0];
    // у барабана с картинами собственные цвета — не перекрашиваем
    return applyThemeToWheel(base, theme, base.id === 'wheel_classic');
  }, [wheelId, theme]);

  useEffect(() => applyThemeCss(theme), [theme]);
  const onThemePreview = useCallback((id: string) => setPreviewTheme(id), []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Поле <span className="text-[var(--c-accent)]">чудес</span>
        </h1>
        <div className="flex items-center gap-2">
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
      {game ? <GameScreen wheel={wheel} theme={theme} soundOn={soundOn} /> : <GameSetup onThemePreview={onThemePreview} />}
    </div>
  );
}
