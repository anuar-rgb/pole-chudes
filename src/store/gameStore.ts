import { create } from 'zustand';
import type { GameSettings, GameState, Question } from '@/types/game';
import { createGame, gameReducer, type GameAction, type PlayerDraft } from '@/utils/gameLogic';
import { useDataStore } from './dataStore';

interface GameStore {
  /** Снимок вопросов на момент старта — правки в админке не ломают идущую партию */
  questions: Question[];
  game: GameState | null;
  error: string | null;
  start(settings: GameSettings, players: PlayerDraft[]): void;
  dispatch(action: GameAction): void;
  exit(): void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  questions: [],
  game: null,
  error: null,

  start(settings, players) {
    const questions = useDataStore.getState().questions;
    try {
      set({ game: createGame(settings, players, questions), questions, error: null });
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
