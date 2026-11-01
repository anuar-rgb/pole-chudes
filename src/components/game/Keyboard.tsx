import { useEffect } from 'react';
import type { LetterGuess } from '@/types/game';
import { normalizeLetter } from '@/utils/gameLogic';

const ROWS = ['ЙЦУКЕНГШЩЗХЪ', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬБЮ'];

/** Физические клавиши в английской раскладке → русские буквы (ЙЦУКЕН) */
const CODE_TO_RU: Record<string, string> = {
  KeyQ: 'Й', KeyW: 'Ц', KeyE: 'У', KeyR: 'К', KeyT: 'Е', KeyY: 'Н', KeyU: 'Г', KeyI: 'Ш', KeyO: 'Щ', KeyP: 'З',
  BracketLeft: 'Х', BracketRight: 'Ъ', KeyA: 'Ф', KeyS: 'Ы', KeyD: 'В', KeyF: 'А', KeyG: 'П', KeyH: 'Р', KeyJ: 'О',
  KeyK: 'Л', KeyL: 'Д', Semicolon: 'Ж', Quote: 'Э', KeyZ: 'Я', KeyX: 'Ч', KeyC: 'С', KeyV: 'М', KeyB: 'И', KeyN: 'Т',
  KeyM: 'Ь', Comma: 'Б', Period: 'Ю', Backquote: 'Е',
};

interface Props {
  guessed: LetterGuess[];
  enabled: boolean;
  onLetter: (letter: string) => void;
}

export function Keyboard({ guessed, enabled, onLetter }: Props) {
  const state = new Map(guessed.map((g) => [g.letter, g.correct]));

  // Физическая клавиатура: работает и в русской, и в английской раскладке
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const direct = e.key.length === 1 ? normalizeLetter(e.key) : '';
      const letter = /[А-Я]/.test(direct) ? direct : CODE_TO_RU[e.code];
      if (letter && !state.has(letter)) {
        e.preventDefault();
        onLetter(letter);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex w-full flex-col items-center gap-1.5" role="group" aria-label="Клавиатура">
      {ROWS.map((row) => (
        <div key={row} className="flex w-full justify-center gap-1 sm:gap-1.5">
          {[...row].map((ch) => {
            const st = state.get(ch);
            const used = st !== undefined;
            return (
              <button
                key={ch}
                type="button"
                disabled={!enabled || used}
                onClick={() => onLetter(ch)}
                aria-label={`Буква ${ch}${used ? (st ? ', есть' : ', нет') : ''}`}
                className={`h-11 min-w-0 flex-1 basis-0 rounded-[calc(var(--radius)*0.5)] text-base font-bold transition sm:h-12 sm:max-w-12 sm:text-lg ${
                  st === true
                    ? 'bg-[var(--c-success)] text-white'
                    : st === false
                      ? 'bg-[var(--c-danger)]/70 text-white/70 line-through'
                      : 'bg-[var(--c-surface-alt)] text-[var(--c-text)] hover:brightness-125 active:scale-95'
                } disabled:cursor-not-allowed ${!used && !enabled ? 'opacity-45' : ''}`}
              >
                {ch}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
