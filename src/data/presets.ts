import type { SectionType, Theme, Wheel, WheelSection, WheelStyle } from '@/types/game';
import { DEFAULT_PHYSICS } from '@/utils/wheelMath';

const ICON = (name: string) => `/assets/icons/${name}.svg`;
const ART = (name: string) => `/assets/art/${name}.svg`;

export const DEFAULT_WHEEL_STYLE: WheelStyle = {
  dividerColor: '#fef3c7',
  dividerWidth: 2,
  rimColor: '#b45309',
  rimWidth: 18,
  showLights: true,
  lightColor: '#fde68a',
  hubColor: '#f59e0b',
  pointerColor: '#dc2626',
  fontFamily: 'Rubik, system-ui, sans-serif',
  labelOrientation: 'radial',
};

let seq = 0;
const uid = (p: string) => `${p}_${(++seq).toString(36)}`;

type SectionDraft = Partial<WheelSection> & { type: SectionType; label: string };

function section(d: SectionDraft): WheelSection {
  return {
    id: d.id ?? uid('sec'),
    weight: 1,
    fill: { kind: 'solid', color: '#888' },
    ...d,
  };
}

/** Стандартный набор секторов: очки + спец-секторы, раскрашиваются по палитре */
export function buildClassicSections(count: number, palette: string[]): WheelSection[] {
  const specials: SectionDraft[] = [
    { type: 'bankrupt', label: 'Б', fill: { kind: 'solid', color: '#111827' }, textColor: '#fff', image: { url: ICON('skull'), mode: 'icon' } },
    { type: 'plus', label: '+', fill: { kind: 'solid', color: '#16a34a' }, textColor: '#fff', image: { url: ICON('plus'), mode: 'icon' } },
    { type: 'multiplier', label: 'x2', value: 2, fill: { kind: 'gradient', from: '#7c3aed', to: '#c084fc' }, textColor: '#fff' },
    { type: 'prize', label: 'ПРИЗ', prizeName: 'Сюрприз из шкатулки', fill: { kind: 'gradient', from: '#be123c', to: '#fb7185' }, textColor: '#fff', image: { url: ICON('gift'), mode: 'icon' }, weight: 0.6 },
    { type: 'skip', label: '0', fill: { kind: 'solid', color: '#475569' }, textColor: '#fff' },
    { type: 'mystery', label: '?', fill: { kind: 'gradient', from: '#0e7490', to: '#22d3ee' }, textColor: '#fff', image: { url: ICON('mystery'), mode: 'icon' }, weight: 0.7 },
    { type: 'bankrupt', label: 'Б', fill: { kind: 'solid', color: '#111827' }, textColor: '#fff', image: { url: ICON('skull'), mode: 'icon' } },
    { type: 'multiplier', label: 'x3', value: 3, fill: { kind: 'gradient', from: '#a16207', to: '#facc15' }, textColor: '#fff', weight: 0.5 },
  ];
  // Сколько спец-секторов помещается: ~1 на каждые 3 сектора, но не меньше 2
  const nSpecial = Math.min(specials.length, Math.max(2, Math.round(count / 3)));
  const nPoints = count - nSpecial;
  const values = [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 750, 800, 900, 1000];

  const pointSections: WheelSection[] = Array.from({ length: nPoints }, (_, i) => {
    const v = values[Math.round((i * (values.length - 1)) / Math.max(1, nPoints - 1))];
    return section({
      type: 'points',
      label: String(v),
      value: v,
      fill: { kind: 'solid', color: palette[i % palette.length] },
    });
  });

  // Спец-секторы равномерно распределяем по кругу, остальные места — очки
  const specialAt = new Map<number, number>();
  for (let k = 0; k < nSpecial; k++) specialAt.set(Math.floor(((k + 0.5) * count) / nSpecial), k);
  let pi = 0;
  return Array.from({ length: count }, (_, i) => {
    const k = specialAt.get(i);
    return k !== undefined ? section(specials[k]) : pointSections[pi++];
  });
}

const CLASSIC_PALETTE = ['#dc2626', '#f59e0b', '#2563eb', '#16a34a', '#db2777', '#0891b2', '#ea580c', '#7c3aed'];

export const CLASSIC_WHEEL: Wheel = {
  id: 'wheel_classic',
  name: 'Классический барабан',
  sections: buildClassicSections(16, CLASSIC_PALETTE),
  style: DEFAULT_WHEEL_STYLE,
  physics: DEFAULT_PHYSICS,
};

export const GALLERY_WHEEL: Wheel = {
  id: 'wheel_gallery',
  name: 'Галерея (картины в секторах)',
  sections: [
    section({ type: 'points', label: '300', value: 300, fill: { kind: 'solid', color: '#7c2d12' }, image: { url: ART('sunset'), mode: 'cover', opacity: 0.9 } }),
    section({ type: 'points', label: '500', value: 500, fill: { kind: 'solid', color: '#1e3a8a' }, image: { url: ART('waves'), mode: 'cover', opacity: 0.9 } }),
    section({ type: 'bankrupt', label: 'Б', fill: { kind: 'solid', color: '#0a0a0a' }, textColor: '#fff', image: { url: ICON('skull'), mode: 'icon' } }),
    section({ type: 'points', label: '700', value: 700, fill: { kind: 'solid', color: '#171717' }, image: { url: ART('mondrian'), mode: 'cover', opacity: 0.85 } }),
    section({ type: 'points', label: '400', value: 400, fill: { kind: 'solid', color: '#0f2a5c' }, image: { url: ART('starry'), mode: 'cover', opacity: 0.95 } }),
    section({ type: 'prize', label: 'ПРИЗ', prizeName: 'Репродукция картины', fill: { kind: 'gradient', from: '#78350f', to: '#d97706' }, textColor: '#fff', image: { url: ICON('star'), mode: 'icon' }, weight: 0.5 }),
    section({ type: 'points', label: '200', value: 200, fill: { kind: 'solid', color: '#7c2d12' }, image: { url: ART('sunset'), mode: 'cover', opacity: 0.6 } }),
    section({ type: 'plus', label: '+', fill: { kind: 'solid', color: '#14532d' }, textColor: '#fff', image: { url: ICON('plus'), mode: 'icon' } }),
    section({ type: 'points', label: '800', value: 800, fill: { kind: 'solid', color: '#1e3a8a' }, image: { url: ART('waves'), mode: 'cover', opacity: 0.6 } }),
    section({ type: 'skip', label: '0', fill: { kind: 'solid', color: '#3f3f46' }, textColor: '#fff' }),
  ],
  style: {
    ...DEFAULT_WHEEL_STYLE,
    dividerColor: '#d4af37',
    dividerWidth: 3,
    rimColor: '#3b2a12',
    rimWidth: 22,
    lightColor: '#fff7d6',
    hubColor: '#d4af37',
    pointerColor: '#d4af37',
    fontFamily: '"Playfair Display", Georgia, serif',
  },
  physics: { ...DEFAULT_PHYSICS, durationMs: 7500 },
};

export const PRESET_WHEELS: Wheel[] = [CLASSIC_WHEEL, GALLERY_WHEEL];

/* ============================================================ Темы */

export const PRESET_THEMES: Theme[] = [
  {
    id: 'theme_classic',
    name: 'Классика',
    preset: true,
    fontFamily: 'Rubik, system-ui, sans-serif',
    borderRadius: 14,
    colors: {
      background: '#1a0f3d',
      surface: '#2a1a5e',
      surfaceAlt: '#3b2a7a',
      text: '#fff8e7',
      textMuted: '#c7b8f0',
      accent: '#f59e0b',
      accentText: '#1a0f3d',
      tileBack: '#1d4ed8',
      tileFront: '#fffbeb',
      tileText: '#1a0f3d',
      danger: '#ef4444',
      success: '#22c55e',
    },
    backgroundOverlay: 'radial-gradient(ellipse at 50% 30%, #3b2a7a 0%, #1a0f3d 70%)',
    sectionPalette: CLASSIC_PALETTE,
  },
  {
    id: 'theme_art',
    name: 'Искусство и картины',
    preset: true,
    fontFamily: 'Georgia, serif',
    headingFontFamily: '"Playfair Display", Georgia, serif',
    borderRadius: 4,
    colors: {
      background: '#1c1410',
      surface: '#2a201a',
      surfaceAlt: '#3a2d22',
      text: '#f5ecd7',
      textMuted: '#bfae8f',
      accent: '#d4af37',
      accentText: '#1c1410',
      tileBack: '#5c4127',
      tileFront: '#f5ecd7',
      tileText: '#2a201a',
      danger: '#b91c1c',
      success: '#4d7c0f',
    },
    backgroundOverlay: 'radial-gradient(ellipse at 50% 20%, #3a2d22 0%, #1c1410 75%)',
    wheelStyle: { rimColor: '#3b2a12', dividerColor: '#d4af37', hubColor: '#d4af37', pointerColor: '#d4af37' },
    sectionPalette: ['#7c2d12', '#365314', '#1e3a8a', '#713f12', '#581c87', '#134e4a'],
  },
  {
    id: 'theme_cyber',
    name: 'Киберпанк',
    preset: true,
    fontFamily: '"Share Tech Mono", ui-monospace, monospace',
    borderRadius: 0,
    colors: {
      background: '#05010f',
      surface: '#110726',
      surfaceAlt: '#1d0b3d',
      text: '#e0fbff',
      textMuted: '#8a7bb8',
      accent: '#f0f',
      accentText: '#05010f',
      tileBack: '#1d0b3d',
      tileFront: '#00f0ff',
      tileText: '#05010f',
      danger: '#ff2e63',
      success: '#00ff9f',
    },
    backgroundOverlay: 'linear-gradient(180deg, #110726 0%, #05010f 100%)',
    wheelStyle: { rimColor: '#1d0b3d', dividerColor: '#00f0ff', lightColor: '#ff00ff', hubColor: '#00f0ff', pointerColor: '#ff00ff' },
    sectionPalette: ['#ff00a0', '#00e5ff', '#7b2cff', '#00ff9f', '#ff6b00', '#2d00f7'],
  },
  {
    id: 'theme_kids',
    name: 'Детская',
    preset: true,
    fontFamily: '"Comic Sans MS", Rubik, system-ui, sans-serif',
    borderRadius: 22,
    colors: {
      background: '#fff7d6',
      surface: '#ffffff',
      surfaceAlt: '#ffe9a8',
      text: '#2b2350',
      textMuted: '#6b6394',
      accent: '#ff5d8f',
      accentText: '#ffffff',
      tileBack: '#4cc9f0',
      tileFront: '#ffffff',
      tileText: '#2b2350',
      danger: '#ef476f',
      success: '#06d6a0',
    },
    backgroundOverlay: 'radial-gradient(circle at 20% 20%, #ffe9a8 0%, #fff7d6 60%)',
    wheelStyle: { rimColor: '#ff5d8f', dividerColor: '#ffffff', lightColor: '#ffffff', hubColor: '#ffd166', pointerColor: '#2b2350' },
    sectionPalette: ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5', '#f15bb5'],
  },
  {
    id: 'theme_egypt',
    name: 'Древний Египет',
    preset: true,
    fontFamily: 'Georgia, serif',
    borderRadius: 6,
    colors: {
      background: '#1f1608',
      surface: '#33250e',
      surfaceAlt: '#4a3514',
      text: '#f7e7b4',
      textMuted: '#c9ae6a',
      accent: '#e2b13c',
      accentText: '#1f1608',
      tileBack: '#1e5a8a',
      tileFront: '#f7e7b4',
      tileText: '#33250e',
      danger: '#b43a1e',
      success: '#4f8a3a',
    },
    backgroundOverlay: 'radial-gradient(ellipse at 50% 0%, #4a3514 0%, #1f1608 70%)',
    wheelStyle: { rimColor: '#7a5a1c', dividerColor: '#e2b13c', lightColor: '#f7e7b4', hubColor: '#1e5a8a', pointerColor: '#e2b13c' },
    sectionPalette: ['#1e5a8a', '#c2410c', '#b8892b', '#0f766e', '#7f1d1d', '#3f6212'],
  },
];
