export function LogoMark({ className = 'w-9 h-9' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="monvyG" x1="10" y1="42" x2="44" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" /><stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      {/* perna esquerda do M (branca) */}
      <path d="M7 41 V13 Q7 10 10 12 L20 27" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* barras ascendentes (verde) */}
      <rect x="23" y="28" width="4.5" height="13" rx="1.6" fill="url(#monvyG)" />
      <rect x="30" y="22" width="4.5" height="19" rx="1.6" fill="url(#monvyG)" />
      <rect x="37" y="15" width="4.5" height="26" rx="1.6" fill="url(#monvyG)" />
      {/* seta de crescimento */}
      <path d="M19 32 L40 11" stroke="url(#monvyG)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M31.5 9.5 L42 8 L40.5 18.5 Z" fill="#34d399" />
    </svg>
  );
}

export function Logo({ size = 'md', light = true }) {
  const dims = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' };
  const mark = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' };
  return (
    <div className={`flex items-center gap-2.5 font-display font-extrabold ${dims[size]}`}>
      <span className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#0b1330] to-[#111b3f] ring-1 ring-white/10 shadow-lg p-1.5">
        <LogoMark className={mark[size]} />
      </span>
      <span className={light ? 'text-white' : 'text-[hsl(var(--text))]'}>Mon<span className="text-emerald-400">vy</span></span>
    </div>
  );
}
