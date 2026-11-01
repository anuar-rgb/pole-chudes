import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
}

/** Модальное окно на нативном <dialog>: фокус-ловушка и Esc из коробки */
export function Modal({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      className="panel m-auto w-[min(92vw,520px)] p-0 text-[var(--c-text)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      style={{ background: 'var(--c-surface)' }}
    >
      {open && (
        <div className="pop-in p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-xl font-black">{title}</h2>
            {onClose && (
              <button onClick={onClose} aria-label="Закрыть" className="rounded p-1 hover:bg-white/10">
                <X size={20} />
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
