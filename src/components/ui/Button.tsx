import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ok';

const styles: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  ok: 'bg-ok text-white hover:brightness-110',
  secondary: 'bg-card text-ink border-2 border-line hover:border-ink-2',
  danger: 'bg-card text-alarm border-2 border-alarm/40 hover:bg-alarm-soft',
  ghost: 'text-brand-dark hover:bg-brand-soft',
};

export function Button({
  variant = 'primary', icon, children, className = '', block, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode; block?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`tap inline-flex items-center justify-center gap-2 rounded-2xl px-5 font-semibold text-[1rem]
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]
        ${block ? 'w-full' : ''} ${styles[variant]} ${className}`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
