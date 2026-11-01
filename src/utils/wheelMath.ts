import type { SpinPhysics, SpinResult, Wheel, WheelSection } from '@/types/game';

/**
 * Система координат колеса.
 *  - Canvas: угол 0 — «3 часа», положительное направление — по часовой стрелке.
 *  - Сектор 0 начинается у стрелки (на «12 часов») и идёт по часовой стрелке.
 *  - rotation — суммарный угол поворота колеса по часовой стрелке (рад), не нормализуется,
 *    чтобы анимация могла крутить колесо на несколько оборотов вперёд.
 *  - Стрелка неподвижна и смотрит вниз с верхней точки.
 */

export const TAU = Math.PI * 2;
/** Угол, с которого начинается сектор 0 (верх колеса) */
export const START_ANGLE = -Math.PI / 2;

export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const sectionAngle = (count: number) => TAU / count;

/** Начальный и конечный угол сектора в локальных координатах колеса */
export function sectionBounds(index: number, count: number) {
  const w = sectionAngle(count);
  const start = START_ANGLE + index * w;
  return { start, end: start + w, center: start + w / 2 };
}

/** Индекс сектора, который сейчас под стрелкой */
export function sectionAtPointer(rotation: number, count: number): number {
  const w = sectionAngle(count);
  return Math.floor(mod(-rotation, TAU) / w) % count;
}

/**
 * Итоговый угол поворота, при котором стрелка укажет на сектор `index`.
 * @param jitter смещение от центра сектора в долях его ширины, -0.5..0.5
 */
export function rotationForSection(
  index: number,
  count: number,
  currentRotation: number,
  turns: number,
  jitter = 0,
): number {
  const w = sectionAngle(count);
  const desired = -(index + 0.5 + jitter) * w; // по модулю TAU
  const delta = mod(desired - currentRotation, TAU);
  return currentRotation + Math.max(0, Math.round(turns)) * TAU + delta;
}

/** Криптостойкое случайное число 0..1 (с фолбэком) */
export function random(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x1_0000_0000;
  }
  return Math.random();
}

/** Выбор сектора с учётом весов */
export function pickWeightedIndex(sections: Pick<WheelSection, 'weight'>[], rnd = random()): number {
  const weights = sections.map((s) => Math.max(0, s.weight || 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(rnd * sections.length);
  let acc = rnd * total;
  for (let i = 0; i < weights.length; i++) {
    acc -= weights[i];
    if (acc < 0) return i;
  }
  return weights.length - 1;
}

/** Вероятности выпадения каждого сектора (для админки) */
export function sectionProbabilities(sections: Pick<WheelSection, 'weight'>[]): number[] {
  const total = sections.reduce((a, s) => a + Math.max(0, s.weight || 0), 0);
  return sections.map((s) => (total > 0 ? Math.max(0, s.weight) / total : 1 / sections.length));
}

/**
 * Полностью подготовленный результат вращения.
 * Если сервер уже выбрал сектор, передайте forcedIndex — клиент только анимирует.
 */
export function planSpin(wheel: Wheel, currentRotation: number, forcedIndex?: number): SpinResult {
  const { sections, physics } = wheel;
  const index = forcedIndex ?? pickWeightedIndex(sections);
  const turns = physics.minTurns + random() * (physics.maxTurns - physics.minTurns);
  const j = Math.min(0.49, Math.max(0, physics.landingJitter));
  const jitter = (random() * 2 - 1) * j;
  return {
    sectionIndex: index,
    section: sections[index],
    targetRotation: rotationForSection(index, sections.length, currentRotation, turns, jitter),
  };
}

const ACCEL_T = 0.05; // доля времени на разгон
const DECEL_POW = 5; // «вязкость» торможения
// Доля пути на разгоне подобрана так, чтобы скорость на стыке фаз была непрерывной:
// 2d / a = (1 - d) * p / (1 - a)
const ACCEL_D = (DECEL_POW * ACCEL_T) / (2 * (1 - ACCEL_T) + DECEL_POW * ACCEL_T);

/**
 * Кривая вращения барабана: короткий квадратичный разгон (толчок рукой),
 * затем долгое торможение easeOut^5 — похоже на трение, пропорциональное скорости.
 * Скорость непрерывна на всём интервале, в конце плавно стремится к нулю.
 */
export function spinEasing(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < ACCEL_T) {
    const k = t / ACCEL_T;
    return ACCEL_D * k * k;
  }
  const k = (t - ACCEL_T) / (1 - ACCEL_T);
  return ACCEL_D + (1 - ACCEL_D) * (1 - Math.pow(1 - k, DECEL_POW));
}

export const DEFAULT_PHYSICS: SpinPhysics = {
  durationMs: 6500,
  minTurns: 4,
  maxTurns: 7,
  landingJitter: 0.38,
};
