import { create } from 'zustand';
import type { Category, GameSettings, GameState, Question } from '@/types/game';
import { createGame, gameReducer, type GameAction, type PlayerDraft } from '@/utils/gameLogic';
import { DEMO_CATEGORIES, DEMO_QUESTIONS } from '@/data/questions';

interface GameStore {
  categories: Category[];
  questions: Question[];
  game: GameState | null;
  error: string | null;
  start(settings: GameSettings, players: PlayerDraft[]): void;
  dispatch(action: GameAction): void;
  exit(): void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  categories: DEMO_CATEGORIES,
  questions: DEMO_QUESTIONS,
  game: null,
  error: null,

  start(settings, players) {
    try {
      set({ game: createGame(settings, players, get().questions), error: null });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  dispatch(action) {
    const { game, questions } = get();
    if (!game) return;
    const next = gameReducer(game, action, { now: Date.now(), questions: new Map(questions.map((q) => [q.id, q])) });
    if (next !== game) set({ game: next });
  },

  exit() {
    set({ game: null });
  },
}));

export const selectQuestion = (s: GameStore) =>
  s.game?.round ? s.questions.find((q) => q.id === s.game!.round!.questionId) ?? null : null;
