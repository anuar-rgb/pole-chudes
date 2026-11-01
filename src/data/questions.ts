import type { Category, Question } from '@/types/game';

/** Демо-база вопросов. На этапе 4 переедет в SQLite и будет редактироваться из админки */

export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat_renaissance', name: 'Картины эпохи Возрождения', themeId: 'theme_art' },
  { id: 'cat_kz', name: 'Казахская история', themeId: 'theme_egypt' },
  { id: 'cat_it', name: 'IT и программирование', themeId: 'theme_cyber' },
  { id: 'cat_kids', name: 'Для детей', themeId: 'theme_kids' },
];

type Draft = Omit<Question, 'id' | 'difficulty'> & { difficulty?: Question['difficulty'] };

const q = (id: string, d: Draft): Question => ({ id, difficulty: 'medium', ...d });

export const DEMO_QUESTIONS: Question[] = [
  q('q_r1', { categoryId: 'cat_renaissance', answer: 'Джоконда', prompt: 'Самый известный портрет кисти Леонардо да Винчи, хранится в Лувре', hint: 'Её также называют «Мона Лиза»' }),
  q('q_r2', { categoryId: 'cat_renaissance', answer: 'Боттичелли', prompt: 'Автор картины «Рождение Венеры»', hint: 'Флорентийский мастер, фамилия означает «бочонок»' }),
  q('q_r3', { categoryId: 'cat_renaissance', answer: 'Фреска', prompt: 'Техника живописи по сырой штукатурке, которой расписана Сикстинская капелла', hint: 'От итальянского «свежий»', difficulty: 'easy' }),
  q('q_r4', { categoryId: 'cat_renaissance', answer: 'Сфумато', prompt: 'Приём Леонардо: мягкие, словно дымчатые переходы светотени', hint: 'По-итальянски «исчезнувший как дым»', difficulty: 'hard' }),
  q('q_r5', { categoryId: 'cat_renaissance', answer: 'Тайная вечеря', prompt: 'Фреска Леонардо в трапезной монастыря Санта-Мария-делле-Грацие в Милане', hint: 'Последняя трапеза Христа с апостолами' }),

  q('q_k1', { categoryId: 'cat_kz', answer: 'Абылай', prompt: 'Хан, объединивший казахские жузы в XVIII веке', hint: 'Его именем назван университет в Алматы' }),
  q('q_k2', { categoryId: 'cat_kz', answer: 'Туркестан', prompt: 'Город, где находится мавзолей Ходжи Ахмеда Ясави', hint: 'Духовная столица тюркского мира', difficulty: 'easy' }),
  q('q_k3', { categoryId: 'cat_kz', answer: 'Золотой человек', prompt: 'Знаменитая находка из кургана Иссык — воин в облачении из золотых пластин', hint: 'Стал одним из символов независимого Казахстана' }),
  q('q_k4', { categoryId: 'cat_kz', answer: 'Керей', prompt: 'Один из двух султанов — основателей Казахского ханства в XV веке', hint: 'Его соправитель — Жанибек', difficulty: 'hard' }),
  q('q_k5', { categoryId: 'cat_kz', answer: 'Отрар', prompt: 'Древний город на Сырдарье, известный своей библиотекой и родиной аль-Фараби', hint: 'Пал под натиском Чингисхана в 1219 году' }),

  q('q_i1', { categoryId: 'cat_it', answer: 'Рекурсия', prompt: 'Когда функция вызывает саму себя', hint: 'Чтобы понять её, нужно понять её', difficulty: 'easy' }),
  q('q_i2', { categoryId: 'cat_it', answer: 'Компилятор', prompt: 'Программа, переводящая исходный код в машинный', hint: 'Альтернатива интерпретатору' }),
  q('q_i3', { categoryId: 'cat_it', answer: 'Утечка памяти', prompt: 'Ошибка, при которой программа занимает всё больше RAM и не освобождает её', hint: 'Сборщик мусора с ней борется' }),
  q('q_i4', { categoryId: 'cat_it', answer: 'Инкапсуляция', prompt: 'Принцип ООП: скрытие внутреннего состояния объекта', hint: 'Рядом с наследованием и полиморфизмом', difficulty: 'hard' }),
  q('q_i5', { categoryId: 'cat_it', answer: 'Репозиторий', prompt: 'Хранилище кода в системе контроля версий', hint: 'На GitHub их миллионы' }),

  q('q_c1', { categoryId: 'cat_kids', answer: 'Радуга', prompt: 'Разноцветная дуга на небе после дождя', hint: 'В ней семь цветов', difficulty: 'easy' }),
  q('q_c2', { categoryId: 'cat_kids', answer: 'Снеговик', prompt: 'Его лепят зимой из трёх снежных комов', hint: 'Вместо носа — морковка', difficulty: 'easy' }),
  q('q_c3', { categoryId: 'cat_kids', answer: 'Черепаха', prompt: 'Медленное животное, которое носит дом на спине', hint: 'Тортилла из сказки про Буратино', difficulty: 'easy' }),
];
