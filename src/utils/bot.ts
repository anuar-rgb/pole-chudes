import type { BotLevel, GameState } from '@/types/game';
import type { GameAction } from './gameLogic';
import { hiddenCount } from './gameLogic';
import { random } from './wheelMath';

/** Буквы русского языка по убыванию частоты */
const FREQ = 'ОЕАИНТСРВЛКМДПУЯЫЬГЗБЧЙХЖШЮЦЩЭФЪ';

const PROFILE: Record<BotLevel, { smart: number; wordAt: number; wordChance: number; takePrize: number }> = {
  //       шанс «догадаться» о верной букве, доля открытых букв для попытки слова, шанс её сделать
  easy: { smart: 0.25, wordAt: 0.75, wordChance: 0.4, takePrize: 0.6 },
  medium: { smart: 0.5, wordAt: 0.6, wordChance: 0.6, takePrize: 0.3 },
  hard: { smart: 0.75, wordAt: 0.45, wordChance: 0.85, takePrize: 0.1 },
};

export type BotMove = GameAction | { type: 'spin' } | null;

/**
 * Решение бота для текущей фазы. Бот «знает» ответ, но пользуется этим знанием
 * с вероятностью, зависящей от уровня, — так он ошибается по-человечески.
 */
export function botMove(s: GameState): BotMove {
  const round = s.round;
  const me = s.players[s.currentPlayerIndex];
  if (!round || !me?.isBot) return null;
  const prof = PROFILE[me.botLevel ?? 'medium'];
  const letters = [...round.answer].filter((c) => s.settings.alphabet.includes(c)).length;
  const openRatio = letters ? 1 - hiddenCount(round) / letters : 0;

  const tryWord = () =>
    s.settings.allowFullWordGuess && hiddenCount(round) > 1 && openRatio >= prof.wordAt && random() < prof.wordChance;

  switch (s.phase) {
    case 'spin':
      return tryWord() ? { type: 'word', word: round.answer } : { type: 'spin' };

    case 'guess': {
      if (tryWord()) return { type: 'word', word: round.answer };
      const used = new Set(round.guessedLetters.map((g) => g.letter));
      const hidden = [...new Set([...round.answer].filter((_, i) => !round.revealed[i]))];
      if (random() < prof.smart && hidden.length) {
        // самую частую из оставшихся в слове
        hidden.sort((a, b) => FREQ.indexOf(a) - FREQ.indexOf(b));
        return { type: 'letter', letter: hidden[0] };
      }
      // иначе — из частотного списка с небольшим разбросом
      const candidates = [...FREQ].filter((c) => !used.has(c) && s.settings.alphabet.includes(c)).slice(0, 8);
      return { type: 'letter', letter: candidates[Math.floor(random() * candidates.length)] ?? hidden[0] };
    }

    case 'plusPick': {
      const positions = round.revealed.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
      return { type: 'plusPick', position: positions[Math.floor(random() * positions.length)] };
    }

    case 'prizeChoice':
      return { type: 'prizeDecision', take: random() < prof.takePrize };

    default:
      return null;
  }
}
