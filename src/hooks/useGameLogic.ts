import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent, MediaUrl, SoundKey, Wheel } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { useWheel } from './useWheel';
import { useAudio } from './useAudio';
import { botMove } from '@/utils/bot';

const TURN_PHASES = new Set(['spin', 'guess', 'plusPick', 'prizeChoice']);

function soundFor(e: GameEvent): SoundKey | null {
  switch (e.type) {
    case 'letter':
      return e.count > 0 ? 'correct' : 'wrong';
    case 'plus':
      return 'correct';
    case 'word':
      return e.correct ? null : 'wrong'; // победный звук даст roundWin
    case 'bankrupt':
      return 'bankrupt';
    case 'skip':
    case 'timeout':
      return 'turn';
    case 'prize':
    case 'roundWin':
    case 'gameWin':
      return 'win';
    case 'roundLost':
      return 'wrong';
    default:
      return null;
  }
}

/**
 * Связывает чистую логику (store) с «железом»: барабан, таймер хода, бот, звуки.
 */
export function useGameLogic(wheel: Wheel, sounds?: Partial<Record<SoundKey, MediaUrl>>, soundOn = true) {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const { wheelRef, spin, spinning } = useWheel(wheel);
  const { play } = useAudio(sounds, soundOn);
  const [timeFraction, setTimeFraction] = useState<number | null>(null);

  const current = game ? game.players[game.currentPlayerIndex] : null;
  const isBotTurn = !!current?.isBot && game?.settings.mode !== 'host';

  /* ---- вращение: исход считается до анимации, логика узнаёт его после остановки */
  const doSpin = useCallback(async () => {
    const g = useGameStore.getState().game;
    if (!g || g.phase !== 'spin' || !wheelRef.current || wheelRef.current.isSpinning()) return;
    dispatch({ type: 'spinStart' });
    const r = await spin();
    if (r) dispatch({ type: 'spinResult', sectionIndex: r.sectionIndex, section: r.section });
  }, [dispatch, spin, wheelRef]);

  /* ---- звуки по событиям лога */
  const logLen = useRef(0);
  useEffect(() => {
    const log = game?.log ?? [];
    for (const e of log.slice(logLen.current)) {
      const k = soundFor(e);
      if (k) play(k);
    }
    logLen.current = log.length;
  }, [game?.log, play]);

  /* ---- таймер хода (на ботов и во время вращения не действует) */
  useEffect(() => {
    if (!game || !game.settings.turnTimer.enabled || !TURN_PHASES.has(game.phase) || isBotTurn) {
      setTimeFraction(null);
      return;
    }
    const total = game.settings.turnTimer.seconds * 1000;
    const startedAt = game.turnStartedAt;
    const tick = () => {
      const left = total - (Date.now() - startedAt);
      setTimeFraction(Math.max(0, left / total));
      if (left <= 0) {
        // проверяем, что ход всё ещё тот же
        if (useGameStore.getState().game?.turnStartedAt === startedAt) dispatch({ type: 'timeout' });
        return true;
      }
      return false;
    };
    tick();
    const id = window.setInterval(() => tick() && window.clearInterval(id), 200);
    return () => window.clearInterval(id);
    // только поля хода: иначе интервал пересоздавался бы на каждое изменение партии
  }, [game?.phase, game?.turnStartedAt, game?.settings.turnTimer, isBotTurn, dispatch]);

  /* ---- бот: «думает» 0.9–1.6 с, затем ходит */
  useEffect(() => {
    if (!game || !isBotTurn || !TURN_PHASES.has(game.phase)) return;
    const id = window.setTimeout(() => {
      const g = useGameStore.getState().game;
      if (!g) return;
      const move = botMove(g);
      if (!move) return;
      if (move.type === 'spin') void doSpin();
      else dispatch(move);
    }, 900 + Math.random() * 700);
    return () => window.clearTimeout(id);
  }, [game?.phase, game?.currentPlayerIndex, game?.turnStartedAt, game?.round?.index, isBotTurn, doSpin, dispatch]);

  return { game, dispatch, wheelRef, doSpin, spinning, timeFraction, isBotTurn, current, play };
}
