import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastMsg { text: string; actionLabel?: string; onAction?: () => void; tone?: 'ok' | 'error' }
const Ctx = createContext<(m: ToastMsg) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** Bottom toast, announced to screen readers, long enough to read (7s), with optional Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<number>(0);
  const show = useCallback((m: ToastMsg) => {
    clearTimeout(timer.current);
    setMsg(m);
    timer.current = window.setTimeout(() => setMsg(null), 7000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 pointer-events-none">
        {msg && (
          <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl text-white text-[1rem] max-w-md
            ${msg.tone === 'error' ? 'bg-alarm' : 'bg-ink'}`}>
            <span className="flex-1">{msg.text}</span>
            {msg.onAction && (
              <button
                type="button"
                className="tap px-3 font-bold underline underline-offset-4"
                onClick={() => { msg.onAction!(); setMsg(null); }}
              >
                {msg.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
