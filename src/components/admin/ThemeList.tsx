import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type { Theme } from '@/types/game';
import { api } from '@/api/client';
import { useDataStore } from '@/store/dataStore';
import { themeOverlayCss } from '@/utils/theme';
import { ensureFonts } from '@/utils/fonts';
import { Button } from '@/components/ui/Button';
import { toast, withToast } from '@/components/ui/Toast';

type ThemeBody = Omit<Theme, 'id' | 'preset' | 'createdAt' | 'updatedAt'>;

const bodyOf = ({ id: _id, preset: _p, createdAt: _c, updatedAt: _u, ...rest }: Theme): ThemeBody => rest;

export function ThemeList() {
  const { themes, categories, upsert, drop } = useDataStore();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => ensureFonts(...themes.flatMap((t) => [t.fontFamily, t.headingFontFamily])), [themes]);

  const create = async (body: ThemeBody, msg: string) => {
    const t = await withToast(api.themes.create(body), msg);
    if (t) {
      upsert('themes', t);
      navigate(`/admin/themes/${t.id}`);
    }
  };

  const remove = async (t: Theme) => {
    const used = categories.filter((c) => c.themeId === t.id).length;
    if (!confirm(used ? `Удалить тему «${t.name}»? ${used} категори(й) останутся без темы.` : `Удалить тему «${t.name}»?`)) return;
    if ((await withToast(api.themes.remove(t.id).then(() => true), 'Тема удалена')) === true) drop('themes', t.id);
  };

  const exportTheme = (t: Theme) => {
    const blob = new Blob([JSON.stringify(bodyOf(t), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `тема-${t.name}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importTheme = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as ThemeBody;
      // сервер проверит каждое поле; здесь только убираем служебные
      const { id: _id, preset: _p, createdAt: _c, updatedAt: _u, ...body } = data as Theme;
      await create({ ...body, name: body.name || file.name.replace(/\.json$/, '') }, 'Тема импортирована');
    } catch {
      toast('Файл не похож на JSON темы', 'error');
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Темы</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={18} /> Импорт
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importTheme(f);
              e.target.value = '';
            }}
          />
          <Button onClick={() => navigate('/admin/themes/new')}>
            <Plus size={18} /> Новая тема
          </Button>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((t) => (
          <li key={t.id} className="panel flex flex-col overflow-hidden">
            <button
              type="button"
              onClick={() => navigate(`/admin/themes/${t.id}`)}
              aria-label={`Редактировать тему ${t.name}`}
              className="flex h-36 flex-col justify-between p-4 text-left"
              style={{
                backgroundColor: t.colors.background,
                backgroundImage: `${themeOverlayCss(t)}${t.backgroundImage ? `, url("${t.backgroundImage}")` : ''}`,
                backgroundSize: 'cover',
                color: t.colors.text,
                fontFamily: t.fontFamily,
              }}
            >
              <span className="text-xl font-black" style={{ fontFamily: t.headingFontFamily ?? t.fontFamily }}>
                {t.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="px-3 py-1 text-sm font-bold" style={{ background: t.colors.accent, color: t.colors.accentText, borderRadius: t.borderRadius }}>
                  Кнопка
                </span>
                {['П', 'О'].map((ch) => (
                  <span key={ch} className="flex h-8 w-7 items-center justify-center font-black" style={{ background: t.colors.tileFront, color: t.colors.tileText, borderRadius: t.borderRadius / 2 }}>
                    {ch}
                  </span>
                ))}
                <span className="h-8 w-7" style={{ background: t.colors.tileBack, borderRadius: t.borderRadius / 2 }} />
              </span>
            </button>
            <div className="flex h-2">
              {t.sectionPalette.map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="flex items-center gap-2 p-3">
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--c-muted)]">{t.preset ? 'встроенная' : 'своя'}</span>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/themes/${t.id}`)}>
                <Pencil size={16} /> Изменить
              </Button>
              <Button size="sm" variant="ghost" aria-label="Дублировать" title="Дублировать" onClick={() => create({ ...bodyOf(t), name: `${t.name} (копия)` }, 'Копия создана')}>
                <Copy size={16} />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Скачать JSON" title="Скачать JSON" onClick={() => exportTheme(t)}>
                <Download size={16} />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Удалить" title={t.preset ? 'Встроенную тему удалить нельзя' : 'Удалить'} disabled={t.preset} onClick={() => remove(t)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
