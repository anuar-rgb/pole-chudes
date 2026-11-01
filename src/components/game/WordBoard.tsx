import type { RoundState } from '@/types/game';

interface Props {
  round: RoundState;
  alphabet: string;
  /** Режим сектора «+»: закрытые плашки кликабельны */
  pickable?: boolean;
  onPick?: (position: number) => void;
}

/**
 * Табло: плашки сгруппированы по словам, чтобы фраза переносилась целыми словами.
 * Открытие — 3D-переворот (.tile в index.css), соседние плашки с той же буквой
 * переворачиваются с небольшой задержкой — «волной».
 */
export function WordBoard({ round, alphabet, pickable, onPick }: Props) {
  const chars = [...round.answer];
  const words: { ch: string; i: number }[][] = [[]];
  chars.forEach((ch, i) => (ch === ' ' ? words.push([]) : words[words.length - 1].push({ ch, i })));

  // Порядковый номер каждой открытой буквы среди одинаковых — для задержки анимации
  const order = new Map<number, number>();
  const seen = new Map<string, number>();
  chars.forEach((ch, i) => {
    const n = seen.get(ch) ?? 0;
    order.set(i, n);
    seen.set(ch, n + 1);
  });

  const len = Math.max(...words.map((w) => w.length));
  // Плашки уменьшаются для длинных слов, чтобы слово помещалось в строку на телефоне
  const size = len > 12 ? 'w-7 h-9 text-lg sm:w-9 sm:h-12 sm:text-2xl' : len > 8 ? 'w-8 h-11 text-xl sm:w-11 sm:h-14 sm:text-3xl' : 'w-10 h-13 text-2xl sm:w-14 sm:h-18 sm:text-4xl';

  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-3" aria-label="Табло">
      {words.map((w, wi) => (
        <div key={wi} className="flex gap-1 sm:gap-1.5">
          {w.map(({ ch, i }) => {
            const playable = alphabet.includes(ch);
            const open = round.revealed[i];
            if (!playable) {
              return (
                <div key={i} className={`${size} flex items-center justify-center font-black`}>
                  {ch}
                </div>
              );
            }
            const canPick = pickable && !open;
            return (
              <button
                key={i}
                type="button"
                disabled={!canPick}
                onClick={() => canPick && onPick?.(i)}
                aria-label={open ? `Буква ${ch}` : `Закрытая буква ${i + 1}`}
                className={`tile ${size} ${open ? 'is-open' : ''} ${canPick ? 'is-pickable' : ''}`}
                style={{ ['--delay' as string]: `${(order.get(i) ?? 0) * 120}ms` }}
              >
                <span className="tile-inner">
                  <span className="tile-face tile-back">{canPick ? <span className="text-sm opacity-80">{i + 1}</span> : null}</span>
                  <span className="tile-face tile-front">{open ? ch : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
