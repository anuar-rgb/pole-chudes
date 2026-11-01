import type { Theme, Wheel } from '@/types/game';

/** Записывает цвета темы в CSS-переменные — Tailwind-классы вида bg-[var(--c-surface)] подхватят их */
export function applyThemeCss(theme: Theme, root: HTMLElement = document.documentElement) {
  const c = theme.colors;
  const vars: Record<string, string> = {
    '--c-bg': c.background,
    '--c-surface': c.surface,
    '--c-surface-alt': c.surfaceAlt,
    '--c-text': c.text,
    '--c-muted': c.textMuted,
    '--c-accent': c.accent,
    '--c-accent-text': c.accentText,
    '--c-tile-back': c.tileBack,
    '--c-tile-front': c.tileFront,
    '--c-tile-text': c.tileText,
    '--c-danger': c.danger,
    '--c-success': c.success,
    '--font-body': theme.fontFamily,
    '--font-heading': theme.headingFontFamily ?? theme.fontFamily,
    '--radius': `${theme.borderRadius}px`,
    '--bg-image': theme.backgroundImage ? `url("${theme.backgroundImage}")` : 'none',
    // background-image принимает только image-значения, поэтому сплошной цвет оборачиваем в градиент
    '--bg-overlay': theme.backgroundOverlay ?? `linear-gradient(${c.background}, ${c.background})`,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}

/**
 * Применяет тему к барабану с followTheme: сливает стиль и перекрашивает очковые секторы
 * без собственной картинки в палитру темы. Спец-секторы сохраняют свои цвета.
 */
export function applyThemeToWheel(wheel: Wheel, theme: Theme): Wheel {
  if (!wheel.followTheme) return wheel;
  const style = { ...wheel.style, ...theme.wheelStyle };

  const palette = theme.sectionPalette;
  const colorOf = (s: Wheel['sections'][number]) => (s.fill.kind === 'solid' ? s.fill.color : s.fill.to);
  const sections = [...wheel.sections];
  let p = 0;
  sections.forEach((s, i) => {
    if (s.type !== 'points' || s.image) return;
    // Соседи (включая замыкание круга) не должны совпадать по цвету
    const neighbours = [sections[(i - 1 + sections.length) % sections.length], sections[(i + 1) % sections.length]].map(colorOf);
    let color = palette[p % palette.length];
    for (let k = 0; k < palette.length && neighbours.includes(color); k++) color = palette[++p % palette.length];
    p++;
    sections[i] = { ...s, fill: { kind: 'solid', color } };
  });
  return { ...wheel, style, sections };
}
