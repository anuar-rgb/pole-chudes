import type {
  AnnouncementTone,
  GameEvent,
  GameSettings,
  GameState,
  ID,
  Player,
  Question,
  RoundState,
  WheelSection,
} from '@/types/game';
import { random } from './wheelMath';

/**
 * Чистая логика партии: (state, action) → новый state. Без React и без побочных эффектов,
 * чтобы тот же модуль можно было запускать на сервере (режим ведущего, античит).
 */

export const RU_ALPHABET = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const MULTIPLIER_MIN_PER_LETTER = 100;

export type GameAction =
  | { type: 'spinStart' }
  | { type: 'spinResult'; sectionIndex: number; section: WheelSection }
  | { type: 'letter'; letter: string }
  | { type: 'word'; word: string }
  | { type: 'plusPick'; position: number }
  | { type: 'prizeDecision'; take: boolean }
  | { type: 'timeout' }
  | { type: 'revealHint' }
  | { type: 'skipTurn' }
  | { type: 'nextRound' };

export interface PlayerDraft {
  name: string;
  color: string;
  isBot?: boolean;
  botLevel?: Player['botLevel'];
}

/* ------------------------------------------------------------------ строки */

export const normalizeLetter = (ch: string) => ch.toLocaleUpperCase('ru-RU').replace('Ё', 'Е');
export const normalizeAnswer = (s: string) => normalizeLetter(s.trim()).replace(/\s+/g, ' ');
/** Для сравнения слова целиком — только буквы */
const lettersOnly = (s: string, alphabet: string) =>
  [...normalizeAnswer(s)].filter((c) => alphabet.includes(c)).join('');

export const isPlayable = (ch: string, alphabet: string) => alphabet.includes(ch);

export function hiddenCount(round: RoundState) {
  return round.revealed.filter((r) => !r).length;
}

/* ------------------------------------------------------------------ создание */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createRound(question: Question, index: number, alphabet: string): RoundState {
  const answer = normalizeAnswer(question.answer);
  return {
    index,
    questionId: question.id,
    answer,
    // Пробелы, дефисы, цифры видны сразу
    revealed: [...answer].map((c) => !isPlayable(c, alphabet)),
    guessedLetters: [],
    eliminatedPlayerIds: [],
  };
}

export function createGame(settings: GameSettings, drafts: PlayerDraft[], questions: Question[], now = Date.now()): GameState {
  const pool = questions.filter((q) => settings.categoryIds.length === 0 || settings.categoryIds.includes(q.categoryId));
  if (pool.length === 0) throw new Error('В выбранных категориях нет вопросов');
  const queue = shuffle(pool).map((q) => q.id);
  const first = pool.find((q) => q.id === queue[0])!;

  const players: Player[] = drafts.map((d, i) => ({
    id: `p${i + 1}`,
    name: d.name.trim() || `Игрок ${i + 1}`,
    color: d.color,
    isBot: d.isBot,
    botLevel: d.botLevel,
    roundScore: 0,
    totalScore: 0,
    prizes: [],
  }));

  return {
    id: `g_${now.toString(36)}`,
    settings: { ...settings, rounds: Math.min(settings.rounds, queue.length) },
    players,
    currentPlayerIndex: 0,
    phase: 'spin',
    round: createRound(first, 0, settings.alphabet),
    lastSpin: null,
    pending: null,
    hintShown: false,
    turnStartedAt: now,
    questionQueue: queue.slice(1),
    announcement: { text: `Раунд 1. Ход игрока ${players[0].name}`, tone: 'info', seq: 1 },
    log: [],
  };
}

/* ------------------------------------------------------------------ helpers */

type Ctx = { now: number; questions: Map<ID, Question> };

const current = (s: GameState) => s.players[s.currentPlayerIndex];

function announce(s: GameState, text: string, tone: AnnouncementTone = 'info'): GameState {
  return { ...s, announcement: { text, tone, seq: (s.announcement?.seq ?? 0) + 1 } };
}

function log(s: GameState, e: GameEvent): GameState {
  return { ...s, log: [...s.log, e] };
}

function updatePlayer(s: GameState, idx: number, patch: Partial<Player>): GameState {
  return { ...s, players: s.players.map((p, i) => (i === idx ? { ...p, ...patch } : p)) };
}

/** Передать ход следующему не выбывшему игроку; если таких нет — раунд проигран */
function passTurn(s: GameState, ctx: Ctx, reason?: string): GameState {
  const round = s.round!;
  const n = s.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (s.currentPlayerIndex + step) % n;
    if (!round.eliminatedPlayerIds.includes(s.players[idx].id)) {
      // turnStartedAt ставим явно: в соло ход «переходит» к тому же игроку в ту же фазу
      const next = { ...s, currentPlayerIndex: idx, phase: 'spin' as const, pending: null, turnStartedAt: ctx.now };
      const who = n > 1 ? `Ход переходит к игроку ${s.players[idx].name}` : 'Крутите барабан';
      return announce(next, reason ? `${reason} ${who}` : who, reason ? 'bad' : 'info');
    }
  }
  return loseRound(s, ctx);
}

function revealAll(round: RoundState): RoundState {
  return { ...round, revealed: round.revealed.map(() => true) };
}

function winRound(s: GameState, ctx: Ctx, text: string): GameState {
  const p = current(s);
  let next = updatePlayer(s, s.currentPlayerIndex, { totalScore: p.totalScore + p.roundScore });
  next = { ...next, round: { ...revealAll(s.round!), winnerId: p.id }, phase: 'roundOver', pending: null };
  next = log(next, { type: 'roundWin', playerId: p.id, at: ctx.now });
  return announce(next, text, 'win');
}

function loseRound(s: GameState, ctx: Ctx): GameState {
  let next: GameState = { ...s, round: revealAll(s.round!), phase: 'roundOver', pending: null };
  next = log(next, { type: 'roundLost', at: ctx.now });
  return announce(next, `Никто не угадал. Ответ: ${s.round!.answer}`, 'bad');
}

/** Открывает все вхождения буквы; возвращает новый раунд и сколько букв открыто */
function revealLetter(round: RoundState, letter: string): [RoundState, number] {
  let count = 0;
  const revealed = round.revealed.map((r, i) => {
    if (!r && round.answer[i] === letter) {
      count++;
      return true;
    }
    return r;
  });
  return [{ ...round, revealed }, count];
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/* ------------------------------------------------------------------ reducer */

const TURN_PHASES = new Set<GameState['phase']>(['spin', 'guess', 'plusPick', 'prizeChoice']);

export function gameReducer(state: GameState, action: GameAction, ctx: Ctx): GameState {
  const next = reduce(state, action, ctx);
  // Таймер хода перезапускается при любой смене фазы или игрока
  if (next !== state && (next.phase !== state.phase || next.currentPlayerIndex !== state.currentPlayerIndex)) {
    return { ...next, turnStartedAt: ctx.now };
  }
  return next;
}

function reduce(s: GameState, a: GameAction, ctx: Ctx): GameState {
  const round = s.round;
  if (!round) return s;
  const player = current(s);
  const { settings } = s;

  switch (a.type) {
    case 'spinStart':
      return s.phase === 'spin' ? { ...s, phase: 'spinning', announcement: null } : s;

    case 'spinResult': {
      if (s.phase !== 'spinning') return s;
      const sec = a.section;
      let next: GameState = { ...s, lastSpin: { sectionIndex: a.sectionIndex, section: sec } };
      next = log(next, { type: 'spin', playerId: player.id, sectionId: sec.id, at: ctx.now });

      switch (sec.type) {
        case 'points':
          return announce({ ...next, phase: 'guess', pending: { kind: 'points', value: sec.value ?? 0 } }, `${sec.value} очков! Назовите букву`);
        case 'multiplier':
          return announce(
            { ...next, phase: 'guess', pending: { kind: 'multiplier', factor: sec.value ?? 2 } },
            `Множитель ×${sec.value ?? 2}! Угадайте букву — и очки раунда умножатся`,
          );
        case 'mystery':
          return announce(
            { ...next, phase: 'guess', hintShown: true, pending: { kind: 'points', value: sec.value ?? 500 } },
            `Загадка! Открыта подсказка, буква стоит ${sec.value ?? 500} очков`,
          );
        case 'bankrupt': {
          next = log(next, { type: 'bankrupt', playerId: player.id, lost: player.roundScore, at: ctx.now });
          next = updatePlayer(next, s.currentPlayerIndex, { roundScore: 0 });
          return passTurn(next, ctx, 'Банкрот! Очки сгорели.');
        }
        case 'skip':
          return passTurn(log(next, { type: 'skip', playerId: player.id, at: ctx.now }), ctx, 'Переход хода.');
        case 'plus':
          return announce({ ...next, phase: 'plusPick' }, 'Сектор «+»! Откройте любую букву на табло', 'good');
        case 'prize':
          return announce(
            { ...next, phase: 'prizeChoice', pending: { kind: 'points', value: sec.value ?? 500 } },
            `Сектор «Приз»: ${sec.prizeName ?? 'приз'}. Забираете или играете?`,
            'good',
          );
      }
      return next;
    }

    case 'letter': {
      if (s.phase !== 'guess' || !s.pending) return s;
      const letter = normalizeLetter(a.letter);
      if (!isPlayable(letter, settings.alphabet)) return s;
      if (round.guessedLetters.some((g) => g.letter === letter)) {
        return passTurn(s, ctx, `Букву «${letter}» уже называли.`);
      }
      const [r2, count] = revealLetter(round, letter);
      const guess = { letter, playerId: player.id, correct: count > 0, count };
      let next: GameState = { ...s, round: { ...r2, guessedLetters: [...round.guessedLetters, guess] } };

      if (count === 0) {
        next = log(next, { type: 'letter', playerId: player.id, letter, count: 0, points: 0, at: ctx.now });
        return passTurn(next, ctx, `Нет буквы «${letter}».`);
      }

      const before = player.roundScore;
      // Множитель умножает очки раунда, но даёт не меньше 100×N за каждую букву —
      // иначе при пустом счёте «×2» превращался бы в «+0»
      const after =
        s.pending.kind === 'points'
          ? before + s.pending.value * count
          : Math.max(before * s.pending.factor, before + MULTIPLIER_MIN_PER_LETTER * s.pending.factor * count);
      next = updatePlayer(next, s.currentPlayerIndex, { roundScore: after });
      next = log(next, { type: 'letter', playerId: player.id, letter, count, points: after - before, at: ctx.now });

      if (hiddenCount(next.round!) === 0) {
        return winRound(next, ctx, `${player.name} открывает слово! +${after - before}`);
      }
      next = { ...next, phase: 'spin', pending: null };
      return announce(
        next,
        `Есть буква «${letter}»! ${count} ${plural(count, 'буква', 'буквы', 'букв')}, +${after - before}. Крутите ещё`,
        'good',
      );
    }

    case 'word': {
      if (!settings.allowFullWordGuess || (s.phase !== 'guess' && s.phase !== 'spin')) return s;
      const correct = lettersOnly(a.word, settings.alphabet) === lettersOnly(round.answer, settings.alphabet);
      let next = log(s, { type: 'word', playerId: player.id, word: normalizeAnswer(a.word), correct, at: ctx.now });
      if (correct) {
        const bonus = hiddenCount(round) * settings.fullWordBonusPerLetter;
        next = updatePlayer(next, s.currentPlayerIndex, { roundScore: player.roundScore + bonus });
        return winRound(next, ctx, `Абсолютно верно! ${player.name} угадывает слово целиком, бонус +${bonus}`);
      }
      if (settings.wrongWordEliminates && s.players.length > 1) {
        next = { ...next, round: { ...round, eliminatedPlayerIds: [...round.eliminatedPlayerIds, player.id] } };
        next = updatePlayer(next, s.currentPlayerIndex, { roundScore: 0 });
        return passTurn(next, ctx, `Неверно! ${player.name} выбывает из раунда.`);
      }
      return passTurn(next, ctx, 'Неверное слово.');
    }

    case 'plusPick': {
      if (s.phase !== 'plusPick' || round.revealed[a.position]) return s;
      const letter = round.answer[a.position];
      const [r2, count] = revealLetter(round, letter);
      let next: GameState = {
        ...s,
        round: { ...r2, guessedLetters: [...round.guessedLetters, { letter, playerId: player.id, correct: true, count }] },
      };
      next = log(next, { type: 'plus', playerId: player.id, letter, at: ctx.now });
      if (hiddenCount(next.round!) === 0) return winRound(next, ctx, `${player.name} открывает слово!`);
      return announce({ ...next, phase: 'spin', pending: null }, `Открыта буква «${letter}». Крутите барабан`, 'good');
    }

    case 'prizeDecision': {
      if (s.phase !== 'prizeChoice') return s;
      if (!a.take) return announce({ ...s, phase: 'guess' }, 'Играем! Назовите букву');
      const prize = s.lastSpin?.section.prizeName ?? 'Приз';
      let next = updatePlayer(s, s.currentPlayerIndex, { prizes: [...player.prizes, prize] });
      next = log(next, { type: 'prize', playerId: player.id, prize, at: ctx.now });
      // Как в передаче: взявший приз выходит из раунда
      next = { ...next, round: { ...round, eliminatedPlayerIds: [...round.eliminatedPlayerIds, player.id] } };
      return passTurn(next, ctx, `${player.name} забирает «${prize}» и покидает раунд.`);
    }

    case 'timeout':
    case 'skipTurn': {
      if (!TURN_PHASES.has(s.phase)) return s;
      const next = log(s, { type: a.type === 'timeout' ? 'timeout' : 'skip', playerId: player.id, at: ctx.now });
      return passTurn(next, ctx, a.type === 'timeout' ? 'Время вышло!' : 'Ведущий передаёт ход.');
    }

    case 'revealHint':
      return s.hintShown ? s : announce({ ...s, hintShown: true }, 'Ведущий открывает подсказку');

    case 'nextRound': {
      if (s.phase !== 'roundOver') return s;
      const nextQ = s.questionQueue.map((id) => ctx.questions.get(id)).find(Boolean);
      if (round.index + 1 >= settings.rounds || !nextQ) {
        const best = [...s.players].sort((x, y) => y.totalScore - x.totalScore)[0];
        const next = log({ ...s, phase: 'gameOver' }, { type: 'gameWin', playerId: best.id, at: ctx.now });
        return announce(next, `Победитель — ${best.name}: ${best.totalScore} очков!`, 'win');
      }
      const idx = round.index + 1;
      const starter = idx % s.players.length;
      const next: GameState = {
        ...s,
        round: createRound(nextQ, idx, settings.alphabet),
        questionQueue: s.questionQueue.filter((id) => id !== nextQ.id),
        players: s.players.map((p) => ({ ...p, roundScore: 0 })),
        currentPlayerIndex: starter,
        phase: 'spin',
        pending: null,
        lastSpin: null,
        hintShown: false,
      };
      return announce(next, `Раунд ${idx + 1}. Ход игрока ${s.players[starter].name}`);
    }
  }
}
