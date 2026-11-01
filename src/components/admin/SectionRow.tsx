import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from 'lucide-react';
import type { SectionType, WheelSection } from '@/types/game';
import { SECTION_TYPE_LABELS } from '@/types/game';
import { ColorInput, Input, NumberInput, Select } from '@/components/ui/form';
import { MediaField } from './AssetLibrary';

/** Разумные значения по умолчанию при смене типа сектора */
const TYPE_DEFAULTS: Record<SectionType, Partial<WheelSection>> = {
  points: { label: '500', value: 500 },
  prize: { label: 'ПРИЗ', prizeName: 'Приз', value: undefined },
  bankrupt: { label: 'Б', value: undefined },
  plus: { label: '+', value: undefined },
  skip: { label: '0', value: undefined },
  multiplier: { label: 'x2', value: 2 },
  mystery: { label: '?', value: 500 },
};

interface Props {
  section: WheelSection;
  index: number;
  count: number;
  probability: number;
  canDelete: boolean;
  onChange: (s: WheelSection) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  drag: {
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    onDragEnd: () => void;
    isOver: boolean;
  };
}

export function SectionRow({ section: s, index, count, probability, canDelete, onChange, onMove, onDuplicate, onDelete, drag }: Props) {
  const set = (patch: Partial<WheelSection>) => onChange({ ...s, ...patch });
  const valueLabel = s.type === 'multiplier' ? 'Множитель' : s.type === 'points' ? 'Очки за букву' : s.type === 'mystery' ? 'Очки за букву' : 'Стоимость';
  // Строка перетаскивается только за ручку: draggable на всей строке ломает выделение текста в полях
  const [armed, setArmed] = useState(false);

  return (
    <li
      draggable={armed}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
      onDragEnd={() => {
        setArmed(false);
        drag.onDragEnd();
      }}
      className={`panel flex flex-col gap-3 p-3 transition ${drag.isOver ? 'ring-2 ring-[var(--c-accent)]' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          onPointerDown={() => setArmed(true)}
          onPointerUp={() => setArmed(false)}
          className="cursor-grab text-[var(--c-muted)] active:cursor-grabbing"
          title="Перетащите, чтобы изменить порядок"
        >
          <GripVertical size={18} />
        </span>
        <span className="w-6 text-center text-sm font-bold text-[var(--c-muted)]">{index + 1}</span>
        <span
          className="h-6 w-6 shrink-0 rounded"
          style={{ background: s.fill.kind === 'solid' ? s.fill.color : `linear-gradient(135deg, ${s.fill.from}, ${s.fill.to})` }}
        />
        <Select
          aria-label="Тип сектора"
          value={s.type}
          onChange={(e) => {
            const type = e.target.value as SectionType;
            set({ type, ...TYPE_DEFAULTS[type] });
          }}
          className="w-auto flex-1 sm:flex-none"
        >
          {Object.entries(SECTION_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input aria-label="Подпись" value={s.label} maxLength={24} onChange={(e) => set({ label: e.target.value })} className="w-24" />
        <span className="ml-auto text-xs tabular-nums text-[var(--c-muted)]">{(probability * 100).toFixed(1)}%</span>
        <div className="flex">
          <IconBtn label="Выше" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp size={16} />
          </IconBtn>
          <IconBtn label="Ниже" disabled={index === count - 1} onClick={() => onMove(1)}>
            <ArrowDown size={16} />
          </IconBtn>
          <IconBtn label="Дублировать" onClick={onDuplicate}>
            <Copy size={16} />
          </IconBtn>
          <IconBtn label="Удалить" disabled={!canDelete} onClick={onDelete} danger>
            <Trash2 size={16} />
          </IconBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(s.type === 'points' || s.type === 'multiplier' || s.type === 'mystery' || s.type === 'prize') && (
          <Mini label={valueLabel}>
            <NumberInput
              value={s.value}
              min={0}
              step={s.type === 'multiplier' ? 1 : 50}
              onChange={(value) => {
                // Подпись, совпадавшая со значением («500» / «x2»), обновляется вместе с ним
                const auto = s.type === 'points' ? String(s.value) : s.type === 'multiplier' ? `x${s.value}` : null;
                const label = auto !== null && s.label === auto && value !== undefined ? (s.type === 'points' ? String(value) : `x${value}`) : s.label;
                set({ value, label });
              }}
            />
          </Mini>
        )}
        {s.type === 'prize' && (
          <Mini label="Название приза" wide>
            <Input value={s.prizeName ?? ''} maxLength={120} onChange={(e) => set({ prizeName: e.target.value })} />
          </Mini>
        )}
        <Mini label="Вес (шанс)">
          <NumberInput value={s.weight} min={0.01} step={0.1} onChange={(weight) => set({ weight: weight ?? 1 })} />
        </Mini>
        <Mini label="Цвет текста" group>
          <ColorInput label="Цвет текста" value={s.textColor ?? '#ffffff'} onChange={(textColor) => set({ textColor })} />
        </Mini>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Mini label="Заливка">
          <Select
            value={s.fill.kind}
            onChange={(e) =>
              set({
                fill:
                  e.target.value === 'gradient'
                    ? { kind: 'gradient', from: s.fill.kind === 'solid' ? s.fill.color : s.fill.from, to: '#ffffff' }
                    : { kind: 'solid', color: s.fill.kind === 'gradient' ? s.fill.from : s.fill.color },
              })
            }
            className="w-auto"
          >
            <option value="solid">Цвет</option>
            <option value="gradient">Градиент</option>
          </Select>
        </Mini>
        {s.fill.kind === 'solid' ? (
          <Mini label="Цвет" group>
            <ColorInput label="Цвет сектора" value={s.fill.color} onChange={(color) => set({ fill: { kind: 'solid', color } })} />
          </Mini>
        ) : (
          <>
            <Mini label="От центра" group>
              <ColorInput label="Цвет у центра" value={s.fill.from} onChange={(from) => set({ fill: { ...(s.fill as { kind: 'gradient'; from: string; to: string }), from } })} />
            </Mini>
            <Mini label="К ободу" group>
              <ColorInput label="Цвет у обода" value={s.fill.to} onChange={(to) => set({ fill: { ...(s.fill as { kind: 'gradient'; from: string; to: string }), to } })} />
            </Mini>
          </>
        )}
        <Mini label="Картинка" group>
          <MediaField kind="image" value={s.image?.url} onChange={(url) => set({ image: url ? { url, mode: s.image?.mode ?? 'icon', opacity: s.image?.opacity } : undefined })} />
        </Mini>
        {s.image && (
          <>
            <Mini label="Как показывать">
              <Select value={s.image.mode} onChange={(e) => set({ image: { ...s.image!, mode: e.target.value as 'cover' | 'icon' } })} className="w-auto">
                <option value="icon">Иконка у обода</option>
                <option value="cover">Фон сектора</option>
              </Select>
            </Mini>
            {s.image.mode === 'cover' && (
              <Mini label={`Прозрачность ${Math.round((s.image.opacity ?? 1) * 100)}%`}>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={s.image.opacity ?? 1}
                  onChange={(e) => set({ image: { ...s.image!, opacity: +e.target.value } })}
                  className="h-10 accent-[var(--c-accent)]"
                />
              </Mini>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** group — для составных контролов, см. Field в ui/form */
function Mini({ label, children, wide, group }: { label: string; children: React.ReactNode; wide?: boolean; group?: boolean }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={`flex min-w-0 flex-col gap-1 text-xs ${wide ? 'col-span-2' : ''}`} role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span className="text-[var(--c-muted)]">{label}</span>
      {children}
    </Tag>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded p-2 transition disabled:opacity-30 ${danger ? 'hover:bg-[var(--c-danger)]/20 hover:text-[var(--c-danger)]' : 'hover:bg-white/10'}`}
    >
      {children}
    </button>
  );
}
