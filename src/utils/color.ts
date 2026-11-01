/** Минимальные утилиты для работы с hex-цветами (для градиентов обода, бликов и т.п.) */

export function parseHex(color: string): [number, number, number] | null {
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** amount: -1 (чёрный) .. 0 (без изменений) .. 1 (белый) */
export function shade(color: string, amount: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const target = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  const [r, g, b] = rgb.map((c) => Math.round(c + (target - c) * k));
  return `rgb(${r}, ${g}, ${b})`;
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Относительная яркость по WCAG 2.x (0..1) */
function luminance(color: string): number | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контрастный цвет текста для фона */
export function readableText(bg: string): string {
  const l = luminance(bg);
  return l !== null && l > 0.45 ? '#111' : '#fff';
}

/** Контраст по WCAG 2.x: 1..21. Для обычного текста нужно ≥ 4.5, для крупного ≥ 3 */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function hexToHsl(hex: string): [number, number, number] | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

/** Палитра из n насыщенных цветов, равномерно по кругу оттенков от базового */
export function generatePalette(base: string, n: number): string[] {
  const [h, s, l] = hexToHsl(base) ?? [0, 70, 50];
  const sat = Math.max(55, Math.min(85, s));
  const light = Math.max(38, Math.min(55, l));
  return Array.from({ length: n }, (_, i) => hslToHex((h + (360 / n) * i) % 360, sat, i % 2 ? light - 6 : light));
}
