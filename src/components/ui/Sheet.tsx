import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useT } from '../../lib/i18n';

/** Accessible bottom sheet / dialog: focus trapped, Escape closes, focus returns on close. */
export function Sheet({ title, onClose, children, footer, dismissible = true }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
  /** false = tapping outside does nothing (protects a half-filled form) */
  dismissible?: boolean;
}) {
  const { t } = useT();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'))
        .filter((x) => !x.hasAttribute('disabled'));
    (el.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/50" onClick={dismissible ? onClose : undefined}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-paper rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 id={id} className="text-[1.35rem] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="tap min-w-[3.3rem] grid place-items-center rounded-full hover:bg-line/50"
          >
            <X className="w-6 h-6" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 safe-bottom bg-paper rounded-b-3xl">{footer}</div>}
      </div>
    </div>
  );
}
