import { create } from 'zustand';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

const useToasts = create<{ items: ToastItem[] }>()(() => ({ items: [] }));
let seq = 0;

export function toast(text: string, tone: ToastItem['tone'] = 'ok') {
  const id = ++seq;
  useToasts.setState((s) => ({ items: [...s.items, { id, text, tone }] }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), tone === 'error' ? 6000 : 2800);
}

/** Удобная обёртка: показывает ошибку API тостом и возвращает undefined */
export async function withToast<T>(p: Promise<T>, okText?: string): Promise<T | undefined> {
  try {
    const r = await p;
    if (okText) toast(okText);
    return r;
  } catch (e) {
    toast((e as Error).message || 'Ошибка', 'error');
    return undefined;
  }
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="pop-in pointer-events-auto flex max-w-md items-center gap-2 rounded-[var(--radius)] border border-white/10 bg-[var(--c-surface)] px-4 py-2.5 text-sm shadow-2xl"
        >
          {t.tone === 'ok' ? <CheckCircle2 size={18} className="shrink-0 text-[var(--c-success)]" /> : <XCircle size={18} className="shrink-0 text-[var(--c-danger)]" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
