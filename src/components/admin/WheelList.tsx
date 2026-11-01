import { Link, useNavigate } from 'react-router-dom';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Wheel } from '@/types/game';
import { api } from '@/api/client';
import { useDataStore } from '@/store/dataStore';
import { WheelCanvas } from '@/components/game/WheelCanvas';
import { Button } from '@/components/ui/Button';
import { withToast } from '@/components/ui/Toast';

export function WheelList() {
  const { wheels, questions, upsert, drop } = useDataStore();
  const navigate = useNavigate();

  const duplicate = async (w: Wheel) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...body } = w;
    const copy = await withToast(api.wheels.create({ ...body, name: `${w.name} (копия)` }), 'Копия создана');
    if (copy) {
      upsert('wheels', copy);
      navigate(`/admin/wheels/${copy.id}`);
    }
  };

  const remove = async (w: Wheel) => {
    const used = questions.filter((q) => q.wheelId === w.id).length;
    const msg = used ? `Удалить «${w.name}»? ${used} вопрос(ов) переключатся на барабан партии.` : `Удалить «${w.name}»?`;
    if (!confirm(msg)) return;
    if ((await withToast(api.wheels.remove(w.id).then(() => true), 'Барабан удалён')) === true) drop('wheels', w.id);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Барабаны</h1>
        <Button onClick={() => navigate('/admin/wheels/new')}>
          <Plus size={18} /> Новый барабан
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {wheels.map((w) => (
          <li key={w.id} className="panel flex flex-col gap-3 p-4">
            <Link to={`/admin/wheels/${w.id}`} className="mx-auto w-full max-w-[220px]" aria-label={`Редактировать ${w.name}`}>
              <WheelCanvas wheel={w} />
            </Link>
            <div>
              <h2 className="truncate font-bold">{w.name}</h2>
              <p className="text-sm text-[var(--c-muted)]">
                {w.sections.length} секторов{w.followTheme ? ' · следует теме' : ''}
              </p>
            </div>
            <div className="mt-auto flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => navigate(`/admin/wheels/${w.id}`)}>
                <Pencil size={16} /> Изменить
              </Button>
              <Button size="sm" variant="ghost" aria-label="Дублировать" title="Дублировать" onClick={() => duplicate(w)}>
                <Copy size={16} />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Удалить" title="Удалить" disabled={wheels.length <= 1} onClick={() => remove(w)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
