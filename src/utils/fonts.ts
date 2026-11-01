/**
 * Каталог шрифтов Google Fonts с кириллицей. Тема хранит CSS-значение font-family
 * («"Playfair Display", Georgia, serif»), а загрузчик по первому имени понимает,
 * какой файл подключить. Системные шрифты (Georgia, system-ui…) не грузятся.
 */

export interface FontDef {
  family: string;
  label: string;
  group: 'Без засечек' | 'С засечками' | 'Декоративные' | 'Моноширинные';
  fallback: string;
  /** Начертания, которые есть у шрифта: запрос несуществующего даёт 400 от Google */
  weights: string;
}

export const FONT_CATALOG: FontDef[] = [
  { family: 'Rubik', label: 'Rubik', group: 'Без засечек', fallback: 'system-ui, sans-serif', weights: '400;500;700;900' },
  { family: 'Montserrat', label: 'Montserrat', group: 'Без засечек', fallback: 'system-ui, sans-serif', weights: '400;600;800' },
  { family: 'Nunito', label: 'Nunito (мягкий)', group: 'Без засечек', fallback: 'system-ui, sans-serif', weights: '400;700;900' },
  { family: 'Exo 2', label: 'Exo 2 (технологичный)', group: 'Без засечек', fallback: 'system-ui, sans-serif', weights: '400;700;900' },
  { family: 'Unbounded', label: 'Unbounded (широкий)', group: 'Без засечек', fallback: 'system-ui, sans-serif', weights: '400;700;900' },
  { family: 'Oswald', label: 'Oswald (узкий)', group: 'Без засечек', fallback: 'system-ui, sans-serif', weights: '400;600;700' },
  { family: 'Comfortaa', label: 'Comfortaa (округлый)', group: 'Без засечек', fallback: 'system-ui, sans-serif', weights: '400;700' },
  { family: 'Playfair Display', label: 'Playfair Display', group: 'С засечками', fallback: 'Georgia, serif', weights: '400;700;900' },
  { family: 'Lora', label: 'Lora', group: 'С засечками', fallback: 'Georgia, serif', weights: '400;700' },
  { family: 'PT Serif', label: 'PT Serif', group: 'С засечками', fallback: 'Georgia, serif', weights: '400;700' },
  { family: 'Cormorant Garamond', label: 'Cormorant Garamond', group: 'С засечками', fallback: 'Georgia, serif', weights: '400;700' },
  { family: 'Philosopher', label: 'Philosopher', group: 'С засечками', fallback: 'Georgia, serif', weights: '400;700' },
  { family: 'Yeseva One', label: 'Yeseva One', group: 'Декоративные', fallback: 'Georgia, serif', weights: '400' },
  { family: 'Russo One', label: 'Russo One', group: 'Декоративные', fallback: 'system-ui, sans-serif', weights: '400' },
  { family: 'Neucha', label: 'Neucha (от руки)', group: 'Декоративные', fallback: 'cursive', weights: '400' },
  { family: 'Marck Script', label: 'Marck Script (рукопись)', group: 'Декоративные', fallback: 'cursive', weights: '400' },
  { family: 'Press Start 2P', label: 'Press Start 2P (пиксели)', group: 'Декоративные', fallback: 'monospace', weights: '400' },
  { family: 'JetBrains Mono', label: 'JetBrains Mono', group: 'Моноширинные', fallback: 'ui-monospace, monospace', weights: '400;700;800' },
];

/** CSS-значение font-family для шрифта из каталога */
export const fontStack = (f: FontDef) => `"${f.family}", ${f.fallback}`;

/** Первое имя в стеке без кавычек: '"Exo 2", sans-serif' → 'Exo 2' */
export const primaryFamily = (stack: string) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '');

export const findFont = (stack: string | undefined) => (stack ? FONT_CATALOG.find((f) => f.family === primaryFamily(stack)) : undefined);

const loaded = new Set<string>(['Rubik']); // Rubik подключён в index.html

/** Подключает файлы шрифтов (однократно) для всех переданных CSS-стеков */
export function ensureFonts(...stacks: (string | undefined)[]) {
  if (typeof document === 'undefined') return;
  for (const s of stacks) {
    const f = findFont(s);
    if (!f || loaded.has(f.family)) continue;
    loaded.add(f.family);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${f.weights}&display=swap`;
    document.head.appendChild(link);
  }
}
