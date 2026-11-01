import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export const inputCls =
  'h-10 min-w-0 rounded-[calc(var(--radius)*0.6)] border border-white/15 bg-[var(--c-surface-alt)] px-3 text-[var(--c-text)] placeholder:text-[var(--c-muted)]/60 focus:border-[var(--c-accent)] focus:outline-none disabled:opacity-50';

/** w-full по умолчанию, если ширину не задали явно — иначе w-full перебил бы w-24/w-auto */
const cls = (extra = '', base = inputCls) => `${base} ${/(^|\s|:)(w-|flex-1)/.test(extra) ? '' : 'w-full'} ${extra}`;

/**
 * group — для составных контролов (несколько кнопок): <label> отдал бы свой текст
 * в имя первой кнопки, поэтому рендерим role="group".
 */
export function Field({ label, hint, children, className = '', group }: { label: string; hint?: string; children: ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? 'div' : 'label';
  // Подсказка вне <label>, иначе её текст попадает в доступное имя поля
  return (
    <div className={`flex min-w-0 flex-col gap-1 text-sm ${className}`}>
      <Tag className="flex min-w-0 flex-col gap-1.5" role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
        <span className="text-[var(--c-muted)]">{label}</span>
        {children}
      </Tag>
      {hint && <span className="text-xs text-[var(--c-muted)]/80">{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cls(props.className)} />;
}

export function NumberInput({
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <input
      type="number"
      {...rest}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className={cls(rest.className)}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cls(`h-auto py-2 ${props.className ?? ''}`)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cls(props.className)} />;
}

/** Цвет: нативная палитра + hex-поле для точного ввода */
export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const id = useId();
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <input
        id={id}
        type="color"
        aria-label={label}
        value={isHex ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-10 shrink-0 cursor-pointer rounded border border-white/15 bg-transparent p-0.5"
      />
      <input
        aria-label={`${label}, код цвета`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} w-24 font-mono text-xs`}
        spellCheck={false}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
      <span>{children}</span>
    </label>
  );
}
