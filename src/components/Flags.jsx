// Bandeiras circulares simplificadas (SVG próprio) — o Windows não desenha
// emojis de bandeira, então cada moeda tem o seu desenho.
import { useId } from 'react';

function Wrap({ size, children, label }) {
  const id = useId().replace(/:/g, '');
  return (
  <svg viewBox="0 0 32 32" width={size} height={size} role="img" aria-label={label} className="shrink-0 rounded-full ring-1 ring-white/20 shadow-[0_0_10px_rgba(0,0,0,.25)]">
    <defs><clipPath id={`fl${id}`}><circle cx="16" cy="16" r="16" /></clipPath></defs>
    <g clipPath={`url(#fl${id})`}>{children}</g>
  </svg>
  );
}

const FLAGS = {
  USD: (
    <>
      <rect width="32" height="32" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={`r${i}`} y={i * 4.92} width="32" height="2.46" fill="#d22f3c" />)}
      <rect width="15" height="17.2" fill="#2b3a8c" />
      {[[3, 3], [7, 3], [11, 3], [5, 6.5], [9, 6.5], [3, 10], [7, 10], [11, 10], [5, 13.5], [9, 13.5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r=".9" fill="#fff" />)}
    </>
  ),
  EUR: (
    <>
      <rect width="32" height="32" fill="#1f3fa8" />
      {Array.from({ length: 12 }).map((_, i) => { const a = (i / 12) * Math.PI * 2; return <circle key={i} cx={16 + 8.5 * Math.cos(a)} cy={16 + 8.5 * Math.sin(a)} r="1.3" fill="#ffd200" />; })}
    </>
  ),
  GBP: (
    <>
      <rect width="32" height="32" fill="#1d3a8a" />
      <path d="M0 0L32 32M32 0L0 32" stroke="#fff" strokeWidth="6" />
      <path d="M0 0L32 32M32 0L0 32" stroke="#d22f3c" strokeWidth="2" />
      <path d="M16 0V32M0 16H32" stroke="#fff" strokeWidth="9" />
      <path d="M16 0V32M0 16H32" stroke="#d22f3c" strokeWidth="5" />
    </>
  ),
  JPY: (<><rect width="32" height="32" fill="#fff" /><circle cx="16" cy="16" r="7" fill="#d22f3c" /></>),
  CAD: (
    <>
      <rect width="32" height="32" fill="#fff" />
      <rect width="8" height="32" fill="#d22f3c" /><rect x="24" width="8" height="32" fill="#d22f3c" />
      <path d="M16 8l1.6 3.2 2.4-1-1 4.6 2.6-1.8.6 1.6 2-.4-1 3 1 .8-4.6 3.4.6 1.8L16.6 21v4h-1.2v-4l-3.6 2.2.6-1.8L7.8 18l1-.8-1-3 2 .4.6-1.6 2.6 1.8-1-4.6 2.4 1z" fill="#d22f3c" />
    </>
  ),
  ARS: (<><rect width="32" height="32" fill="#fff" /><rect width="32" height="10.6" fill="#74acdf" /><rect y="21.4" width="32" height="10.6" fill="#74acdf" /><circle cx="16" cy="16" r="3" fill="#f6b40e" /></>),
  BRL: (<><rect width="32" height="32" fill="#009c3b" /><path d="M16 5L29 16L16 27L3 16Z" fill="#ffdf00" /><circle cx="16" cy="16" r="6" fill="#002776" /><path d="M10.2 14.6c4-1.2 8.2-.8 11.8 1.2" stroke="#fff" strokeWidth="1.2" fill="none" /></>),
  CHF: (<><rect width="32" height="32" fill="#d52b1e" /><rect x="13.5" y="7" width="5" height="18" fill="#fff" /><rect x="7" y="13.5" width="18" height="5" fill="#fff" /></>),
  CNY: (<><rect width="32" height="32" fill="#de2910" /><path d="M10 6l1.5 4.6h4.8l-3.9 2.8 1.5 4.6L10 15.2 6.1 18l1.5-4.6L3.7 10.6h4.8z" fill="#ffde00" /></>),
};

export function Flag({ code, size = 28 }) {
  const f = FLAGS[code];
  if (!f) return <span className="shrink-0 rounded-full bg-slate-500/30 grid place-items-center text-[10px] font-bold" style={{ width: size, height: size }}>{String(code).slice(0, 2)}</span>;
  return <Wrap size={size} label={code}>{f}</Wrap>;
}
