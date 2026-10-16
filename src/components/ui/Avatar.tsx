const palette = ['#0f766e', '#9a3412', '#1d4ed8', '#7e22ce', '#be185d', '#4d7c0f'];

export function colorFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return palette[Math.abs(h) % palette.length];
}

/** Initial-letter avatar. Decorative: the name is always written next to it. */
export function Avatar({ id, name, size = 'md' }: { id: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'w-16 h-16 text-[1.6rem]' : size === 'sm' ? 'w-9 h-9 text-[0.95rem]' : 'w-12 h-12 text-[1.2rem]';
  return (
    <span
      aria-hidden
      className={`${s} shrink-0 rounded-full grid place-items-center font-bold text-white`}
      style={{ background: colorFor(id) }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}
