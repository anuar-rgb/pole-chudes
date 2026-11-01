/**
 * Базовые типы игры «Поле чудес».
 * Эти же структуры хранятся в БД (server/prisma/schema.prisma) и передаются через API,
 * поэтому все идентификаторы — строки, а даты — ISO-строки.
 */

export type ID = string;
export type ISODate = string;
/** Любой CSS-цвет: #hex, rgb(), hsl() */
export type Color = string;
/** Путь к медиа: /uploads/..., /assets/... или внешний URL */
export type MediaUrl = string;

/* ============================================================
 * Барабан
 * ============================================================ */

export type SectionType =
  | 'points' //      Обычные очки
  | 'prize' //       Приз (предмет / бонус)
  | 'bankrupt' //    Банкрот — очки игрока сгорают
  | 'plus' //        Сектор «+» — игрок открывает любую букву по номеру
  | 'skip' //        Переход хода
  | 'multiplier' //  Множитель (x2, x3) к очкам за букву
  | 'mystery'; //    Загадка / спец-сектор (вопрос, ключи, шкатулки)

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  points: 'Очки',
  prize: 'Приз',
  bankrupt: 'Банкрот',
  plus: 'Сектор «+»',
  skip: 'Переход хода',
  multiplier: 'Множитель',
  mystery: 'Загадка',
};

/** Заливка сектора: сплошной цвет или линейный градиент вдоль радиуса */
export type SectionFill =
  | { kind: 'solid'; color: Color }
  | { kind: 'gradient'; from: Color; to: Color };

export interface SectionImage {
  url: MediaUrl;
  /** cover — фон на весь сектор, icon — небольшая иконка у обода */
  mode: 'cover' | 'icon';
  /** 0..1 */
  opacity?: number;
}

export interface WheelSection {
  id: ID;
  type: SectionType;
  /** Подпись на секторе («500», «Б», «x2», «ПРИЗ») */
  label: string;
  /**
   * Значение сектора:
   *  points     — очки за каждую открытую букву
   *  multiplier — коэффициент
   *  prize      — опционально стоимость приза в очках
   */
  value?: number;
  /** Название приза или описание спец-сектора */
  prizeName?: string;
  fill: SectionFill;
  textColor?: Color;
  image?: SectionImage;
  /** Вес выпадения (> 0). Вероятность = weight / сумма весов */
  weight: number;
  /** Привязка картинки-подсказки / вопроса к сектору (для mystery) */
  questionId?: ID;
}

export interface WheelStyle {
  /** Цвет и толщина разделительных линий между секторами */
  dividerColor: Color;
  dividerWidth: number;
  /** Внешний обод */
  rimColor: Color;
  rimWidth: number;
  /** Лампочки на ободе */
  showLights: boolean;
  lightColor: Color;
  /** Центральная ступица */
  hubColor: Color;
  hubImage?: MediaUrl;
  /** Стрелка-указатель */
  pointerColor: Color;
  fontFamily: string;
  /** Текст вдоль радиуса (классика) или по касательной */
  labelOrientation: 'radial' | 'tangential';
}

export interface SpinPhysics {
  /** Длительность вращения, мс */
  durationMs: number;
  /** Мин./макс. число полных оборотов до остановки */
  minTurns: number;
  maxTurns: number;
  /**
   * Насколько далеко от центра сектора может остановиться стрелка (0..0.5 ширины сектора).
   * 0 — ровно в центре, 0.45 — почти у края (натуральнее).
   */
  landingJitter: number;
}

export interface Wheel {
  id: ID;
  name: string;
  description?: string;
  /** От 6 до 24 */
  sections: WheelSection[];
  style: WheelStyle;
  physics: SpinPhysics;
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

export const WHEEL_MIN_SECTIONS = 6;
export const WHEEL_MAX_SECTIONS = 24;

/** Результат вращения — рассчитывается заранее (сервером или клиентом), колесо лишь анимирует его */
export interface SpinResult {
  sectionIndex: number;
  section: WheelSection;
  /** Итоговый абсолютный угол поворота колеса (рад), с которым надо закончить анимацию */
  targetRotation: number;
  /** Случайный seed / id для аудита на сервере */
  spinId?: ID;
}

/* ============================================================
 * Вопросы и категории
 * ============================================================ */

export interface Category {
  id: ID;
  name: string; //  «Картины эпохи Возрождения», «Казахская история»
  description?: string;
  coverImage?: MediaUrl;
  /** Тема оформления по умолчанию для категории */
  themeId?: ID;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: ID;
  categoryId: ID;
  /** Загаданное слово / фраза. Пробелы и дефисы показываются сразу */
  answer: string;
  /** Текст задания ведущего */
  prompt: string;
  /** Дополнительная подсказка (может открываться за очки) */
  hint?: string;
  image?: MediaUrl;
  audio?: MediaUrl;
  difficulty: Difficulty;
  /** Барабан, который используется для этого вопроса (иначе — барабан игры) */
  wheelId?: ID;
  createdAt?: ISODate;
}

/* ============================================================
 * Темы оформления
 * ============================================================ */

export type SoundKey = 'spinTick' | 'correct' | 'wrong' | 'bankrupt' | 'win' | 'turn';

export interface ThemeColors {
  background: Color;
  surface: Color;
  surfaceAlt: Color;
  text: Color;
  textMuted: Color;
  accent: Color;
  accentText: Color;
  /** Закрытая плашка буквы */
  tileBack: Color;
  /** Открытая плашка буквы */
  tileFront: Color;
  tileText: Color;
  danger: Color;
  success: Color;
}

export interface Theme {
  id: ID;
  name: string; // «Классика», «Киберпанк», «Древний Египет»
  preset?: boolean; // встроенная тема, нельзя удалить
  colors: ThemeColors;
  fontFamily: string;
  headingFontFamily?: string;
  /** Фон игрового поля */
  backgroundImage?: MediaUrl;
  backgroundOverlay?: Color; // полупрозрачная заливка поверх фона
  /** Переопределение стиля барабана */
  wheelStyle?: Partial<WheelStyle>;
  /** Палитра, из которой берутся цвета секторов при авто-раскраске */
  sectionPalette: Color[];
  /** Звуковая тема; отсутствующие ключи — синтезированные звуки по умолчанию */
  sounds?: Partial<Record<SoundKey, MediaUrl>>;
  borderRadius: number; // px
}

/* ============================================================
 * Игроки и партия
 * ============================================================ */

export type GameMode =
  | 'solo' //  Один игрок
  | 'vsBot' //  Против бота
  | 'local' //  Локальный мультиплеер (2–4 игрока за одним экраном)
  | 'host'; //  Ведущий управляет, участники смотрят на общий экран

export type BotLevel = 'easy' | 'medium' | 'hard';

export interface Player {
  id: ID;
  name: string;
  color: Color;
  avatar?: MediaUrl;
  isBot?: boolean;
  botLevel?: BotLevel;
  /** Очки в текущем раунде (сгорают при банкроте) */
  roundScore: number;
  /** Очки за всю игру */
  totalScore: number;
  prizes: string[];
}

export interface GameSettings {
  mode: GameMode;
  wheelId: ID;
  themeId: ID;
  categoryIds: ID[];
  rounds: number;
  turnTimer: { enabled: boolean; seconds: number };
  /** Разрешено ли угадывать слово целиком */
  allowFullWordGuess: boolean;
  /** Штраф за неверное слово целиком: игрок выбывает из раунда */
  wrongWordEliminates: boolean;
  /** Очки за угадывание слова целиком: за каждую неоткрытую букву */
  fullWordBonusPerLetter: number;
  /** Буквы, которые разрешены (по умолчанию — русский алфавит) */
  alphabet: string;
}

export type TurnPhase =
  | 'idle' //       Ожидание старта
  | 'spin' //       Игрок должен крутить барабан
  | 'spinning' //   Барабан крутится
  | 'guess' //      Игрок называет букву / слово
  | 'plusPick' //   Сектор «+»: выбор позиции буквы
  | 'prizeChoice' // Сектор «Приз»: взять приз или играть дальше
  | 'roundOver'
  | 'gameOver';

export interface LetterGuess {
  letter: string;
  playerId: ID;
  correct: boolean;
  count: number;
}

export interface RoundState {
  index: number;
  questionId: ID;
  /** Нормализованное слово в верхнем регистре (Ё → Е) */
  answer: string;
  /** revealed[i] — открыта ли i-я буква */
  revealed: boolean[];
  guessedLetters: LetterGuess[];
  eliminatedPlayerIds: ID[];
  winnerId?: ID;
}

/** Что даёт угаданная буква после выпавшего сектора */
export type PendingReward =
  | { kind: 'points'; value: number }
  | { kind: 'multiplier'; factor: number };

export type AnnouncementTone = 'info' | 'good' | 'bad' | 'win';

export interface Announcement {
  text: string;
  tone: AnnouncementTone;
  /** Увеличивается при каждом объявлении — чтобы UI мог перезапустить анимацию */
  seq: number;
}

export interface GameState {
  id: ID;
  settings: GameSettings;
  players: Player[];
  currentPlayerIndex: number;
  phase: TurnPhase;
  round: RoundState | null;
  /** Индекс выпавшего сектора и сам сектор (без targetRotation — это деталь анимации) */
  lastSpin: { sectionIndex: number; section: WheelSection } | null;
  pending: PendingReward | null;
  /** Подсказка раунда открыта (сектор «Загадка» или ведущий) */
  hintShown: boolean;
  /** Время начала текущего хода (ms) — таймер считается от него */
  turnStartedAt: number;
  /** Вопросы, ещё не сыгранные в этой партии */
  questionQueue: ID[];
  announcement: Announcement | null;
  log: GameEvent[];
}

export type GameEvent =
  | { type: 'spin'; playerId: ID; sectionId: ID; at: number }
  | { type: 'letter'; playerId: ID; letter: string; count: number; points: number; at: number }
  | { type: 'word'; playerId: ID; word: string; correct: boolean; at: number }
  | { type: 'bankrupt'; playerId: ID; lost: number; at: number }
  | { type: 'skip'; playerId: ID; at: number }
  | { type: 'prize'; playerId: ID; prize: string; at: number }
  | { type: 'plus'; playerId: ID; letter: string; at: number }
  | { type: 'timeout'; playerId: ID; at: number }
  | { type: 'roundWin'; playerId: ID; at: number }
  | { type: 'roundLost'; at: number }
  | { type: 'gameWin'; playerId: ID; at: number };

/* ============================================================
 * Ассеты
 * ============================================================ */

export type AssetKind = 'image' | 'audio' | 'background';

export interface Asset {
  id: ID;
  kind: AssetKind;
  url: MediaUrl;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  createdAt: ISODate;
}
