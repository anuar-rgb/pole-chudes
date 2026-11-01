import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--c-accent)] text-[var(--c-accent-text)] shadow-lg hover:brightness-110',
  secondary: 'bg-[var(--c-surface-alt)] text-[var(--c-text)] hover:brightness-125',
  ghost: 'border border-white/15 text-[var(--c-text)] hover:bg-white/10',
  danger: 'bg-[var(--c-danger)] text-white hover:brightness-110',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'px-7 py-3.5 text-lg' : size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-5 py-2.5';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${sz} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
