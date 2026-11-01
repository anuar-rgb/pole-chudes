import { Bot, Gift, User } from 'lucide-react';
import type { Player } from '@/types/game';

interface Props {
  player: Player;
  active: boolean;
  eliminated: boolean;
  /** 0..1 — остаток времени хода; null, если таймер выключен */
  timeFraction: number | null;
}

export function PlayerCard({ player, active, eliminated, timeFraction }: Props) {
  return (
    <div
      className={`panel relative overflow-hidden p-3 transition ${eliminated ? 'opacity-40 grayscale' : ''}`}
      style={active ? { boxShadow: `0 0 0 3px ${player.color}, 0 8px 24px -6px ${player.color}` } : undefined}
      aria-current={active ? 'true' : undefined}
    >
      <div className="flex items-center gap-2 sm:gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white sm:h-9 sm:w-9"
          style={{ background: player.color }}
        >
          {player.isBot ? <Bot size={18} /> : <User size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{player.name}</div>
          <div className="text-xs text-[var(--c-muted)]">
            {eliminated ? 'выбыл из раунда' : active ? 'ходит' : `всего ${player.totalScore}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums leading-none">{player.roundScore}</div>
          <div className="hidden text-[10px] uppercase tracking-wider text-[var(--c-muted)] sm:block">очки раунда</div>
        </div>
      </div>
      {player.prizes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {player.prizes.map((p, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">
              <Gift size={12} /> {p}
            </span>
          ))}
        </div>
      )}
      {active && timeFraction !== null && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div
            className="h-full transition-[width] duration-200 ease-linear"
            style={{ width: `${timeFraction * 100}%`, background: timeFraction < 0.25 ? 'var(--c-danger)' : player.color }}
          />
        </div>
      )}
    </div>
  );
}
