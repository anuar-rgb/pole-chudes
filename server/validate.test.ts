import { describe, expect, it } from 'vitest';
import { CLASSIC_WHEEL, PRESET_THEMES } from '@/data/presets';
import { DEMO_QUESTIONS } from '@/data/questions';
import { RU_ALPHABET } from '@/utils/gameLogic';
import { parseQuestion, parseTheme, parseWheel } from './validate';

describe('серверная валидация', () => {
  it('пресеты проходят валидацию без изменений смысла', () => {
    const w = parseWheel(CLASSIC_WHEEL, 'x');
    expect(w.sections).toHaveLength(CLASSIC_WHEEL.sections.length);
    expect(w.followTheme).toBe(true);
    PRESET_THEMES.forEach((t) => expect(parseTheme(t, t.id, true).name).toBe(t.name));
    DEMO_QUESTIONS.forEach((q) => expect(parseQuestion(q, q.id, RU_ALPHABET).answer).toBe(q.answer));
  });

  it('id из тела запроса игнорируется — берётся из URL', () => {
    expect(parseWheel({ ...CLASSIC_WHEEL, id: 'evil' }, 'real').id).toBe('real');
  });

  it('число секторов ограничено 6…24', () => {
    expect(() => parseWheel({ ...CLASSIC_WHEEL, sections: CLASSIC_WHEEL.sections.slice(0, 5) }, 'x')).toThrow(/от 6 до 24/);
  });

  it('вес сектора должен быть положительным', () => {
    const sections = CLASSIC_WHEEL.sections.map((s, i) => (i === 0 ? { ...s, weight: 0 } : s));
    expect(() => parseWheel({ ...CLASSIC_WHEEL, sections }, 'x')).toThrow(/weight/);
  });

  it('отбрасывает опасные адреса медиа и CSS-инъекции', () => {
    const q = { categoryId: 'c', answer: 'Кот', prompt: 'p' };
    expect(() => parseQuestion({ ...q, image: 'javascript:alert(1)' }, 'x', RU_ALPHABET)).toThrow(/адрес/);
    expect(() => parseQuestion({ ...q, image: '/uploads/a.png") ; x' }, 'x', RU_ALPHABET)).toThrow(/адрес/);
    expect(() => parseTheme({ ...PRESET_THEMES[0], backgroundOverlay: 'red; } body { display:none' }, 'x', false)).toThrow(/недопустимое/);
    expect(() => parseTheme({ ...PRESET_THEMES[0], backgroundOverlay: 'url(https://evil)' }, 'x', false)).toThrow(/недопустимое/);
  });

  it('ответ должен содержать хотя бы две русские буквы', () => {
    expect(() => parseQuestion({ categoryId: 'c', answer: 'ok', prompt: 'p' }, 'x', RU_ALPHABET)).toThrow(/2 русские/);
    expect(parseQuestion({ categoryId: 'c', answer: 'Ёж', prompt: 'p' }, 'x', RU_ALPHABET).answer).toBe('Ёж');
  });

  it('неизвестные поля не попадают в сохранённые данные', () => {
    const q = parseQuestion({ categoryId: 'c', answer: 'Кот', prompt: 'p', isAdmin: true, __proto__x: 1 }, 'x', RU_ALPHABET);
    expect(Object.keys(q)).not.toContain('isAdmin');
  });
});
