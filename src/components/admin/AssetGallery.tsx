import { useState } from 'react';
import { Link2 } from 'lucide-react';
import type { AssetKind } from '@/types/game';
import { AssetTile, ASSET_ACCEPT, BUILTIN_ASSETS, DropZone, useAssets } from './AssetLibrary';
import { Select } from '@/components/ui/form';
import { toast } from '@/components/ui/Toast';

const KINDS: { id: AssetKind | ''; label: string }[] = [
  { id: '', label: 'Все' },
  { id: 'image', label: 'Картинки' },
  { id: 'background', label: 'Фоны' },
  { id: 'audio', label: 'Звуки' },
];

export function AssetGallery() {
  const { assets, upload, remove } = useAssets();
  const [kind, setKind] = useState<AssetKind | ''>('');
  const [uploadAs, setUploadAs] = useState<'auto' | 'background'>('auto');
  const list = (assets ?? []).filter((a) => !kind || a.kind === kind);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-black">Ассеты</h1>

      <div className="flex flex-col gap-2">
        <DropZone accept={`${ASSET_ACCEPT.image},${ASSET_ACCEPT.audio}`} onFiles={(f) => void upload(f, uploadAs === 'background' ? 'background' : undefined)} />
        <label className="flex items-center gap-2 self-start text-sm text-[var(--c-muted)]">
          Загружать картинки как
          <Select value={uploadAs} onChange={(e) => setUploadAs(e.target.value as 'auto' | 'background')} className="w-auto">
            <option value="auto">обычные картинки</option>
            <option value="background">фоны игрового поля</option>
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {KINDS.map((k) => (
          <button
            key={k.id}
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm ${kind === k.id ? 'bg-[var(--c-accent)] font-bold text-[var(--c-accent-text)]' : 'border border-white/15 hover:bg-white/10'}`}
          >
            {k.label}
            {assets && <span className="ml-1.5 opacity-60">{k.id ? assets.filter((a) => a.kind === k.id).length : assets.length}</span>}
          </button>
        ))}
      </div>

      {assets === null ? (
        <p className="text-[var(--c-muted)]">Загрузка…</p>
      ) : list.length === 0 ? (
        <p className="panel p-8 text-center text-[var(--c-muted)]">Здесь пока пусто — перетащите файлы в зону выше.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {list.map((a) => (
            <li key={a.id}>
              <AssetTile
                asset={a}
                onClick={() => {
                  void navigator.clipboard?.writeText(a.url).then(() => toast('Адрес скопирован'));
                }}
                onDelete={() => void remove(a)}
              />
              {a.tags.length > 0 && <p className="mt-1 truncate text-[10px] text-[var(--c-muted)]">{a.tags.join(', ')}</p>}
            </li>
          ))}
        </ul>
      )}
      {list.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--c-muted)]">
          <Link2 size={14} /> Клик по файлу копирует его адрес.
        </p>
      )}

      <section>
        <h2 className="mb-2 font-bold">Встроенные</h2>
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-9">
          {BUILTIN_ASSETS.map((a) => (
            <li key={a.id}>
              <AssetTile asset={a} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
