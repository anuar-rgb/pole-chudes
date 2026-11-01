import { describe, expect, it } from 'vitest';
import type { GameSettings, Question, WheelSection } from '@/types/game';
import { createGame, gameReducer, RU_ALPHABET, type GameAction } from './gameLogic';
import { botMove } from './bot';

const questions: Question[] = [
  { id: 'q1', categoryId: 'c', answer: 'Ёлка-палка', prompt: 'p', difficulty: 'easy' },
  { id: 'q2', categoryId: 'c', answer: 'Кот', prompt: 'p', difficulty: 'easy' },
];
const qmap = new Map(questions.map((q) => [q.id, q]));

const settings: GameSettings = {
  mode: 'local',
  wheelId: 'w',
  themeId: 't',
  categoryIds: [],
  rounds: 2,
  turnTimer: { enabled: false, seconds: 30 },
  allowFullWordGuess: true,
  wrongWordEliminates: true,
  fullWordBonusPerLetter: 100,
  alphabet: RU_ALPHABET,
};

const sec = (type: WheelSection['type'], value?: number): WheelSection => ({
  id: type,
  type,
  label: type,
  value,
  weight: 1,
  fill: { kind: 'solid', color: '#000' },
});

function setup(answerId = 'q1', players = 2) {
  let g = createGame(settings, Array.from({ length: players }, (_, i) => ({ name: `P${i}`, color: '#fff' })), questions);
  // фиксируем вопрос, чтобы тест не зависел от перемешивания
  const q = qmap.get(answerId)!;
  g = { ...g, round: { ...g.round!, questionId: q.id, answer: q.answer.toUpperCase().replace('Ё', 'Е'), revealed: [...q.answer].map((c) => c === '-') }, questionQueue: questions.filter((x) => x.id !== answerId).map((x) => x.id) };
  const run = (...actions: GameAction[]) => {
    for (const a of actions) g = gameReducer(g, a, { now: 1, questions: qmap });
    return g;
  };
  return { run, get: () => g };
}

const spin = (s: WheelSection): GameAction[] => [{ type: 'spinStart' }, { type: 'spinResult', sectionIndex: 0, section: s }];

describe('gameLogic', () => {
  it('Ё нормализуется в Е, дефис открыт сразу', () => {
    const { get } = setup();
    expect(get().round!.answer).toBe('ЕЛКА-ПАЛКА');
    expect(get().round!.revealed[4]).toBe(true);
  });

  it('верная буква: очки × количество, ход остаётся', () => {
    const { run } = setup();
    const g = run(...spin(sec('points', 300)), { type: 'letter', letter: 'а' });
    expect(g.players[0].roundScore).toBe(900); // три «А»
    expect(g.currentPlayerIndex).toBe(0);
    expect(g.phase).toBe('spin');
  });

  it('неверная буква передаёт ход', () => {
    const { run } = setup();
    const g = run(...spin(sec('points', 300)), { type: 'letter', letter: 'Я' });
    expect(g.currentPlayerIndex).toBe(1);
    expect(g.round!.guessedLetters[0].correct).toBe(false);
  });

  it('банкрот обнуляет очки раунда и передаёт ход', () => {
    const { run } = setup();
    run(...spin(sec('points', 300)), { type: 'letter', letter: 'К' });
    const g = run(...spin(sec('bankrupt')));
    expect(g.players[0].roundScore).toBe(0);
    expect(g.currentPlayerIndex).toBe(1);
  });

  it('множитель умножает очки раунда', () => {
    const { run } = setup();
    run(...spin(sec('points', 100)), { type: 'letter', letter: 'Л' }); // 2 × 100
    const g = run(...spin(sec('multiplier', 3)), { type: 'letter', letter: 'П' });
    expect(g.players[0].roundScore).toBe(600);
  });

  it('множитель при пустом счёте даёт минимум 100×N за букву', () => {
    const { run } = setup();
    const g = run(...spin(sec('multiplier', 2)), { type: 'letter', letter: 'А' }); // 3 буквы
    expect(g.players[0].roundScore).toBe(600);
  });

  it('сектор «+» открывает выбранную букву без очков', () => {
    const { run } = setup();
    const g = run(...spin(sec('plus')), { type: 'plusPick', position: 0 });
    expect(g.round!.revealed[0]).toBe(true);
    expect(g.players[0].roundScore).toBe(0);
    expect(g.phase).toBe('spin');
  });

  it('слово целиком: бонус за скрытые буквы и победа в раунде', () => {
    const { run } = setup();
    const g = run(...spin(sec('points', 100)), { type: 'word', word: 'ёлка палка' });
    expect(g.phase).toBe('roundOver');
    expect(g.players[0].totalScore).toBe(900); // 9 скрытых букв × 100
  });

  it('неверное слово — выбывание; когда выбыли все, раунд проигран', () => {
    const { run } = setup();
    let g = run({ type: 'word', word: 'нет' });
    expect(g.round!.eliminatedPlayerIds).toEqual(['p1']);
    expect(g.currentPlayerIndex).toBe(1);
    g = run({ type: 'word', word: 'нет' });
    expect(g.phase).toBe('roundOver');
    expect(g.round!.winnerId).toBeUndefined();
  });

  it('последняя буква выигрывает раунд, затем игра заканчивается', () => {
    const { run } = setup('q2', 1);
    run(...spin(sec('points', 100)), { type: 'letter', letter: 'К' });
    run(...spin(sec('points', 100)), { type: 'letter', letter: 'О' });
    let g = run(...spin(sec('points', 500)), { type: 'letter', letter: 'Т' });
    expect(g.phase).toBe('roundOver');
    expect(g.players[0].totalScore).toBe(700);
    g = run({ type: 'nextRound' });
    expect(g.phase).toBe('spin');
    expect(g.round!.index).toBe(1);
    expect(g.players[0].roundScore).toBe(0);
  });

  it('приз: игрок забирает его и выбывает из раунда', () => {
    const { run } = setup();
    const g = run(...spin({ ...sec('prize'), prizeName: 'Чайник' }), { type: 'prizeDecision', take: true });
    expect(g.players[0].prizes).toEqual(['Чайник']);
    expect(g.round!.eliminatedPlayerIds).toContain('p1');
    expect(g.currentPlayerIndex).toBe(1);
  });

  it('в соло таймаут перезапускает таймер хода', () => {
    const { run, get } = setup('q1', 1);
    const before = get().turnStartedAt;
    const g = gameReducer(get(), { type: 'timeout' }, { now: before + 5000, questions: qmap });
    expect(g.currentPlayerIndex).toBe(0);
    expect(g.turnStartedAt).toBe(before + 5000);
    void run;
  });

  it('действия вне своей фазы игнорируются', () => {
    const { run, get } = setup();
    const before = get();
    expect(run({ type: 'letter', letter: 'А' })).toBe(before);
    expect(run({ type: 'nextRound' })).toBe(before);
  });

  it('бот всегда делает допустимый ход', () => {
    for (let i = 0; i < 200; i++) {
      const { run } = setup();
      let g = run();
      g = { ...g, players: g.players.map((p) => ({ ...p, isBot: true, botLevel: 'hard' })) };
      const m = botMove({ ...g, phase: 'guess', pending: { kind: 'points', value: 100 } });
      expect(m).not.toBeNull();
      if (m!.type === 'letter') expect(RU_ALPHABET).toContain(m!.letter);
    }
  });
});
