import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Image as ImageIcon, Music, Trash2, Upload, X } from 'lucide-react';
import type { Asset, AssetKind } from '@/types/game';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast, withToast } from '@/components/ui/Toast';

/** Встроенные файлы из public/assets — доступны без загрузки */
export const BUILTIN_ASSETS: Pick<Asset, 'id' | 'kind' | 'url' | 'fileName'>[] = [
  ...['gift', 'star', 'mystery', 'plus', 'skull'].map((n) => ({ id: `b_${n}`, kind: 'image' as const, url: `/assets/icons/${n}.svg`, fileName: `${n}.svg` })),
  ...['sunset', 'mondrian', 'waves', 'starry'].map((n) => ({ id: `b_${n}`, kind: 'image' as const, url: `/assets/art/${n}.svg`, fileName: `${n}.svg` })),
];

const ACCEPT: Record<'image' | 'audio', string> = {
  image: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml',
  audio: 'audio/mpeg,audio/ogg,audio/wav,audio/webm',
};

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} МБ` : `${Math.ceil(b / 1024)} КБ`);

export function useAssets() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const reload = useCallback(async () => setAssets((await withToast(api.assets.list())) ?? []), []);
  useEffect(() => void reload(), [reload]);

  const upload = async (files: FileList | File[], kind?: AssetKind) => {
    const done: Asset[] = [];
    for (const f of files) {
      const a = await withToast(api.assets.upload(f, kind));
      if (a) done.push(a);
    }
    if (done.length) {
      setAssets((prev) => [...done.reverse(), ...(prev ?? [])]);
      toast(done.length === 1 ? 'Файл загружен' : `Загружено файлов: ${done.length}`);
    }
    return done;
  };

  const remove = async (a: Asset) => {
    try {
      await api.assets.remove(a.id);
    } catch (e) {
      // 409 — файл где-то используется: спрашиваем и удаляем принудительно
      if (!(e instanceof ApiError && e.status === 409)) return void toast((e as Error).message, 'error');
      if (!confirm(`${e.message}.\n\nВсё равно удалить? Там останется пустое место.`)) return;
      if ((await withToast(api.assets.remove(a.id, true).then(() => true))) !== true) return;
    }
    setAssets((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
    toast('Файл удалён');
  };

  return { assets, upload, remove, reload };
}

/** Зона загрузки: клик или перетаскивание файлов */
export function DropZone({ accept, onFiles, compact }: { accept: string; onFiles: (f: FileList) => void; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed text-center transition ${
        over ? 'border-[var(--c-accent)] bg-[var(--c-accent)]/10' : 'border-white/20'
      } ${compact ? 'p-4' : 'p-8'}`}
    >
      <Upload size={compact ? 20 : 28} className="text-[var(--c-muted)]" />
      <p className="text-sm text-[var(--c-muted)]">Перетащите файлы сюда или</p>
      <Button size="sm" variant="secondary" onClick={() => ref.current?.click()}>
        Выбрать файлы
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="text-xs text-[var(--c-muted)]/70">До 15 МБ · PNG, JPG, WEBP, GIF, SVG, MP3, OGG, WAV</p>
    </div>
  );
}

export function AssetTile({
  asset,
  selected,
  onClick,
  onDelete,
}: {
  asset: Pick<Asset, 'kind' | 'url' | 'fileName'> & Partial<Asset>;
  selected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}) {
  const isAudio = asset.kind === 'audio';
  return (
    <div className={`group relative overflow-hidden rounded-[calc(var(--radius)*0.6)] border ${selected ? 'border-[var(--c-accent)] ring-2 ring-[var(--c-accent)]' : 'border-white/10'} bg-black/20`}>
      <button type="button" onClick={onClick} disabled={!onClick} className="block w-full text-left disabled:cursor-default" title={asset.fileName}>
        <div className="flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#ffffff0d_0_25%,transparent_0_50%)] bg-[length:16px_16px]">
          {isAudio ? <Music size={36} className="text-[var(--c-muted)]" /> : <img src={asset.url} alt="" loading="lazy" className="h-full w-full object-contain" />}
        </div>
        <div className="truncate px-2 py-1.5 text-xs">{asset.fileName}</div>
        {asset.sizeBytes !== undefined && <div className="-mt-1 px-2 pb-1.5 text-[10px] text-[var(--c-muted)]">{fmtSize(asset.sizeBytes)}</div>}
      </button>
      {isAudio && <audio controls src={asset.url} className="h-8 w-full" preload="none" />}
      {selected && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--c-accent)] p-0.5 text-[var(--c-accent-text)]">
          <Check size={14} />
        </span>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Удалить ${asset.fileName}`}
          className="absolute right-1.5 top-1.5 rounded bg-black/60 p-1.5 text-white opacity-0 transition hover:bg-[var(--c-danger)] focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/** Модальный выбор файла из галереи (с загрузкой на месте) */
export function AssetPicker({
  open,
  kind,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  kind: 'image' | 'audio';
  value?: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const { assets, upload } = useAssets();
  const list = [...(assets ?? []).filter((a) => (kind === 'image' ? a.kind !== 'audio' : a.kind === 'audio')), ...(kind === 'image' ? BUILTIN_ASSETS : [])];

  return (
    <Modal open={open} title={kind === 'image' ? 'Выбор картинки' : 'Выбор аудио'} onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <DropZone
          compact
          accept={ACCEPT[kind]}
          onFiles={async (f) => {
            const [first] = await upload(f, kind);
            if (first) onPick(first.url);
          }}
        />
        {assets === null ? (
          <p className="text-sm text-[var(--c-muted)]">Загрузка…</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {list.map((a) => (
              <AssetTile key={a.url} asset={a} selected={a.url === value} onClick={() => onPick(a.url)} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Поле формы «медиафайл»: превью + выбрать/убрать */
export function MediaField({ kind, value, onChange }: { kind: 'image' | 'audio'; value?: string; onChange: (url: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-white/15 bg-black/20">
        {value ? kind === 'image' ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Music size={18} /> : kind === 'image' ? <ImageIcon size={18} className="text-[var(--c-muted)]" /> : <Music size={18} className="text-[var(--c-muted)]" />}
      </div>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {value ? 'Заменить' : 'Выбрать'}
      </Button>
      {value && (
        <Button size="sm" variant="ghost" aria-label="Убрать файл" onClick={() => onChange(undefined)}>
          <X size={16} />
        </Button>
      )}
      {open && (
        <AssetPicker
          open
          kind={kind}
          value={value}
          onClose={() => setOpen(false)}
          onPick={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export { ACCEPT as ASSET_ACCEPT };
