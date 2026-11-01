import type { Category, Question, SectionType, Theme, Wheel, WheelSection } from '@/types/game';
import { WHEEL_MAX_SECTIONS, WHEEL_MIN_SECTIONS } from '@/types/game';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const bad = (msg: string): never => {
  throw new HttpError(400, msg);
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(o: Obj, key: string, { required = true, max = 500 } = {}): string | undefined {
  const v = o[key];
  if (v === undefined || v === null || v === '') {
    if (required) bad(`Поле «${key}» обязательно`);
    return undefined;
  }
  if (typeof v !== 'string') return bad(`Поле «${key}» должно быть строкой`);
  if (v.length > max) bad(`Поле «${key}» длиннее ${max} символов`);
  return v;
}

function num(o: Obj, key: string, { required = true, min = -Infinity, max = Infinity } = {}): number | undefined {
  const v = o[key];
  if (v === undefined || v === null || v === '') {
    if (required) bad(`Поле «${key}» обязательно`);
    return undefined;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return bad(`Поле «${key}» должно быть числом`);
  if (v < min || v > max) bad(`Поле «${key}» должно быть в диапазоне ${min}…${max}`);
  return v;
}

/** URL медиа: только свои загрузки, встроенные ассеты или https */
function media(o: Obj, key: string): string | undefined {
  const v = str(o, key, { required: false, max: 1000 });
  // без кавычек/скобок/пробелов: адрес подставляется в CSS url("…")
  if (v && !/^(\/uploads\/|\/assets\/|https:\/\/)[^\s"'()\\<>]+$/.test(v)) bad(`Поле «${key}»: недопустимый адрес файла`);
  return v;
}

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]+)$/i;
function color(o: Obj, key: string, required = true): string | undefined {
  const v = str(o, key, { required, max: 60 });
  if (v && !COLOR_RE.test(v.trim())) bad(`Поле «${key}»: некорректный цвет`);
  return v;
}

/** Значения для CSS (градиенты, шрифты) — запрещаем то, что может вырваться из свойства */
function cssValue(o: Obj, key: string, required = false): string | undefined {
  const v = str(o, key, { required, max: 400 });
  if (v && /[;{}<>]|url\s*\(|expression/i.test(v)) bad(`Поле «${key}»: недопустимое значение`);
  return v;
}

const SECTION_TYPES: SectionType[] = ['points', 'prize', 'bankrupt', 'plus', 'skip', 'multiplier', 'mystery'];

function section(raw: unknown, i: number): WheelSection {
  if (!isObj(raw)) return bad(`Сектор ${i + 1}: неверный формат`);
  const type = raw.type as SectionType;
  if (!SECTION_TYPES.includes(type)) bad(`Сектор ${i + 1}: неизвестный тип`);
  const fill = raw.fill;
  if (!isObj(fill)) return bad(`Сектор ${i + 1}: нет заливки`);
  const f: WheelSection['fill'] =
    fill.kind === 'gradient' ? { kind: 'gradient', from: color(fill, 'from')!, to: color(fill, 'to')! } : { kind: 'solid', color: color(fill, 'color')! };

  let image: WheelSection['image'];
  if (isObj(raw.image) && raw.image.url) {
    image = {
      url: media(raw.image, 'url')!,
      mode: raw.image.mode === 'cover' ? 'cover' : 'icon',
      opacity: num(raw.image, 'opacity', { required: false, min: 0, max: 1 }),
    };
  }
  const value = num(raw, 'value', { required: type === 'points' || type === 'multiplier', min: 0, max: 1_000_000 });
  return {
    id: str(raw, 'id', { max: 64 })!,
    type,
    label: str(raw, 'label', { max: 24 })!,
    value,
    prizeName: str(raw, 'prizeName', { required: false, max: 120 }),
    fill: f,
    textColor: color(raw, 'textColor', false),
    image,
    weight: num(raw, 'weight', { min: 0.01, max: 1000 })!,
    questionId: str(raw, 'questionId', { required: false, max: 64 }),
  };
}

export function parseWheel(raw: unknown, id: string): Wheel {
  if (!isObj(raw)) return bad('Неверный формат барабана');
  if (!Array.isArray(raw.sections)) return bad('Нет секторов');
  if (raw.sections.length < WHEEL_MIN_SECTIONS || raw.sections.length > WHEEL_MAX_SECTIONS)
    bad(`Секторов должно быть от ${WHEEL_MIN_SECTIONS} до ${WHEEL_MAX_SECTIONS}`);
  const st = isObj(raw.style) ? raw.style : bad('Нет стиля');
  const ph = isObj(raw.physics) ? raw.physics : bad('Нет физики');
  const minTurns = num(ph, 'minTurns', { min: 1, max: 20 })!;
  return {
    id,
    name: str(raw, 'name', { max: 120 })!,
    description: str(raw, 'description', { required: false, max: 1000 }),
    sections: raw.sections.map(section),
    followTheme: raw.followTheme === true,
    style: {
      dividerColor: color(st, 'dividerColor')!,
      dividerWidth: num(st, 'dividerWidth', { min: 0, max: 20 })!,
      rimColor: color(st, 'rimColor')!,
      rimWidth: num(st, 'rimWidth', { min: 4, max: 60 })!,
      showLights: st.showLights === true,
      lightColor: color(st, 'lightColor')!,
      hubColor: color(st, 'hubColor')!,
      hubImage: media(st, 'hubImage'),
      pointerColor: color(st, 'pointerColor')!,
      fontFamily: cssValue(st, 'fontFamily', true)!,
      labelOrientation: st.labelOrientation === 'tangential' ? 'tangential' : 'radial',
    },
    physics: {
      durationMs: num(ph, 'durationMs', { min: 1000, max: 20000 })!,
      minTurns,
      maxTurns: num(ph, 'maxTurns', { min: minTurns, max: 30 })!,
      landingJitter: num(ph, 'landingJitter', { min: 0, max: 0.49 })!,
    },
  };
}

export function parseCategory(raw: unknown, id: string): Category {
  if (!isObj(raw)) return bad('Неверный формат категории');
  return {
    id,
    name: str(raw, 'name', { max: 120 })!,
    description: str(raw, 'description', { required: false, max: 1000 }),
    coverImage: media(raw, 'coverImage'),
    themeId: str(raw, 'themeId', { required: false, max: 64 }),
  };
}

export function parseQuestion(raw: unknown, id: string, alphabet: string): Question {
  if (!isObj(raw)) return bad('Неверный формат вопроса');
  const answer = str(raw, 'answer', { max: 60 })!.trim();
  const letters = [...answer.toLocaleUpperCase('ru-RU').replace(/Ё/g, 'Е')].filter((c) => alphabet.includes(c));
  if (letters.length < 2) bad('В ответе должно быть хотя бы 2 русские буквы');
  const difficulty = raw.difficulty;
  return {
    id,
    categoryId: str(raw, 'categoryId', { max: 64 })!,
    answer,
    prompt: str(raw, 'prompt', { max: 500 })!,
    hint: str(raw, 'hint', { required: false, max: 500 }),
    image: media(raw, 'image'),
    audio: media(raw, 'audio'),
    difficulty: difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'medium',
    wheelId: str(raw, 'wheelId', { required: false, max: 64 }),
  };
}

export function parseTheme(raw: unknown, id: string, preset: boolean): Theme {
  if (!isObj(raw)) return bad('Неверный формат темы');
  const c = isObj(raw.colors) ? raw.colors : bad('Нет цветов темы');
  const palette = Array.isArray(raw.sectionPalette) ? raw.sectionPalette : bad('Нет палитры');
  if (palette.length < 2 || palette.length > 24) bad('В палитре должно быть от 2 до 24 цветов');
  const ws = isObj(raw.wheelStyle) ? raw.wheelStyle : {};
  const sounds = isObj(raw.sounds) ? raw.sounds : {};
  const soundKeys = ['spinTick', 'correct', 'wrong', 'bankrupt', 'win', 'turn'] as const;
  return {
    id,
    name: str(raw, 'name', { max: 80 })!,
    preset,
    colors: {
      background: color(c, 'background')!,
      surface: color(c, 'surface')!,
      surfaceAlt: color(c, 'surfaceAlt')!,
      text: color(c, 'text')!,
      textMuted: color(c, 'textMuted')!,
      accent: color(c, 'accent')!,
      accentText: color(c, 'accentText')!,
      tileBack: color(c, 'tileBack')!,
      tileFront: color(c, 'tileFront')!,
      tileText: color(c, 'tileText')!,
      danger: color(c, 'danger')!,
      success: color(c, 'success')!,
    },
    fontFamily: cssValue(raw, 'fontFamily', true)!,
    headingFontFamily: cssValue(raw, 'headingFontFamily'),
    backgroundImage: media(raw, 'backgroundImage'),
    backgroundOverlay: cssValue(raw, 'backgroundOverlay'),
    wheelStyle: Object.fromEntries(
      (['rimColor', 'dividerColor', 'lightColor', 'hubColor', 'pointerColor'] as const)
        .map((k) => [k, color(ws, k, false)])
        .filter(([, v]) => v),
    ),
    sectionPalette: palette.map((p, i) => color({ c: p }, 'c') ?? bad(`Палитра: цвет ${i + 1}`)),
    sounds: Object.fromEntries(soundKeys.map((k) => [k, media(sounds, k)]).filter(([, v]) => v)),
    borderRadius: num(raw, 'borderRadius', { min: 0, max: 40 })!,
  };
}
