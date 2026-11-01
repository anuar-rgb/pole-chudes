import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Player, RoundState, Theme } from '@/types/game';
import { CLASSIC_WHEEL } from '@/data/presets';
import { applyThemeCss, applyThemeToWheel } from '@/utils/theme';
import { RU_ALPHABET } from '@/utils/gameLogic';
import { WheelCanvas } from '@/components/game/WheelCanvas';
import { WordBoard } from '@/components/game/WordBoard';
import { PlayerCard } from '@/components/game/PlayerCard';
import { Button } from '@/components/ui/Button';

const ROUND: RoundState = {
  index: 0,
  questionId: 'preview',
  answer: 'ПОЛЕ ЧУДЕС',
  revealed: [true, false, true, false, true, false, true, false, false, true],
  guessedLetters: [],
  eliminatedPlayerIds: [],
};

const PLAYERS: Player[] = [
  { id: 'a', name: 'Айгерим', color: '#ef4444', roundScore: 1250, totalScore: 0, prizes: [] },
  { id: 'b', name: 'Бот', color: '#3b82f6', isBot: true, roundScore: 400, totalScore: 0, prizes: ['Чайник'] },
];

/**
 * Мини-экран игры в оформлении черновика темы. Переменные темы пишутся
 * в стиль этого блока, поэтому остальная админка не перекрашивается.
 */
export function ThemePreview({ theme }: { theme: Theme }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) applyThemeCss(theme, ref.current);
  }, [theme]);

  const wheel = useMemo(() => applyThemeToWheel(CLASSIC_WHEEL, theme), [theme]);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[var(--radius)] border border-white/10 p-4 text-[var(--c-text)]"
      style={{
        backgroundColor: 'var(--c-bg)',
        backgroundImage: 'var(--bg-overlay), var(--bg-image)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: 'var(--font-body)',
      }}
    >
      <h3 className="mb-3 text-xl font-black" style={{ fontFamily: 'var(--font-heading)' }}>
        Поле <span className="text-[var(--c-accent)]">чудес</span>
      </h3>
      <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[150px]">
          <WheelCanvas wheel={wheel} hubLabel="КРУТИ" />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <PlayerCard player={PLAYERS[0]} active eliminated={false} timeFraction={0.6} />
          <PlayerCard player={PLAYERS[1]} active={false} eliminated={false} timeFraction={null} />
        </div>
      </div>
      <div className="panel mt-3 flex flex-col gap-3 p-3">
        <p className="text-sm font-semibold">Как называется эта игра?</p>
        <WordBoard round={ROUND} alphabet={RU_ALPHABET} />
      </div>
      <p className="mt-2 text-center text-sm font-black text-[var(--c-success)]">Есть буква «О»! +500</p>
      <p className="text-center text-sm font-black text-[var(--c-danger)]">Банкрот! Очки сгорели.</p>
      <div className="mt-2 flex justify-center gap-1">
        {['А', 'Б', 'В', 'Г'].map((ch, i) => (
          <span
            key={ch}
            className={`flex h-8 w-8 items-center justify-center rounded-[calc(var(--radius)*0.5)] text-sm font-bold ${
              i === 1 ? 'bg-[var(--c-success)] text-white' : i === 2 ? 'bg-[var(--c-danger)]/70 text-white/70 line-through' : 'bg-[var(--c-surface-alt)]'
            }`}
          >
            {ch}
          </span>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <Button size="sm">Крутить</Button>
        <Button size="sm" variant="secondary">
          Назвать слово
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--c-muted)]">Второстепенный текст</p>
    </div>
  );
}
