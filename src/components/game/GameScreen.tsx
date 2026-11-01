import { useMemo, useState } from 'react';
import { Dices, Eye, EyeOff, Gift, Lightbulb, LogOut, MessageSquareText, SkipForward, Trophy } from 'lucide-react';
import type { Theme, Wheel } from '@/types/game';
import { selectQuestion, useGameStore } from '@/store/gameStore';
import { useDataStore } from '@/store/dataStore';
import { useGameLogic } from '@/hooks/useGameLogic';
import { WheelCanvas } from './WheelCanvas';
import { WordBoard } from './WordBoard';
import { Keyboard } from './Keyboard';
import { PlayerCard } from './PlayerCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const TONE: Record<string, string> = {
  info: 'text-[var(--c-text)]',
  good: 'text-[var(--c-success)]',
  bad: 'text-[var(--c-danger)]',
  win: 'text-[var(--c-accent)]',
};

export function GameScreen({ wheel, theme, soundOn }: { wheel: Wheel; theme: Theme; soundOn: boolean }) {
  const { game, dispatch, wheelRef, doSpin, spinning, timeFraction, isBotTurn, current } = useGameLogic(
    wheel,
    theme.sounds,
    soundOn,
  );
  const question = useGameStore(selectQuestion);
  const category = useDataStore((s) => s.categories.find((c) => c.id === question?.categoryId));
  const exit = useGameStore((s) => s.exit);
  const start = useGameStore((s) => s.start);

  const [wordOpen, setWordOpen] = useState(false);
  const [word, setWord] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  const ranking = useMemo(() => (game ? [...game.players].sort((a, b) => b.totalScore - a.totalScore) : []), [game]);

  if (!game || !game.round || !current) return null;
  const { round, phase, settings } = game;
  const isHost = settings.mode === 'host';
  // В режиме ведущего вводит буквы ведущий, поэтому ввод доступен всегда, кроме ходов бота
  const humanTurn = !isBotTurn;
  const canSpin = phase === 'spin' && humanTurn && !spinning;
  const canWord = settings.allowFullWordGuess && humanTurn && (phase === 'spin' || phase === 'guess');
  const eliminated = new Set(round.eliminatedPlayerIds);

  const submitWord = () => {
    if (!word.trim()) return;
    dispatch({ type: 'word', word });
    setWord('');
    setWordOpen(false);
  };

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      {/* ---------- Табло, объявление, ввод.
          На мобильном section/aside «растворяются» (contents), и блоки обеих колонок
          выстраиваются по order: табло → барабан → клавиатура — без лишней прокрутки. */}
      <section className="flex min-w-0 flex-col gap-4 max-lg:contents lg:col-start-2 lg:row-start-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--c-muted)] max-lg:order-1">
          <span>
            Раунд <b className="text-[var(--c-text)]">{round.index + 1}</b> из {settings.rounds}
            {category && <> · {category.name}</>}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setConfirmExit(true)}>
            <LogOut size={16} /> Выйти
          </Button>
        </div>

        <div className="panel flex flex-col gap-5 p-4 max-lg:order-3 sm:p-6">
          <div className="flex gap-4">
            {question?.image && (
              <img src={question.image} alt="" className="h-24 w-24 shrink-0 rounded-[var(--radius)] object-cover sm:h-32 sm:w-32" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-snug sm:text-xl">{question?.prompt}</p>
              {question?.audio && <audio key={question.id} controls src={question.audio} className="mt-2 h-9 w-full max-w-xs" />}
              {game.hintShown && question?.hint && (
                <p className="pop-in mt-2 flex items-start gap-2 text-[var(--c-muted)]">
                  <Lightbulb size={18} className="mt-0.5 shrink-0 text-[var(--c-accent)]" /> {question.hint}
                </p>
              )}
            </div>
          </div>
          <WordBoard
            round={round}
            alphabet={settings.alphabet}
            pickable={phase === 'plusPick' && humanTurn}
            onPick={(position) => dispatch({ type: 'plusPick', position })}
          />
        </div>

        <div aria-live="polite" className="min-h-[3.5rem] text-center max-lg:order-4">
          {game.announcement && (
            <p key={game.announcement.seq} className={`pop-in text-xl font-black sm:text-2xl ${TONE[game.announcement.tone]}`}>
              {game.announcement.text}
            </p>
          )}
          {isBotTurn && phase !== 'spinning' && phase !== 'roundOver' && phase !== 'gameOver' && (
            <p className="mt-1 animate-pulse text-sm text-[var(--c-muted)]">{current.name} думает…</p>
          )}
        </div>

        {phase === 'prizeChoice' && humanTurn ? (
          <div className="panel pop-in flex flex-col items-center gap-3 p-5 text-center max-lg:order-7">
            <Gift size={36} className="text-[var(--c-accent)]" />
            <p className="text-lg">
              Приз: <b>{game.lastSpin?.section.prizeName ?? 'сюрприз'}</b>. Если заберёте — выйдете из раунда.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => dispatch({ type: 'prizeDecision', take: true })}>Забрать приз</Button>
              <Button variant="secondary" onClick={() => dispatch({ type: 'prizeDecision', take: false })}>
                Играть дальше
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-lg:order-7">
            <Keyboard
              guessed={round.guessedLetters}
              enabled={phase === 'guess' && humanTurn}
              onLetter={(letter) => dispatch({ type: 'letter', letter })}
            />
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2 max-lg:order-8">
          {settings.allowFullWordGuess && (
            <Button variant="secondary" disabled={!canWord} onClick={() => setWordOpen(true)}>
              <MessageSquareText size={18} /> Назвать слово
            </Button>
          )}
        </div>

        {isHost && (
          <div className="panel flex flex-col gap-3 p-4 max-lg:order-9">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Пульт ведущего</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowAnswer((v) => !v)}>
                {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />} {showAnswer ? 'Скрыть ответ' : 'Показать ответ'}
              </Button>
            </div>
            {showAnswer && <p className="font-mono text-2xl font-black tracking-widest text-[var(--c-accent)]">{round.answer}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={game.hintShown || !question?.hint} onClick={() => dispatch({ type: 'revealHint' })}>
                <Lightbulb size={16} /> Открыть подсказку
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!['spin', 'guess', 'plusPick', 'prizeChoice'].includes(phase)}
                onClick={() => dispatch({ type: 'skipTurn' })}
              >
                <SkipForward size={16} /> Передать ход
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Барабан и игроки */}
      <aside className="flex min-w-0 flex-col items-center gap-4 max-lg:contents lg:col-start-1 lg:row-start-1">
        <div className={`grid w-full gap-2 max-lg:order-2 ${game.players.length > 2 ? 'grid-cols-2' : game.players.length === 2 ? 'grid-cols-2 lg:grid-cols-1' : 'grid-cols-1'}`}>
          {game.players.map((p, i) => (
            <PlayerCard
              key={p.id}
              player={p}
              active={i === game.currentPlayerIndex && phase !== 'roundOver' && phase !== 'gameOver'}
              eliminated={eliminated.has(p.id)}
              timeFraction={i === game.currentPlayerIndex ? timeFraction : null}
            />
          ))}
        </div>
        <div className="w-full max-w-[440px] justify-self-center max-lg:order-5 max-lg:max-w-[340px]">
          <WheelCanvas
            ref={wheelRef}
            wheel={wheel}
            highlightIndex={phase === 'spinning' ? null : game.lastSpin?.sectionIndex ?? null}
            onHubClick={canSpin ? () => void doSpin() : undefined}
            hubLabel={canSpin ? 'КРУТИ' : ''}
          />
        </div>
        <Button size="lg" className="justify-self-center max-lg:order-6" disabled={!canSpin} onClick={() => void doSpin()}>
          <Dices size={22} /> {spinning ? 'Крутится…' : 'Крутить барабан'}
        </Button>
      </aside>

      {/* ---------- Модальные окна */}
      <Modal open={wordOpen} title="Назвать слово целиком" onClose={() => setWordOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitWord();
          }}
          className="flex flex-col gap-3"
        >
          <input
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Ваш ответ"
            className="h-12 rounded-[var(--radius)] border border-white/15 bg-[var(--c-surface-alt)] px-4 text-lg uppercase text-[var(--c-text)]"
          />
          {settings.wrongWordEliminates && game.players.length > 1 && (
            <p className="text-sm text-[var(--c-danger)]">Если ответ неверный — {current.name} выбывает из раунда.</p>
          )}
          <Button type="submit" disabled={!word.trim()}>
            Ответить
          </Button>
        </form>
      </Modal>

      <Modal open={phase === 'roundOver'} title={round.winnerId ? 'Раунд выигран!' : 'Раунд окончен'}>
        <p className="mb-1 text-sm text-[var(--c-muted)]">Ответ</p>
        <p className="mb-4 text-3xl font-black tracking-wide text-[var(--c-accent)]">{round.answer}</p>
        {round.winnerId && (
          <p className="mb-4">
            Победитель раунда: <b>{game.players.find((p) => p.id === round.winnerId)?.name}</b> — очки раунда идут в общий зачёт.
          </p>
        )}
        <Scores players={ranking} />
        <Button className="mt-5 w-full" onClick={() => dispatch({ type: 'nextRound' })}>
          {round.index + 1 >= settings.rounds ? 'Итоги игры' : 'Следующий раунд'}
        </Button>
      </Modal>

      <Modal open={phase === 'gameOver'} title="Игра окончена">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <Trophy size={48} className="text-[var(--c-accent)]" />
          <p className="text-2xl font-black">{ranking[0]?.name}</p>
          <p className="text-[var(--c-muted)]">{ranking[0]?.totalScore} очков</p>
        </div>
        <Scores players={ranking} />
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={exit}>
            В меню
          </Button>
          <Button
            onClick={() =>
              start(
                settings,
                game.players.map((p) => ({ name: p.name, color: p.color, isBot: p.isBot, botLevel: p.botLevel })),
              )
            }
          >
            Ещё раз
          </Button>
        </div>
      </Modal>

      <Modal open={confirmExit} title="Выйти из игры?" onClose={() => setConfirmExit(false)}>
        <p className="mb-5 text-[var(--c-muted)]">Прогресс текущей партии будет потерян.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setConfirmExit(false)}>
            Остаться
          </Button>
          <Button variant="danger" onClick={exit}>
            Выйти
          </Button>
        </div>
      </Modal>
    </main>
  );
}

function Scores({ players }: { players: { id: string; name: string; color: string; totalScore: number; prizes: string[] }[] }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {players.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 rounded-[var(--radius)] bg-white/5 px-3 py-2">
          <span className="w-5 text-center font-black text-[var(--c-muted)]">{i + 1}</span>
          <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
          <span className="flex-1 font-semibold">{p.name}</span>
          {p.prizes.length > 0 && <Gift size={16} className="text-[var(--c-accent)]" aria-label={`Призов: ${p.prizes.length}`} />}
          <span className="font-black tabular-nums">{p.totalScore}</span>
        </li>
      ))}
    </ol>
  );
}
