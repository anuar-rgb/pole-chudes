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

/** Контрастный цвет текста для фона (WCAG relative luminance) */
export function readableText(bg: string): string {
  const rgb = parseHex(bg);
  if (!rgb) return '#fff';
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111' : '#fff';
}
